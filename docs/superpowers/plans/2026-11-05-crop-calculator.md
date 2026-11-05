# Kalkulačka plodin – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cena plodů podle vzorce hry, hodnota pole a batohu v panelu a nová záložka „🧮 Kalkulačka“ pro výpočet zisku a žebříček plodin.

**Architecture:** Čistá logika bez DOM v `src/data/` (katalog) a `src/game/` (cena, hodnota pole, doby růstu, zisk) – testovaná vitestem. UI jen skládá výsledky: nová záložka `src/ui/tabs/calc.ts` se stavem v `src/ui/calc/state.ts`, rozšíření záložek Přehled a Zahrada. Katalog je JSON snímek veřejného API přibalený do bundlu.

**Tech Stack:** TypeScript 7 (strict), esbuild 0.28, vitest 5.1 (nová devDependency), Node 24.

**Spec:** [docs/superpowers/specs/2026-11-05-crop-calculator-design.md](../specs/2026-11-05-crop-calculator-design.md)

## Global Constraints

- Žádné nové runtime závislosti; jediná nová devDependency je `vitest@5.1.0`.
- Skript za běhu hry nesmí dělat síťové požadavky – katalog je přibalený `src/data/catalog.json`.
- Kód Aries Mod se nekopíruje (repo nemá licenci); vzorce se implementují vlastním kódem podle specu.
- Texty v UI česky, přesně podle kroků níže; identifikátory anglicky; komentáře česky v hustotě okolního kódu.
- `./build.sh` musí projít: `tsc --noEmit`, `scripts/check-cycles.mjs` a nově i `vitest run`.
- Moduly v `src/data/` a `src/game/pricing.ts`, `value.ts`, `profit.ts`, `growtimes.ts` nesmí za běhu importovat nic z `src/ui/` ani `state.ts`.
- HTML z dat (jména druhů) vždy přes `esc()`.

## Review Focus

1. **Mutace z dat hry jako klíč, ne jméno** (`Ambershine`, `Dawncharged`, `Ambercharged`) – cena musí být stejná jako pro `Amberlit`/`Dawnbound`/`Amberbound`. Test: Task 2 `accepts catalog keys as mutation names`.
2. **Druh, který ve snímku katalogu chybí** (nová rostlina ve hře) – cena 0, hodnota pole ho přeskočí, kalkulačka ukáže „–“, žádné `NaN`. Testy: Task 2 `unknown species is worth 0`, Task 5 `unknown species gives nulls`.
3. **Nesmyslné vstupy kalkulačky** (velikost 30, 0 rostlin, prázdné nebo záporné minuty, 9 hráčů) – omezí se na platný rozsah, prázdný čas = neznámý. Test: Task 6 `clamps and converts inputs`.
4. **Víckrát sklízená rostlina bez známé doby dorůstání** – zisk za hodinu „–“, ne `Infinity`. Test: Task 5 `missing regrow time gives null per hour`.
5. **Plod v batohu bez `size`** – ocení se jako velikost 50 (minimum), ne 0 ani 100. Test: Task 3 `inventory item without size is valued at size 50`.

---

### Task 1: Katalog a testovací nástroje

**Files:**
- Create: `scripts/update-catalog.mjs`, `src/data/catalog.json` (generovaný), `src/data/catalog.ts`, `test/catalog.test.ts`, `vitest.config.ts`
- Modify: `package.json` (devDependency `vitest@5.1.0`, script `"test": "vitest run"`, `typecheck` beze změny), `tsconfig.json` (`"include": ["src", "test"]`, `"resolveJsonModule": true`), `build.sh` (v bloku kontrol po check-cycles: `echo "→ Testy"` + `npx --no-install vitest run`), `README.md` (tabulka příkazů: `npm test`; sekce „Aktualizace katalogu“: `node scripts/update-catalog.mjs`)

