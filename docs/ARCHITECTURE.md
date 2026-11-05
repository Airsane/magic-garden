# Architektura

## Přehled toku dat

```
            ┌──────────── hra (React + jotai) ────────────┐
            │                                              │
 WebSocket ◄┼── net/socket.ts ◄── net/commands.ts ◄── farm/*.ts ◄── farm/loop.ts (časovač)
            │        ▲                                    ▲
            │        └ přečíslování příkazů hry           │
 jotai store┼──► game/store.ts ──► game/reader.ts ────────┤
            │     (readAtom)        (GameSnapshot)        │
            └──────────────────────────────────────────── ┼──► ui/panel.ts (tick 1 s) ──► ui/tabs/*
                                                          │
                                            config.ts (S) · stats.ts · state.ts · log.ts
```

1. **Start** (`main.ts`): skript běží na `document-start`, takže stihne obalit
   `window.WebSocket` dřív, než ho hra vytvoří. Pak (volitelně) zapne anti-AFK,
   po `DOMContentLoaded` postaví panel a spustí časovač.
2. **Čtení**: `readGame()` poskládá z jotai atomů jeden `GameSnapshot`
   (zahrada, batoh, semínka, mapa, mazlíčci, mince).
3. **Akce**: každých `intervalSec` sekund proběhne `cycle()`:
   sklizeň → krmení → (prodej) → sázení. Každá akce se po odeslání **ověří**
   novým čtením hry (co se nesklidilo / nezasadilo, se počítá jako neúspěch
   a po úplném neúspěchu následuje 1 min pauza).
4. **UI**: `tick()` každou sekundu obnoví `state.game`, statistiky mincí
   a překreslí živou část aktuální záložky.

## Číslování příkazů (`net/socket.ts`)

Server přijímá `QuinoaCommand` jen se stále rostoucím `commandSequence`. Hra si
čísla počítá sama a o našich příkazech neví, takže:

- `Welcome` od serveru nese `executedCommandSequence` → `nextSeq = n + 1`.
- Dokud jsme nic neposlali, jen sledujeme čísla, která posílá hra.
- Po prvním vlastním příkazu dostane **každý** příkaz hry nové číslo `nextSeq++`.
- Vlastní příkazy poznáme podle `requestId` (sada `ownIds`) a nepřečíslováváme je.
- Při zavření socketu se vše resetuje.

Proto nejde kombinovat s jiným modem, který dělá totéž.

Posílané příkazy (`net/commands.ts`):

| Příkaz | Pole |
| --- | --- |
| `HarvestCrop` | `slot` (index políčka), `slotsIndex`, `cropItemId` (id plodu v batohu – generujeme my) |
| `PlantSeed` | `slot`, `species` |
| `FeedPet` | `petItemId`, `cropItemId` |
| `SellAllCrops` | – |

Mimo `QuinoaCommand` posílá anti-AFK ještě `PlayerPosition` (bez čísla).

## Data hry (`game/`)

`store.ts` najde jotai store buď přes React DevTools hook (fiber strom → Provider
s `value` = store), nebo záložně dočasným obalením `write` všech atomů. Atomy se
hledají podle `debugLabel` v `window.jotaiAtomCache`:

| Atom | Co z něj čteme |
| --- | --- |
| `myDataAtom` | mince, `garden.tileObjects` (políčka zahrady) |
| `myCropInventoryAtom` | plodiny v batohu |
| `mySeedInventoryAtom` | semínka v batohu |
| `myInventoryAtom` | `favoritedItemIds` (oblíbené se nikdy nekrmí) |
| `mapAtom` + `myUserSlotIdxAtom` | která políčka hlíny patří hráči |
| `myPredictedPetSlotsAtom` / `myPrimitivePetSlotsAtom` | aktivní mazlíčci |
| `positionAtom` | pozice hráče (anti-AFK) |

Tvar dat se může s verzí hry měnit, proto jsou typy v `game/*.ts` „volné“
(všechna pole volitelná) a čtení je všude defenzivní. Když hra něco přejmenuje,
oprava patří do `game/reader.ts` / `game/pets.ts`, zbytek kódu pracuje už jen
s normalizovanými typy `Crop`, `Pet` a `GameSnapshot`.

## Pravidla mezi moduly

- **Logika nezávisí na UI.** `farm/`, `game/`, `net/` UI neimportují; když chtějí
  překreslit panel, volají `renderLive()` ze `state.ts` (UI ho při startu
  zaregistruje přes `setRenderer`).
- **Žádné cyklické runtime importy.** V bundlu by některý modul při startu viděl
  `undefined`. Hlídá to `scripts/check-cycles.mjs` (spouští se v `./build.sh`).
  Importy jen typů (`import type …`) nevadí. `state.ts` a `config.ts` jsou listy –
  za běhu neimportují nic dalšího ze `src/` (kromě `state → config`).
- **Nastavení** (`S` v `config.ts`) se mutuje na místě a ukládá voláním `save()`.
  Statistiky (`session`, `allTime`) se ukládají `saveAll()`.
- **HTML z dat hry** vždy prohnat `esc()`.

## Jak přidat nové nastavení

1. Přidej pole do `Settings` a výchozí hodnotu do `DEFAULTS` (`config.ts`).
   Staré uložené nastavení se doplní z výchozích hodnot automaticky.
2. Do formuláře záložky přidej `cb("klic", "Popisek")` nebo `num("klic", "Popisek", min, max)`
   – navázání na `S` obstará `ui/fields.ts`. Případné omezení rozsahu přidej do `clamp()`.
3. Použij `S.klic` v logice.

## Jak přidat záložku

1. Vytvoř `src/ui/tabs/nova.ts`, který exportuje `TabView`
   (`icon`, `title`, volitelně `form` + `bindForm`, povinně `live`).
2. Přidej klíč do typu `Tab` v `config.ts` a záložku do `TABS` v `ui/panel.ts`
   (pořadí v objektu = pořadí v panelu).

`form` se vykreslí jen při přepnutí záložky (aby se pole nepřekreslovala pod
rukama), `live` se volá každou sekundu a po každé akci.
