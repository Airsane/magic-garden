# Magic Garden – Auto Farm

Tampermonkey userscript pro [Magic Garden](https://magicgarden.gg): automatická sklizeň,
sázení a krmení mazlíčků, mapa zahrady, statistiky a upozornění. Ovládá se plovoucím
panelem ve hře (**Alt+H** ho skryje / zobrazí).

> ⚠️ Nekombinuj s Arie's Mod – oba přečíslovávají příkazy na stejném socketu.

## Instalace (pro hráče)

1. Sestav skript (viz níže), nebo vezmi hotový `dist/mg-autoharvest.user.js`.
2. V Tampermonkey: *Dashboard → Utilities → Import from file*, nebo soubor přetáhni do prohlížeče.
3. Otevři hru (`https://magicgarden.gg/r/...`) – vpravo nahoře se objeví panel 🌻 Auto Farm.

## Build

Potřeba: Node.js 20+ a npm.

```bash
./build.sh
```

Výsledek: `dist/mg-autoharvest.user.js` (jeden soubor i s hlavičkou `==UserScript==`).

| Příkaz | Co dělá |
| --- | --- |
| `./build.sh` | nainstaluje závislosti (poprvé), zkontroluje typy a cyklické importy, sestaví |
| `./build.sh --watch` | sestavuje při každé změně v `src/` (bez kontrol) |
| `./build.sh --minify` | zmenšený výstup |
| `./build.sh --no-check` | jen build, bez kontrol |
| `npm run typecheck` | jen kontroly |

## Vývoj

Pohodlný postup bez neustálého kopírování do Tampermonkey:

1. V nastavení rozšíření Tampermonkey povol **Allow access to file URLs**.
2. Vytvoř v Tampermonkey „vývojový“ skript, který jen načte lokální build:

   ```js
   // ==UserScript==
   // @name         Magic Garden – Auto Farm (dev)
   // @match        https://magicgarden.gg/r/*
   // @match        https://magiccircle.gg/r/*
   // @match        https://starweaver.org/r/*
   // @run-at       document-start
   // @inject-into  page
   // @grant        none
   // @require      file:///CESTA/K/PROJEKTU/dist/mg-autoharvest.user.js
   // ==/UserScript==
   ```

3. Spusť `./build.sh --watch` a po každé změně jen obnov stránku hry (F5).

Vydání nové verze: zvyš `version` v `package.json` (propíše se do hlavičky i do logu
v konzoli) a spusť `./build.sh`. Metadata hlavičky (`@match`, `@run-at`…) jsou
v [`scripts/meta.mjs`](scripts/meta.mjs).

## Struktura

```
build.sh                 vstupní bod buildu
scripts/
  build.mjs              esbuild: src/main.ts → dist/mg-autoharvest.user.js
  meta.mjs               hlavička ==UserScript==
  check-cycles.mjs       kontrola cyklických importů
src/
  main.ts                start: hook socketu → anti-AFK → UI → časovač
  config.ts              nastavení (typy, výchozí hodnoty, localStorage)
  state.ts               sdílený běhový stav + most k UI (renderLive)
  stats.ts               statistiky relace a celkové
  log.ts                 log událostí
  notify.ts              toast, pípnutí, systémová oznámení, hlídání mutací
  env.ts                 okno stránky, console log
  net/
    socket.ts            obalení WebSocketu, číslování commandSequence, sendCommand
    commands.ts          herní příkazy (HarvestCrop, PlantSeed, FeedPet, SellAllCrops)
    keepalive.ts         držení spojení na pozadí (anti-AFK)
    visibility.ts        skutečná viditelnost záložky, důvod odpojení
  game/
    store.ts             nalezení jotai store hry, readAtom()
    reader.ts            readGame() – snímek stavu hry z atomů
    garden.ts            plody, zralost, filtry sklizně, souhrn zahrady
    pets.ts              katalog mazlíčků, převod dat mazlíčků
  farm/
    loop.ts              hlavní kolo (sklizeň → krmení → prodej → sázení), časovač
    harvest.ts           sklizeň
    plant.ts             sázení
    feed.ts              krmení
  ui/
    panel.ts             kostra panelu, přepínače, záložky, vykreslování, tick
    tab.ts               rozhraní záložky (TabView)
    tabs/*.ts            jednotlivé záložky (Přehled, Zahrada, Sklizeň, Sázení, Mazlíčci, Log)
    fields.ts            navázání formulářů (data-k, data-run) na nastavení
    chips.ts             klikací štítky druhů
    templates.ts         HTML šablony (row, tile, bars, spark…)
    styles.css           styly panelu
```

Jak to funguje uvnitř (protokol, jotai store, pravidla mezi moduly, jak přidat
nastavení nebo záložku): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