**Interfaces:**
- Produces (`src/data/catalog.ts`):
  ```ts
  export type HarvestType = "Single" | "Multiple";
  export type MutationGroup = "Growth" | "Hydro" | "Lunar";
  export interface PlantInfo {
    species: string;          // klíč katalogu, např. "Carrot"
    name: string;             // crop.name, např. "Carrot"
    seedPrice: number | null; // seed.coinPrice; 0 nebo chybí → null
    sellPrice: number;        // crop.baseSellPrice
    maxSize: number;          // crop.maxSizeMultiplier (chybí → 1)
    harvest: HarvestType;
    slots: number;            // plant.growSlots.length, Single = 1
    secondsToMature: number | null; // plant.secondsToMature
  }
  export interface MutationInfo { key: string; name: string; group: MutationGroup; mult: number }
  export function plantInfo(species: string): PlantInfo | null;     // bez ohledu na velikost písmen
  export function allPlants(): PlantInfo[];                         // seřazené podle name
  export function mutationInfo(keyOrName: string): MutationInfo | null; // klíč i jméno, bez ohledu na velikost písmen
  ```
- JSON tvar: `{ "source": string, "fetchedAt": string, "plants": Record<string, PlantInfo>, "mutations": Record<string, MutationInfo> }` – skript ukládá už normalizované `PlantInfo`/`MutationInfo` (bez spritů a dalších polí).

- [ ] **Step 1: Nainstaluj vitest a nastav ho**

Run: `npm install --save-dev vitest@5.1.0`
`vitest.config.ts`: `include: ["test/**/*.test.ts"]`, `environment: "node"`, a `define: { __VERSION__: '"test"' }`.
Expected: `package.json` má `"vitest": "^5.1.0"`; `npx vitest --version` vypíše 5.1.0.

- [ ] **Step 2: Napiš `scripts/update-catalog.mjs` a vygeneruj snímek**

Stáhne `https://mg-api.ariedam.fr/data/plants` a `/data/mutations` (`fetch`, při HTTP chybě skončí s kódem 1 a nic nepřepíše), převede na tvar výše (rostliny bez `crop.baseSellPrice` vynechá; `group` mimo tři známé skupiny vynechá) a zapíše `src/data/catalog.json` (2 mezery, klíče v pořadí API).
Run: `node scripts/update-catalog.mjs`
Expected: vypíše `73 rostlin, 11 mutací → src/data/catalog.json` (počty podle aktuálního API; k 2026-11-05 73 a 11).

- [ ] **Step 3: Napiš failing test `test/catalog.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { allPlants, mutationInfo, plantInfo } from "../src/data/catalog";

describe("catalog", () => {
  it("reads a single-harvest plant", () => {
    expect(plantInfo("Carrot")).toEqual({ species: "Carrot", name: "Carrot", seedPrice: 10, sellPrice: 20, maxSize: 3, harvest: "Single", slots: 1, secondsToMature: null });
  });
  it("reads a multi-harvest plant", () => {
    expect(plantInfo("Apple")).toMatchObject({ seedPrice: 500, sellPrice: 800, maxSize: 2, harvest: "Multiple", slots: 7, secondsToMature: 79200 });
  });
  it("is case-insensitive and returns null for unknown", () => {
    expect(plantInfo("carrot")?.species).toBe("Carrot");
    expect(plantInfo("Nope")).toBeNull();
  });
  it("finds mutations by key and by name", () => {
    expect(mutationInfo("Ambershine")).toEqual({ key: "Ambershine", name: "Amberlit", group: "Lunar", mult: 6 });
    expect(mutationInfo("amberlit")?.key).toBe("Ambershine");
    expect(mutationInfo("Gold")).toMatchObject({ group: "Growth", mult: 25 });
    expect(mutationInfo("Foo")).toBeNull();
  });
  it("lists plants sorted by name", () => {
    const names = allPlants().map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
```

- [ ] **Step 4: Spusť test**

Run: `npx vitest run test/catalog.test.ts`
Expected: FAIL – nelze importovat `../src/data/catalog`.

- [ ] **Step 5: Implementuj `src/data/catalog.ts`**

`import data from "./catalog.json"`; indexy (lowercase species → PlantInfo, lowercase key i name → MutationInfo) postav jednou při načtení modulu.

- [ ] **Step 6: Spusť testy a build**

