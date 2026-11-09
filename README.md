# Magic Garden – Auto Farm

Tampermonkey userscript pro [Magic Garden](https://magicgarden.gg): automatická sklizeň,
sázení, nákup semínek, krmení mazlíčků a zápis nových variant do sbírky, mapa zahrady, hodnota pole, kalkulačka zisku, statistiky
a upozornění. Ovládá se plovoucím
panelem ve hře (**Alt+H** ho skryje / zobrazí).

> ⚠️ Nekombinuj s Arie's Mod – oba přečíslovávají příkazy na stejném socketu.

## Instalace (pro hráče)

1. Nainstaluj rozšíření [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge…).
   V Chrome / Edge zapni v nastavení rozšíření **Allow User Scripts** (příp. režim pro vývojáře),
   jinak Tampermonkey skripty nespustí.
2. Otevři odkaz
   **<https://github.com/Airsane/magic-garden/releases/latest/download/mg-autoharvest.user.js>**
   – Tampermonkey ukáže stránku s instalací, klikni **Instalovat**.
3. Otevři hru (`https://magicgarden.gg/r/...`) – vpravo nahoře se objeví panel 🌻 Auto Farm.

### Aktualizace

Skript má v hlavičce `@updateURL` a `@downloadURL` na poslední release, takže se
**aktualizuje sám** – Tampermonkey nové verze kontroluje jednou denně (výchozí nastavení).

- Hned teď: *Tampermonkey → Dashboard → zaškrtni skript → Trigger update*, nebo
  *Utilities → Check for userscript updates*.
- Interval: *Dashboard → Settings → (Config mode: Advanced) → Externals → Update interval*.
- Automatická aktualizace funguje jen u skriptu nainstalovaného z odkazu výše. Starou verzi
  naimportovanou ze souboru smaž a nainstaluj znovu z odkazu (nastavení ve hře zůstane –
  ukládá se v `localStorage` hry, ne ve skriptu).
- Když skript v Tampermonkey ručně upravíš, aktualizace se pro něj vypnou.

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
| `npm run typecheck` | jen kontroly typů a cyklů |
| `npm test` | jen testy (vitest, `test/*.test.ts`) |

## Vydání nové verze

Build a release dělá GitHub Actions (`.github/workflows/release.yml`) po pushnutí tagu:

```bash
npm version 2.6.0 --no-git-tag-version   # nebo ručně upravit "version" v package.json
git commit -am "chore: v2.6.0"
git tag v2.6.0
git push origin main v2.6.0
```

Workflow ověří, že tag odpovídá verzi v `package.json`, spustí kontroly a testy (`./build.sh`)
a vytvoří release s `mg-autoharvest.user.js` a `mg-autoharvest.meta.js`. Hráčům se nová verze
stáhne sama. Kontroly a testy běží i při každém pushi (`.github/workflows/ci.yml`).
Verze z `package.json` se propíše do hlavičky i do logu v konzoli; ostatní metadata hlavičky
(`@match`, `@updateURL`…) jsou v [`scripts/meta.mjs`](scripts/meta.mjs).

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

### Aktualizace katalogu

Ceny plodin, semínek a násobitele mutací jsou ve snímku `src/data/catalog-data.json`
(z veřejného API `mg-api.ariedam.fr`). Po aktualizaci hry ho obnov:

```bash
node scripts/update-catalog.mjs
```

## Struktura

```
build.sh                 vstupní bod buildu
.github/workflows/
  ci.yml                 kontroly a testy při pushi
  release.yml            tag vX.Y.Z → build a GitHub release
scripts/
  build.mjs              esbuild: src/main.ts → dist/mg-autoharvest.user.js (+ .meta.js)
  meta.mjs               hlavička ==UserScript== (vč. @updateURL / @downloadURL)
  check-cycles.mjs       kontrola cyklických importů
  update-catalog.mjs     obnovení katalogu rostlin a mutací z API
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
    commands.ts          herní příkazy (HarvestCrop, PlantSeed, FeedPet, SellAllCrops, PurchaseShopItem, LogItem)
    keepalive.ts         držení spojení na pozadí (anti-AFK)
    visibility.ts        skutečná viditelnost záložky, důvod odpojení
  data/
    catalog.ts           katalog rostlin, mutací a mazlíčků (ceny, sklizeň, co kdo jí)
    catalog-data.json    snímek katalogu (generuje update-catalog.mjs)
  game/
    store.ts             nalezení jotai store hry, readAtom()
    reader.ts            readGame() – snímek stavu hry z atomů
    garden.ts            plody, zralost, filtry sklizně, souhrn zahrady
    pets.ts              převod dat mazlíčků ze hry
    pricing.ts           cena plodu (velikost, mutace, bonus za hráče)
    value.ts             hodnota pole a batohu
    growtimes.ts         doby růstu naučené ze zahrady
    profit.ts            zisk z pěstování, žebříček plodin
    shop.ts              obchod se semínky: sklad, plán nákupu, ověření, příkaz
    journal.ts           deník: chybějící varianty plodů
  farm/
    loop.ts              hlavní kolo (sbírka → sklizeň → krmení → prodej → nákup → sázení), časovač
    harvest.ts           sklizeň
    plant.ts             sázení
    feed.ts              krmení
    buy.ts               nákup semínek jednorázových rostlin
    journal.ts           zápis plodů do sbírky
  ui/
    panel.ts             kostra panelu, přepínače, záložky, vykreslování, tick
    tab.ts               rozhraní záložky (TabView)
    tabs/*.ts            jednotlivé záložky (Přehled, Zahrada, Sklizeň, Sázení, Mazlíčci, Kalkulačka, Log)
    calc/state.ts        stav kalkulačky a převod na vstup výpočtu zisku
    fields.ts            navázání formulářů (data-k, data-run) na nastavení
    chips.ts             klikací štítky druhů
    templates.ts         HTML šablony (row, tile, bars, spark…)
    styles.css           styly panelu
test/                    testy čisté logiky (vitest)
```

Jak to funguje uvnitř (protokol, jotai store, pravidla mezi moduly, jak přidat
nastavení nebo záložku): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
