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
   zápis do sbírky → sklizeň → krmení → (prodej) → nákup semínek → sázení. Každá akce se po odeslání **ověří**
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
| `LogItem` | `target: { kind: "growSlot", slot, slotsIndex }` – zápis plodu do sbírky |
| `PurchaseShopItem` | `shop: "seed"`, `viewMode` (`"list"`/`"grid"` z localStorage hry), `item: { itemType: "Seed", species }`, `quantity?` (jen > 1) |

Mimo `QuinoaCommand` posílá anti-AFK ještě `PlayerPosition` (bez čísla).

## Sbírka (deník)

Foťák ve hře pošle `TakePhoto` (jen záblesk) a za každý plod v záběru s novou
variantou `LogItem`. Do deníku zapisuje jen `LogItem`; server nekontroluje, jestli
hráč drží foťák, takže `TakePhoto` neposíláme. Odpověď: `QuinoaCommandResult`
s `payload: { journalType: "Produce", speciesId, variants }`. Deník je
`myDataAtom.journal.produce[druh].variantsLogged[].variant`.

`farm/journal.ts` zapíše zralé plody s chybějící variantou před sklizní a ověří to
novým čtením deníku. Nezapsaný plod se v daném kole nesklidí ani nesní ze zahrady,
nejvýš 3 neúspěšné pokusy (`MAX_LOG_ATTEMPTS`), pak se uvolní.

## Data hry (`game/`)

`store.ts` najde jotai store buď přes React DevTools hook (fiber strom → Provider
s `value` = store), nebo záložně dočasným obalením `write` všech atomů. Atomy se
hledají podle `debugLabel` v `window.jotaiAtomCache`:

| Atom | Co z něj čteme |
| --- | --- |
| `myDataAtom` | mince, `garden.tileObjects` (políčka zahrady), `journal` (sbírka) |
| `myCropInventoryAtom` | plodiny v batohu |
| `mySeedInventoryAtom` | semínka v batohu |
| `myInventoryAtom` | `favoritedItemIds` (oblíbené se nikdy nekrmí) |
| `mapAtom` + `myUserSlotIdxAtom` | která políčka hlíny patří hráči |
| `myPredictedPetSlotsAtom` / `myPrimitivePetSlotsAtom` | aktivní mazlíčci |
| `positionAtom` | pozice hráče (anti-AFK) |
| `numPlayersAtom` | počet hráčů (bonus za přátele) |
| `stateAtom` | `child.data.shops.seed` – obchod místnosti (`restockId`, `inventory`) |
| `myUserSlotAtom` | `data.shopPurchases.seed` – co hráč koupil v aktuálním restocku |

Tvar dat se může s verzí hry měnit, proto jsou typy v `game/*.ts` „volné“
(všechna pole volitelná) a čtení je všude defenzivní. Když hra něco přejmenuje,
oprava patří do `game/reader.ts` / `game/pets.ts`, zbytek kódu pracuje už jen
s normalizovanými typy `Crop`, `Pet` a `GameSnapshot`.

## Ceny a kalkulačka

Cena plodu (`game/pricing.ts`) počítá stejně jako hra:

```
cena = round( baseSellPrice × velikost × mutace × přátelé )
velikost = 1 + (maxSizeMultiplier − 1) × (size − 50) / 50      size 50–100
mutace   = barva × (počasí + světlo − počet_přítomných + 1)
           barva  = nejlepší ze skupiny Growth (Gold 25, Rainbow 50)
           počasí = nejlepší z Hydro; Wet + Chilled zároveň = Frozen
           světlo = nejlepší z Lunar
přátelé  = 1 + 0,1 × (hráčů − 1), hráčů 1–6
```

Mutace se poznají podle klíče i jména (`Ambershine` = `Amberlit`). Neznámý druh má
cenu 0. Vzorec je zjištěný z Aries Mod, kód je vlastní.

- **Katalog** (`data/catalog.ts`) – rostliny, mutace a mazlíčci (co jedí, plná sytost) – je snímek veřejného API `mg-api.ariedam.fr`
  v `data/catalog-data.json`. Za běhu se nic nestahuje; obnova:
  `node scripts/update-catalog.mjs`.
- **Hodnota pole** (`game/value.ts`) – zralé, podle filtrů sklizně, celé pole
  (velikost a mutace rostoucích plodů jsou dané už při zasazení) a batoh.
- **Doby růstu** (`game/growtimes.ts`) – katalog zná jen dozrání víckrát
  sklízených rostlin, doba dozrání plodu se proto učí z `endTime − startTime`
  plodů na poli (každou sekundu v `tick()`), localStorage `mg-autofarm-growtimes`.
- **Zisk** (`game/profit.ts`) – tržba = rostlin × sklizní × plodů na sklizeň × cena,
  náklad = rostlin × cena semínka (jednou za rostlinu), doba = růst + (sklizní − 1) × dorůstání.
  Záložka Kalkulačka (`ui/tabs/calc.ts`) drží svůj stav v `ui/calc/state.ts`
  a formulář váže přes `data-c` (ne `data-k`, to je nastavení).

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