Run: `npx vitest run && ./build.sh`
Expected: 5/5 pass; build projde včetně nového kroku „→ Testy“.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts build.sh README.md scripts/update-catalog.mjs src/data test/catalog.test.ts
git commit -m "feat: přibalený katalog rostlin a mutací + vitest"
```

### Task 2: Cena plodu

**Files:**
- Create: `src/game/pricing.ts`, `test/pricing.test.ts`

**Interfaces:**
- Consumes: `plantInfo`, `mutationInfo` z Task 1.
- Produces:
  ```ts
  export const SIZE_MIN = 50, SIZE_MAX = 100;
  export function clampSize(size: unknown): number;        // round, omezit 50–100, nečíselné → 50
  export function clampPlayers(players: unknown): number;  // floor, omezit 1–6, nečíselné → 1
  export function sizeMultiplier(maxSize: number, size: number): number;
  export function mutationMultiplier(mutations: readonly string[]): number;
  export function friendMultiplier(players: number): number;
  export function cropValue(species: string, size: number, mutations?: readonly string[], players?: number): number; // zaokrouhleno, neznámý druh → 0
  ```

- [ ] **Step 1: Napiš failing test `test/pricing.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { clampPlayers, clampSize, cropValue, mutationMultiplier } from "../src/game/pricing";

describe("cropValue", () => {
  it("scales with size", () => {
    expect(cropValue("Carrot", 50)).toBe(20);
    expect(cropValue("Carrot", 75)).toBe(40);
    expect(cropValue("Carrot", 100)).toBe(60);
    expect(cropValue("Carrot", 51)).toBe(21);   // 20 × 1.04 = 20.8
    expect(cropValue("Apple", 100)).toBe(1600);
  });
  it("takes the best color mutation", () => {
    expect(cropValue("Carrot", 50, ["Gold"])).toBe(500);
    expect(cropValue("Carrot", 50, ["Gold", "Rainbow"])).toBe(1000);
  });
  it("combines weather and lunar", () => {
    expect(cropValue("Carrot", 50, ["Wet"])).toBe(40);
    expect(cropValue("Carrot", 50, ["Wet", "Chilled"])).toBe(120);          // = Frozen
    expect(cropValue("Carrot", 50, ["Wet", "Thunderstruck"])).toBe(100);    // nejvyšší Hydro
    expect(cropValue("Carrot", 50, ["Frozen", "Amberlit"])).toBe(220);      // 6 + 6 − 1
    expect(cropValue("Carrot", 50, ["Gold", "Frozen", "Amberbound"])).toBe(7500); // 25 × 15
  });
  it("accepts catalog keys as mutation names", () => {
    expect(cropValue("Carrot", 50, ["Ambershine"])).toBe(cropValue("Carrot", 50, ["Amberlit"]));
    expect(cropValue("Carrot", 50, ["Ambercharged"])).toBe(200);
    expect(cropValue("Carrot", 50, ["dawncharged"])).toBe(140);
  });
  it("applies the friend bonus", () => {
    expect(cropValue("Carrot", 50, [], 3)).toBe(24);
    expect(cropValue("Carrot", 50, [], 9)).toBe(30);
    expect(cropValue("Carrot", 50, [], 0)).toBe(20);
  });
  it("unknown species is worth 0, unknown mutation is ignored", () => {
    expect(cropValue("Nope", 80)).toBe(0);
    expect(cropValue("Carrot", 50, ["Foo"])).toBe(20);
    expect(mutationMultiplier([])).toBe(1);
  });
  it("clamps inputs", () => {
    expect(clampSize(30)).toBe(50);
    expect(clampSize(120)).toBe(100);
    expect(clampSize("x")).toBe(50);
    expect(clampPlayers(NaN)).toBe(1);
    expect(clampPlayers(4.7)).toBe(4);
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx vitest run test/pricing.test.ts`
Expected: FAIL – modul `../src/game/pricing` neexistuje.

- [ ] **Step 3: Implementuj `src/game/pricing.ts`**

Vzorec přesně podle specu (bod 1). Mutace nejdřív převeď přes `mutationInfo` na `{group, name, mult}`; pokud jsou přítomné `Wet` i `Chilled` (podle jména), přidej do kandidátů Hydro `Frozen` (`mutationInfo("Frozen")`) a Wet/Chilled z kandidátů vyřaď.

- [ ] **Step 4: Spusť testy**

Run: `npx vitest run`
Expected: všechny pass (catalog 5, pricing 7).

- [ ] **Step 5: Commit**

```bash
git add src/game/pricing.ts test/pricing.test.ts
git commit -m "feat: výpočet ceny plodu podle vzorce hry"
```

### Task 3: Hodnota pole a batohu

**Files:**
- Create: `src/game/value.ts`, `test/value.test.ts`
- Modify: `src/game/reader.ts` (`GameSnapshot.players: number`, čte `readAtom<number>("numPlayersAtom")`, uloží `clampPlayers(...)`), `src/state.ts` (`emptyGame()` doplní `players: 1`)

**Interfaces:**
- Consumes: `cropValue`, `clampPlayers` (Task 2); `allSlots`, `isRipe`, `Crop`, `Tiles` z `src/game/garden.ts`; `CropItem` z `src/game/reader.ts`.
- Produces:
  ```ts
  export interface GardenValue {
    ripe: number; total: number; eligible: number;
    ripeCount: number; totalCount: number;
    bySpecies: Record<string, { ripe: number; total: number }>;
  }
  export function gardenValue(tiles: Tiles | null, players: number, now: number, isEligible?: (c: Crop) => boolean): GardenValue;
  // eligible = součet zralých, pro které isEligible vrátí true (bez predikátu = ripe)
  export function inventoryValue(items: readonly CropItem[], players: number): number;
  // size: Number.isFinite(size) ? size : 50
  ```
  `GameSnapshot` získá pole `players: number` (1–6).

- [ ] **Step 1: Napiš failing test `test/value.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gardenValue, inventoryValue } from "../src/game/value";

const NOW = 1_000_000;
const tiles = {
  0: { objectType: "plant", species: "Carrot", slots: [
    { species: "Carrot", startTime: 0, endTime: NOW - 1, size: 100 },
    { species: "Carrot", startTime: 0, endTime: NOW + 60_000, size: 50, mutations: ["Gold"] },
  ] },
  1: { objectType: "decor" },
  2: null,
};

describe("gardenValue", () => {
  it("sums ripe and all crops", () => {
    expect(gardenValue(tiles, 1, NOW)).toEqual({
      ripe: 60, total: 560, eligible: 60, ripeCount: 1, totalCount: 2,
      bySpecies: { Carrot: { ripe: 60, total: 560 } },
    });
  });
  it("applies players and the eligibility filter", () => {
    const v = gardenValue(tiles, 2, NOW, () => false);
    expect(v.ripe).toBe(66);
    expect(v.total).toBe(616);
    expect(v.eligible).toBe(0);
  });
  it("handles an empty garden", () => {
    expect(gardenValue(null, 1, NOW).total).toBe(0);
  });
});

describe("inventoryValue", () => {
  it("sums known crops and skips unknown species", () => {
    expect(inventoryValue([
      { species: "Carrot", size: 100 },
      { species: "Carrot", size: 50, mutations: ["Wet"] },
      { species: "Nope", size: 80 },
    ], 1)).toBe(100);
  });
  it("inventory item without size is valued at size 50", () => {
    expect(inventoryValue([{ species: "Carrot" }], 1)).toBe(20);
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx vitest run test/value.test.ts`
Expected: FAIL – modul `../src/game/value` neexistuje.

- [ ] **Step 3: Implementuj `src/game/value.ts` a doplň `players` do `reader.ts` + `state.ts`**

- [ ] **Step 4: Spusť testy a typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: vše pass, tsc bez chyb.

- [ ] **Step 5: Commit**

```bash
git add src/game/value.ts src/game/reader.ts src/state.ts test/value.test.ts
git commit -m "feat: hodnota pole a batohu, počet hráčů v místnosti"
```

### Task 4: Učení dob růstu

**Files:**
- Create: `src/game/growtimes.ts`, `test/growtimes.test.ts`

**Interfaces:**
- Consumes: `Tiles` z `garden.ts`; `readLS`, `writeLS` z `config.ts`; `plantInfo` (Task 1).
- Produces:
  ```ts
  export function observeGrowTimes(tiles: Tiles | null): void; // pro každý plod s endTime > startTime uloží (end − start)/1000 zaokrouhleno pod jeho druh; poslední pozorování vyhrává; ukládá jen při změně
  export function observedSeconds(species: string): number | null;
  export function defaultTimes(species: string): { grow: number | null; regrow: number | null };
  // Single:   grow = observed, regrow = null
  // Multiple: grow = plantInfo.secondsToMature ?? observed, regrow = observed
  // neznámý druh: obojí null
  export function resetGrowTimes(): void; // jen pro testy a „↺“ v UI – vymaže paměť i localStorage
  ```
  localStorage klíč: `"mg-autofarm-growtimes"`, hodnota `Record<string, number>` (sekundy).

- [ ] **Step 1: Napiš failing test `test/growtimes.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { defaultTimes, observeGrowTimes, observedSeconds, resetGrowTimes } from "../src/game/growtimes";

const plant = (species: string, startTime: number, endTime: number) =>
  ({ objectType: "plant", species, slots: [{ species, startTime, endTime }] });

describe("grow times", () => {
  beforeEach(() => resetGrowTimes());
  it("learns slot durations in seconds", () => {
    observeGrowTimes({ 0: plant("Carrot", 1000, 61_000) });
    expect(observedSeconds("Carrot")).toBe(60);
  });
  it("ignores slots without a valid range and keeps the latest", () => {
    observeGrowTimes({ 0: plant("Carrot", 5000, 5000) });
    expect(observedSeconds("Carrot")).toBeNull();
    observeGrowTimes({ 0: plant("Carrot", 0, 30_000) });
    observeGrowTimes({ 0: plant("Carrot", 0, 90_000) });
    expect(observedSeconds("Carrot")).toBe(90);
  });
  it("builds defaults from catalog and observations", () => {
    expect(defaultTimes("Carrot")).toEqual({ grow: null, regrow: null });
    observeGrowTimes({ 0: plant("Carrot", 0, 60_000), 1: plant("Apple", 0, 3_600_000) });
    expect(defaultTimes("Carrot")).toEqual({ grow: 60, regrow: null });
    expect(defaultTimes("Apple")).toEqual({ grow: 79200, regrow: 3600 });
    expect(defaultTimes("Nope")).toEqual({ grow: null, regrow: null });
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx vitest run test/growtimes.test.ts`
Expected: FAIL – modul neexistuje.

- [ ] **Step 3: Implementuj `src/game/growtimes.ts`**

- [ ] **Step 4: Spusť testy**

Run: `npx vitest run`
Expected: vše pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/growtimes.ts test/growtimes.test.ts
git commit -m "feat: učení dob růstu plodin ze zahrady"
```

### Task 5: Výpočet zisku a žebříček

**Files:**
- Create: `src/game/profit.ts`, `test/profit.test.ts`

**Interfaces:**
- Consumes: `plantInfo`, `allPlants` (Task 1); `cropValue` (Task 2).
- Produces:
  ```ts
  export interface ProfitInput {
    species: string; size: number; mutations: readonly string[]; players: number;
    plants: number;              // ≥ 1
    harvests: number;            // ≥ 1; u Single se vždy počítá 1
    growSeconds: number | null;
    regrowSeconds: number | null;
  }
  export interface ProfitResult {
    pricePerCrop: number | null; // null = neznámý druh
    cropsPerHarvest: number; seedCost: number | null; harvests: number;
    revenue: number; cost: number; profit: number;
    seconds: number | null; profitPerHour: number | null;
  }
  export function profitEstimate(input: ProfitInput): ProfitResult;
  export interface RankRow { species: string; name: string; profit: number; profitPerHour: number }
  export function rankPlants(
    opts: { size: number; mutations: readonly string[]; players: number; harvests: number },
    timesOf: (species: string) => { grow: number | null; regrow: number | null },
  ): RankRow[]; // plants = 1; jen řádky se známým profitPerHour; seřazeno sestupně podle profitPerHour
  ```
  `seconds = harvests === 1 ? growSeconds : (growSeconds != null && regrowSeconds != null ? growSeconds + (harvests − 1) × regrowSeconds : null)`; `profitPerHour = seconds > 0 ? profit / seconds × 3600 : null`.

- [ ] **Step 1: Napiš failing test `test/profit.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { profitEstimate, rankPlants } from "../src/game/profit";

const base = { mutations: [], players: 1, plants: 1, harvests: 1, growSeconds: null, regrowSeconds: null };

describe("profitEstimate", () => {
  it("computes a single-harvest batch", () => {
    expect(profitEstimate({ ...base, species: "Carrot", size: 100, plants: 10, growSeconds: 600 })).toEqual({
      pricePerCrop: 60, cropsPerHarvest: 1, seedCost: 10, harvests: 1,
      revenue: 600, cost: 100, profit: 500, seconds: 600, profitPerHour: 3000,
    });
  });
  it("forces one harvest for single-harvest plants", () => {
    expect(profitEstimate({ ...base, species: "Carrot", size: 50, harvests: 5, growSeconds: 60 }).harvests).toBe(1);
  });
  it("computes a multi-harvest plant over several harvests", () => {
    const r = profitEstimate({ ...base, species: "Apple", size: 50, harvests: 3, growSeconds: 79200, regrowSeconds: 3600 });
    expect(r).toMatchObject({ pricePerCrop: 800, cropsPerHarvest: 7, revenue: 16800, cost: 500, profit: 16300, seconds: 86400 });
    expect(r.profitPerHour).toBeCloseTo(679.1667, 3);
  });
  it("missing regrow time gives null per hour", () => {
    const r = profitEstimate({ ...base, species: "Apple", size: 50, harvests: 3, growSeconds: 79200 });
    expect(r.seconds).toBeNull();
    expect(r.profitPerHour).toBeNull();
    expect(profitEstimate({ ...base, species: "Apple", size: 50, growSeconds: 79200 }).seconds).toBe(79200);
  });
  it("unknown species gives nulls", () => {
    expect(profitEstimate({ ...base, species: "Nope", size: 80, growSeconds: 60 })).toMatchObject({
      pricePerCrop: null, seedCost: null, revenue: 0, cost: 0, profit: 0,
    });
  });
});

describe("rankPlants", () => {
  it("ranks only plants with a known time, best first", () => {
    const times: Record<string, number> = { Carrot: 60, Aloe: 600 };
    const rows = rankPlants({ size: 50, mutations: [], players: 1, harvests: 1 },
      (sp) => ({ grow: times[sp] ?? null, regrow: null }));
    expect(rows.map((r) => r.species)).toEqual(["Aloe", "Carrot"]); // (310−135)/600·3600 = 1050 > (20−10)/60·3600 = 600
    expect(rows[0]).toMatchObject({ name: "Aloe", profit: 175, profitPerHour: 1050 });
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx vitest run test/profit.test.ts`
Expected: FAIL – modul neexistuje.

- [ ] **Step 3: Implementuj `src/game/profit.ts`**

- [ ] **Step 4: Spusť testy**

Run: `npx vitest run`
Expected: vše pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/profit.ts test/profit.test.ts
git commit -m "feat: výpočet zisku a žebříček plodin"
```

### Task 6: Záložka Kalkulačka

**Files:**
- Create: `src/ui/calc/state.ts`, `src/ui/tabs/calc.ts`, `test/calc-state.test.ts`
- Modify: `src/config.ts` (typ `Tab` + `"calc"`), `src/ui/panel.ts` (`TABS`: `calc: calcTab` mezi `pets` a `log`), `src/ui/styles.css` (jen pokud je potřeba nový styl – např. `#mgaf input[type=range]{width:100%}`)

**Interfaces:**
- Consumes: `profitEstimate`, `rankPlants`, `ProfitInput` (Task 5); `defaultTimes`, `resetGrowTimes` (Task 4); `allPlants`, `plantInfo` (Task 1); `clampSize`, `clampPlayers` (Task 2); `state.game.players` (Task 3); `TabView`, `row`, `tile`, `esc`, `fmt`, `fmtShort`, `dur` (existující UI).
- Produces (`src/ui/calc/state.ts`, bez DOM):
  ```ts
  export interface CalcState {
    species: string; size: number;
    color: string; hydro: string; lunar: string;   // "" = žádná, jinak jméno mutace z katalogu
    players: number | null;                        // null = vzít z hry
    plants: number; harvests: number;
    growMin: number | null; regrowMin: number | null; // null = výchozí z defaultTimes
  }
  export const calc: CalcState; // jeden sdílený stav, výchozí: species = první z allPlants(), size 100, mutace "", players null, plants 1, harvests 1, časy null
  export function toProfitInput(s: CalcState, gamePlayers: number): ProfitInput;
  // size → clampSize; players → clampPlayers(s.players ?? gamePlayers); plants/harvests → max(1, floor) (NaN → 1);
  // minuty → sekundy (×60, zaokrouhlit); null/NaN/≤0 → defaultTimes(species).grow / .regrow
  // mutations = [color, hydro, lunar] bez prázdných
  ```

- [ ] **Step 1: Napiš failing test `test/calc-state.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetGrowTimes } from "../src/game/growtimes";
import { toProfitInput, type CalcState } from "../src/ui/calc/state";

const s = (over: Partial<CalcState>): CalcState => ({
  species: "Carrot", size: 100, color: "", hydro: "", lunar: "", players: null,
  plants: 1, harvests: 1, growMin: null, regrowMin: null, ...over,
});

describe("toProfitInput", () => {
  beforeEach(() => resetGrowTimes());
  it("converts minutes and collects mutations", () => {
    expect(toProfitInput(s({ color: "Gold", lunar: "Amberlit", growMin: 10, plants: 4 }), 2)).toEqual({
      species: "Carrot", size: 100, mutations: ["Gold", "Amberlit"], players: 2,
      plants: 4, harvests: 1, growSeconds: 600, regrowSeconds: null,
    });
  });
  it("clamps and converts inputs", () => {
    const r = toProfitInput(s({ size: 30, players: 9, plants: 0, harvests: NaN, growMin: -5 }), 1);
    expect(r).toMatchObject({ size: 50, players: 6, plants: 1, harvests: 1, growSeconds: null });
  });
  it("falls back to catalog times", () => {
    expect(toProfitInput(s({ species: "Apple" }), 1).growSeconds).toBe(79200);
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx vitest run test/calc-state.test.ts`
Expected: FAIL – modul `../src/ui/calc/state` neexistuje.

- [ ] **Step 3: Implementuj `src/ui/calc/state.ts`**

- [ ] **Step 4: Spusť testy**

Run: `npx vitest run`
Expected: vše pass.

- [ ] **Step 5: Implementuj `src/ui/tabs/calc.ts` (`calcTab: TabView`, icon `"🧮"`, title `"Kalkulačka"`)**

Formulářové prvky používají `data-c="<pole CalcState>"` (ne `data-k` – to je vázané na nastavení); `bindForm` je naváže na `calc` a po změně zavolá `renderLive()` ze `state.ts`. Prázdné číselné pole = `null`. Výběr druhu: `<select data-c="species">` ze `allPlants()` (text = `name`). Při změně druhu se `growMin`/`regrowMin` vynulují na `null` a formulář se překreslí (aby placeholdery ukázaly nové výchozí časy).
`form` přesně v tomto pořadí a s těmito texty:
- `<h4>Plodina</h4>`, select „Plodina“, číslo „Velikost (50–100)“
- `<h4>Mutace</h4>`, selecty „Barva“ (Žádná, Gold, Rainbow), „Počasí“ (Žádné, Wet, Chilled, Frozen, Thunderstruck, Thundercharged), „Světlo“ (Žádné, Dawnlit, Amberlit, Dawnbound, Amberbound)
- `<h4>Pěstování</h4>`, čísla „Hráčů v místnosti (1–6)“ (placeholder = `state.game.players`), „Počet rostlin“, „Počet sklizní“ (jen u druhů `harvest === "Multiple"`), „Doba růstu (min)“, „Doba dorůstání (min)“ (jen u Multiple); placeholdery časů = výchozí časy v minutách nebo „?“
- tlačítko `<button class="btn sec" data-calc-reset>↺ Zapomenout naučené časy</button>` → `resetGrowTimes()` + překreslení formuláře

`live` vykreslí:
- `<h4>Výsledek</h4>`, `grid` se třemi `tile`: `fmtShort(pricePerCrop)` „🪙 za plod“, `fmtShort(profit)` „zisk“, `fmtShort(profitPerHour)` „🪙 / hod“
- řádky: „Plodů na sklizeň“, „Cena semínka“, „Tržba“, „Náklady na semínka“, „Zisk“, „Doba“ (`dur(seconds×1000)` nebo „? – doplň dobu růstu“), „Zisk za hodinu“
- `<h4>Žebříček · zisk za hodinu</h4>` – top 10 z `rankPlants` (velikost/mutace/hráči/sklizně z kalkulačky, časy z `defaultTimes`) jako `row(esc(name), fmtShort(profitPerHour) + " / h")`, prázdný žebříček: `<div class="muted">Zatím neznám žádné doby růstu – zasaď něco a chvíli počkej.</div>`
- poznámka `<div class="muted" style="font-size:10.5px">Doby růstu se učí z tvé zahrady. Druhy, které jsi ještě nesázel, v žebříčku chybí.</div>`

- [ ] **Step 6: Přidej záložku do `Tab` a `TABS`, build**

Run: `./build.sh`
Expected: typecheck, cykly, testy i build projdou.

- [ ] **Step 7: Commit**

```bash
git add src/ui/calc src/ui/tabs/calc.ts src/config.ts src/ui/panel.ts src/ui/styles.css test/calc-state.test.ts
git commit -m "feat: záložka Kalkulačka (zisk a žebříček plodin)"
```

### Task 7: Hodnota pole v panelu, učení časů, dokumentace, verze

**Files:**
- Modify: `src/ui/panel.ts` (`tick()`: `if (game.tiles) observeGrowTimes(game.tiles)`), `src/ui/tabs/overview.ts`, `src/ui/tabs/garden.ts`, `docs/ARCHITECTURE.md`, `README.md`, `package.json` (`version` → `2.3.0`)

**Interfaces:**
- Consumes: `gardenValue`, `inventoryValue` (Task 3); `observeGrowTimes` (Task 4); `harvestable` z `garden.ts` jako predikát `isEligible`.

- [ ] **Step 1: Přehled** – za řádek „Plodiny v batohu“ přidej (hodnoty `fmtShort`, bez dat „–“):
  „Hodnota zralých na poli“ (`ripe`), „Hodnota celého pole“ (`total`), „Hodnota batohu“ (`inventoryValue(game.cropItems, game.players)`).
- [ ] **Step 2: Zahrada** – za sekci „Stav“ přidej `<h4>Hodnota</h4>` s řádky „Zralé teď“ (`ripe`), „Podle filtrů sklizně“ (`eligible`), „Celé pole (i rostoucí)“ (`total`), „Bonus za hráče“ (`+${(game.players − 1) × 10} %`); a v sekci „Podle druhu“ změň hodnotu řádku na `${v.ripe} / ${v.growing} · ${fmtShort(value.bySpecies[k]?.total)}` a nadpis na „Podle druhu · zralé / roste · hodnota“.
- [ ] **Step 3: Dokumentace** – `docs/ARCHITECTURE.md`: nová sekce „Ceny a kalkulačka“ (vzorec ze specu bodu 1, odkud je katalog a jak ho obnovit, učení dob růstu, klíč `mg-autofarm-growtimes`); do tabulky atomů řádek `numPlayersAtom` → „počet hráčů (bonus za přátele)“. `README.md`: do stromu struktury `src/data/`, `src/game/pricing.ts`, `value.ts`, `growtimes.ts`, `profit.ts`, `src/ui/calc/`, `test/`; do seznamu záložek Kalkulačka.
- [ ] **Step 4: Verze** – `package.json` `"version": "2.3.0"`.
- [ ] **Step 5: Build**

Run: `./build.sh`
Expected: vše projde; hlavička `dist/mg-autoharvest.user.js` má `@version     2.3.0`.

- [ ] **Step 6: Ověření v harnessu**

Mock harness z převodu do TS (falešný WebSocket + jotai store; data: Carrot size 100 zralá, Carrot Gold rostoucí, Apple; `numPlayersAtom: 2`) servírovaný přes `python3 -m http.server` na 127.0.0.1, otevřený ve vestavěném prohlížeči. Zkontroluj:
Expected: Přehled ukazuje „Hodnota zralých na poli“ ≠ „–“; záložka Zahrada má sekci „Hodnota“ s „Bonus za hráče +10 %“; záložka 🧮 Kalkulačka: Carrot 100, 10 rostlin, doba 10 min, hráči z hry (2) → „🪙 za plod“ 66, „Tržba“ 660, „Náklady na semínka“ 100, „Zisk“ 560; změna druhu na Apple ukáže pole „Počet sklizní“; žádné chyby v konzoli.

- [ ] **Step 7: Commit**

```bash
git add src/ui/panel.ts src/ui/tabs/overview.ts src/ui/tabs/garden.ts docs/ARCHITECTURE.md README.md package.json package-lock.json
git commit -m "feat: hodnota pole v panelu, učení dob růstu, v2.3.0"
```
