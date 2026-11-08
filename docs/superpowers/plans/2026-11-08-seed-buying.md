# Nákup semínek – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatický nákup semínek jednorázových rostlin (ne keřů/stromů) do cíle v batohu, s rezervou mincí, před sázením.

**Architecture:** Čistá logika bez DOM v `src/game/shop.ts` (sklad obchodu, plán nákupu, ověření, sestavení příkazu) – testovaná vitestem. `src/farm/buy.ts` ji napojí na snímek hry a socket stejně jako `harvest.ts`/`plant.ts`; `farm/loop.ts` ji zařadí před sázení. UI je nová sekce v záložce Sázení.

**Tech Stack:** TypeScript 7 (strict), esbuild 0.28, vitest 5.1.

**Spec:** [docs/superpowers/specs/2026-11-08-seed-buying-design.md](../specs/2026-11-08-seed-buying-design.md)

## Global Constraints

- Pracuje se na nové větvi `feat/seed-buying` vytvořené z `feat/crop-calculator` (potřebuje `plantInfo().harvest`/`seedPrice`).
- Žádné nové závislosti. `./build.sh` musí projít (tsc, check-cycles, vitest, build).
- Kupují se jen druhy s `plantInfo(sp)?.harvest === "Single"` a `seedPrice != null`; neznámý druh nikdy.
- Výchozí nastavení: `buyOn: false`, `buyTarget: 10`, `buyCoinReserve: 0`, `buyDisabled: []`.
- Texty v UI česky přesně podle kroků; identifikátory anglicky; komentáře česky v hustotě okolního kódu.
- `src/game/shop.ts` nesmí za běhu importovat UI ani `state.ts`.

## Review Focus

1. **Nový restock** – záznam `shopPurchases.seed` z minulého restocku nesmí snížit sklad nového. Test: Task 1 `ignores purchases from an older restock`.
2. **Server nákup odmítne** (mezitím vyprodáno, plný batoh, osobní restock) – nic nepřibude → 0 potvrzeno, pauza 1 min, žádná smyčka nákupů. Test: Task 1 `confirms nothing when the bag did not grow`.
3. **Neznámé mince** (`coins === null`, data se ještě nenačetla) – nekoupit nic. Test: Task 1 `buys nothing when coins are unknown`.
4. **Druh mimo katalog / keř / strom** – nekoupit nikdy, ani když je v obchodě. Test: Task 1 `buys only single-harvest catalog seeds`.
5. **Cíl už splněn** – v batohu je ≥ `buyTarget` → nekoupit. Test: Task 1 `tops up to the bag target`.

---

### Task 1: Logika obchodu

**Files:**
- Create: `src/game/shop.ts`, `test/shop.test.ts`

**Interfaces:**
- Consumes: `plantInfo` z `src/data/catalog.ts`.
- Produces:
  ```ts
  export interface SeedOffer { species: string; remaining: number }
  export interface SeedPurchase { species: string; quantity: number; cost: number }
  export interface BuyOptions {
    coins: number | null; coinReserve: number;
    bag: Record<string, number>;      // semínka v batohu: druh → počet (GameSnapshot.seeds)
    target: number;                   // cíl v batohu od druhu
    disabled: readonly string[];      // S.buyDisabled
    order: readonly string[];         // S.plantOrder – priorita
  }
  export type ShopViewMode = "list" | "grid";
  export function seedOffers(state: unknown, mySlot: unknown): SeedOffer[]; // state = stateAtom, mySlot = myUserSlotAtom; jen remaining > 0, v pořadí obchodu
  export function planSeedPurchases(offers: readonly SeedOffer[], o: BuyOptions): SeedPurchase[];
  export function confirmPurchases(plan: readonly SeedPurchase[], before: Record<string, number>, after: Record<string, number>): Record<string, number>;
  // druh → min(plánováno, max(0, after − before))
  export function readViewMode(storage: Pick<Storage, "length" | "key" | "getItem"> | null): ShopViewMode;
  export function purchaseCommand(species: string, quantity: number, viewMode: ShopViewMode): { type: string } & Record<string, unknown>;
  ```
  Algoritmus `planSeedPurchases`: kandidáti = nabídky s Single + seedPrice + ne v `disabled`; seřadit podle indexu v `order` (chybějící za ně, v pořadí obchodu); rozpočet = `coins − coinReserve`; pro každého `quantity = min(remaining, target − (bag[sp] ?? 0), floor(rozpočet / seedPrice))`, kladné přidat a odečíst `quantity × seedPrice` z rozpočtu. `coins == null` → `[]`.

- [ ] **Step 1: Napiš failing test `test/shop.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { confirmPurchases, planSeedPurchases, purchaseCommand, readViewMode, seedOffers } from "../src/game/shop";

const shopState = (restockId: string | null, inventory: unknown[]) => ({ child: { data: { shops: { seed: { restockId, inventory } } } } });
const slot = (entry: unknown) => ({ data: { shopPurchases: { seed: entry } } });
const opts = { coins: 1e6, coinReserve: 0, bag: {}, target: 10, disabled: [], order: [] };

describe("seedOffers", () => {
  const inv = [{ species: "Carrot", initialStock: 10 }, { species: "Aloe", initialStock: 2 }, { initialStock: 5 }, { species: "Corn" }];
  it("subtracts purchases of the current restock", () => {
    expect(seedOffers(shopState("r2", inv), slot({ restockId: "r2", purchases: { Carrot: 4 } })))
      .toEqual([{ species: "Carrot", remaining: 6 }, { species: "Aloe", remaining: 2 }]);
  });
  it("ignores purchases from an older restock", () => {
    expect(seedOffers(shopState("r2", inv), slot({ restockId: "r1", purchases: { Carrot: 4 } }))[0]).toEqual({ species: "Carrot", remaining: 10 });
  });
  it("counts a legacy entry without restockId and drops sold-out items", () => {
    expect(seedOffers(shopState("r2", inv), slot({ purchases: { Carrot: 3, Aloe: 9 } }))).toEqual([{ species: "Carrot", remaining: 7 }]);
  });
  it("returns nothing for a closed or missing shop", () => {
    expect(seedOffers(shopState(null, inv), null)).toEqual([]);
    expect(seedOffers(undefined, undefined)).toEqual([]);
  });
});

describe("planSeedPurchases", () => {
  it("buys only single-harvest catalog seeds", () => {
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }, { species: "Apple", remaining: 3 }, { species: "Nope", remaining: 3 }, { species: "Aloe", remaining: 2 }], opts))
      .toEqual([{ species: "Carrot", quantity: 5, cost: 50 }, { species: "Aloe", quantity: 2, cost: 270 }]);
  });
  it("tops up to the bag target", () => {
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }], { ...opts, bag: { Carrot: 8 } })).toEqual([{ species: "Carrot", quantity: 2, cost: 20 }]);
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }], { ...opts, bag: { Carrot: 12 } })).toEqual([]);
  });
  it("keeps the coin reserve and follows plant priority", () => {
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }, { species: "Aloe", remaining: 2 }], { ...opts, coins: 300, coinReserve: 100, order: ["Aloe", "Carrot"] }))
      .toEqual([{ species: "Aloe", quantity: 1, cost: 135 }, { species: "Carrot", quantity: 5, cost: 50 }]);
  });
  it("skips disabled species", () => {
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }], { ...opts, disabled: ["Carrot"] })).toEqual([]);
  });
  it("buys nothing when coins are unknown", () => {
    expect(planSeedPurchases([{ species: "Carrot", remaining: 5 }], { ...opts, coins: null })).toEqual([]);
  });
});

describe("confirmPurchases", () => {
  const plan = [{ species: "Carrot", quantity: 5, cost: 50 }, { species: "Aloe", quantity: 2, cost: 270 }];
  it("counts what actually arrived, capped by the plan", () => {
    expect(confirmPurchases(plan, { Carrot: 1 }, { Carrot: 9, Aloe: 1 })).toEqual({ Carrot: 5, Aloe: 1 });
  });
  it("confirms nothing when the bag did not grow", () => {
    expect(confirmPurchases(plan, { Carrot: 3 }, { Carrot: 3 })).toEqual({ Carrot: 0, Aloe: 0 });
  });
});

describe("purchase command", () => {
  const storage = (entries: Record<string, string>) => {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
  };
  it("reads the shop view mode", () => {
    expect(readViewMode(storage({ "shop:room1:seed:viewMode": '"grid"' }))).toBe("grid");
    expect(readViewMode(storage({ "shop:room1:egg:viewMode": '"grid"' }))).toBe("list");
    expect(readViewMode(storage({ "shop:room1:seed:viewMode": "nonsense" }))).toBe("list");
    expect(readViewMode(null)).toBe("list");
  });
  it("builds PurchaseShopItem", () => {
    expect(purchaseCommand("Carrot", 1, "list")).toEqual({ type: "PurchaseShopItem", shop: "seed", viewMode: "list", item: { itemType: "Seed", species: "Carrot" } });
    expect(purchaseCommand("Carrot", 3, "grid")).toMatchObject({ viewMode: "grid", quantity: 3 });
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx --no-install vitest run test/shop.test.ts`
Expected: FAIL – modul `../src/game/shop` neexistuje.

- [ ] **Step 3: Implementuj `src/game/shop.ts`**

Hlavička modulu popíše tvar dat obchodu a příkazu (ze specu, sekce Protokol).

- [ ] **Step 4: Spusť testy**

Run: `npx --no-install vitest run`
Expected: všechny pass (předchozích 31 + 13 nových).

- [ ] **Step 5: Commit**

```bash
git add src/game/shop.ts test/shop.test.ts
git commit -m "feat: logika nákupu semínek z obchodu"
```

### Task 2: Nákup v hlavní smyčce

**Files:**
- Create: `src/farm/buy.ts`
- Modify: `src/config.ts` (pole `buyOn`, `buyTarget`, `buyCoinReserve`, `buyDisabled` + výchozí hodnoty z Global Constraints; `ToggleKey` beze změny), `src/game/reader.ts` (`GameSnapshot.seedOffers: SeedOffer[]`, čte `stateAtom` a `myUserSlotAtom` → `seedOffers(...)`), `src/state.ts` (`emptyGame()` + `seedOffers: []`; `state.backoffBuy: 0`), `src/stats.ts` (`Session.seedsBought: number`, `Session.seedCoins: number`, obě 0), `src/net/commands.ts` (`cmdBuySeed`), `src/farm/loop.ts`

**Interfaces:**
- Consumes: Task 1 (`planSeedPurchases`, `confirmPurchases`, `readViewMode`, `purchaseCommand`, `SeedOffer`).
- Produces:
  ```ts
  // net/commands.ts
  export const cmdBuySeed: (species: string, quantity: number) => boolean; // purchaseCommand(species, quantity, readViewMode(localStorage)) přes sendCommand; localStorage v try/catch → null
  // farm/buy.ts
  export async function doBuy(game: GameSnapshot, force: boolean): Promise<number>; // počet potvrzeně koupených semínek
  // farm/loop.ts
  export interface CycleOptions { …; buy?: boolean }   // výchozí true
  export const active = () => S.harvestOn || S.plantOn || S.feedOn || S.buyOn;
  ```
  `doBuy` po vzoru `doPlant`: `!force && (!S.buyOn || now < state.backoffBuy)` → 0; plán z `game.seedOffers` s `coins: game.coins`, `bag: game.seeds`, `target: S.buyTarget`, `coinReserve: S.buyCoinReserve`, `disabled: S.buyDisabled`, `order: S.plantOrder`; prázdný plán → při `force` log „Nic ke koupi – obchod nemá povolená semínka nebo chybí mince“ (warn), vrátí 0. Status `Kupuji ${plan.length} druhů…`; posílá `cmdBuySeed` s `sleep(S.gapMs)`; offline → status „Není spojení se hrou“. Pak `sleep(800)`, `readGame()`, `confirmPurchases(plan, game.seeds, after.seeds)`; součet 0 → `state.backoffBuy = now + 60_000`, log „Nákup neprošel, pauza 1 min“ (warn); jinak `session.seedsBought += n`, `session.seedCoins += Σ potvrzeno × seedPrice`, log `🛒 ` + `${n}× ${druh}` spojené „, “.
  V `cycle()`: krok `if (buy) { if (h || f) game = await readGame(); b = await doBuy(game, force); }` hned před sázením; sázení si hru znovu načte i když `b > 0`; `session.cycles` a souhrnný status započítají `b` (`Hotovo: ${h} sklizeno, ${f} nakrmeno, ${b} koupeno, ${p} zasazeno`).

- [ ] **Step 1: Napiš failing test `test/buy-settings.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../src/config";

describe("buy settings", () => {
  it("has safe defaults", () => {
    expect(DEFAULTS).toMatchObject({ buyOn: false, buyTarget: 10, buyCoinReserve: 0, buyDisabled: [] });
  });
});
```

- [ ] **Step 2: Spusť test**

Run: `npx --no-install vitest run test/buy-settings.test.ts`
Expected: FAIL – `DEFAULTS` nemá `buyOn`.

- [ ] **Step 3: Implementuj podle Interfaces (config, reader, state, stats, commands, buy.ts, loop.ts)**

- [ ] **Step 4: Spusť testy a kontroly**

Run: `npx --no-install vitest run && npx --no-install tsc --noEmit && node scripts/check-cycles.mjs`
Expected: vše pass, tsc bez chyb, žádné cykly.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/game/reader.ts src/state.ts src/stats.ts src/net/commands.ts src/farm/buy.ts src/farm/loop.ts test/buy-settings.test.ts
git commit -m "feat: nákup semínek v hlavním kole před sázením"
```

### Task 3: UI, dokumentace, verze, ověření

**Files:**
- Modify: `src/config.ts`, `src/ui/tabs/plant.ts`, `src/ui/fields.ts`, `src/ui/chips.ts`, `src/ui/panel.ts`, `README.md`, `docs/ARCHITECTURE.md`, `package.json` (`2.4.0`)

**Interfaces:**
- Consumes: Task 2 (`S.buy*`, `state.backoffBuy`, `session.seedsBought`, `session.seedCoins`, `CycleOptions.buy`, `game.seedOffers`); `plantInfo`.

- [ ] **Step 1: Napiš failing test do `test/buy-settings.test.ts`**

Privátní `clamp` z `ui/fields.ts` přesuň do `src/config.ts` jako exportované `clampField(k: FieldKey, v: number): number` (`ui/fields.ts` ho importuje). Do `config.ts` proto, že je čistý – `ui/fields.ts` za běhu tahá socket, který při načtení sahá na `window`, a v Node by test spadl. Přidej:

```ts
import { clampField } from "../src/config";

describe("buy field limits", () => {
  it("clamps buy settings", () => {
    expect(clampField("buyTarget", 0)).toBe(1);
    expect(clampField("buyTarget", 25)).toBe(25);
    expect(clampField("buyCoinReserve", -5)).toBe(0);
  });
});
```

Run: `npx --no-install vitest run test/buy-settings.test.ts`
Expected: FAIL – `clampField` není exportovaný.

- [ ] **Step 2: Implementuj**

- `config.ts` / `ui/fields.ts`: `clampField` (přesunuté `clamp`); `buyTarget` → `Math.max(1, v || 10)`, `buyCoinReserve` → `Math.max(0, v || 0)`; `data-run="buy"` → `addLog("Ruční nákup")`, `state.backoffBuy = 0`, `cycle({ force: true, harvest: false, plant: false, feed: false, buy: true })`. Ostatní `data-run` předají `buy: false`.
- `ui/chips.ts`: `ListKey` + `"buyDisabled"`.
- `ui/tabs/plant.ts` – do `form` za tlačítko „🌱 Zasadit teď“:
  `<h4>Nákup semínek</h4>`, `cb("buyOn", "Kupovat semínka (jen jednorázové rostliny)")`, `num("buyTarget", "Držet v batohu (ks od druhu)", 1)`, `num("buyCoinReserve", "Nechat si mincí", 0)`, `<h4>Nekupovat <span class="muted" style="text-transform:none;letter-spacing:0">(klikni)</span></h4>`, `<div class="chips" data-chips="buyDisabled"></div>`, `<div class="btns"><button class="btn" data-run="buy">🛒 Koupit teď</button></div>`, `<div class="muted" style="font-size:10.5px">Keře a stromy (víc sklizní) se nekupují nikdy.</div>`.
  Štítky: druhy z `game.seedOffers` s `plantInfo(sp)?.harvest === "Single"` ∪ `S.buyDisabled`, prázdné: „Obchod teď nemá jednorázová semínka“.
  Do `plantLiveHTML` za „Zasazeno v relaci“: `row("Koupeno v relaci", \`${fmt(session.seedsBought)} ks · ${fmtShort(session.seedCoins)} 🪙\`)`.
- `ui/panel.ts` – `statusLine`: `if (S.buyOn && state.backoffBuy > now) parts.push(\`nákup v pauze ${dur(state.backoffBuy - now)}\`)`; tečka „pause“ i při `S.buyOn && state.backoffBuy > now`; text při vypnutí všeho: „⏸ Vše vypnuto – zapni Sklizeň, Sázení, Krmení nebo Nákup“.
- `README.md`: v úvodu „nákup semínek“; `docs/ARCHITECTURE.md`: do tabulky příkazů řádek `PurchaseShopItem` | `shop: "seed"`, `viewMode`, `item: { itemType: "Seed", species }`, `quantity?`; do tabulky atomů `stateAtom` (obchody místnosti) a `myUserSlotAtom` (`shopPurchases`); do toku kola „sklizeň → krmení → (prodej) → nákup → sázení“.
- `package.json` `"version": "2.4.0"`.

- [ ] **Step 3: Build**

Run: `./build.sh`
Expected: vše projde, hlavička `@version     2.4.0`.

- [ ] **Step 4: Ověření v harnessu**

Mock harness (falešný WebSocket + jotai store, servírovaný `python3 -m http.server` na 127.0.0.1, vestavěný prohlížeč). Do dat přidej `stateAtom: { child: { data: { shops: { seed: { restockId: "r1", inventory: [{ species: "Carrot", initialStock: 5 }, { species: "Apple", initialStock: 3 }, { species: "Aloe", initialStock: 2 }] } } } } }`, `myUserSlotAtom: { data: { shopPurchases: {} } }`, mince 1000, nastavení `buyOn: true, buyTarget: 10` (ostatní automatiky vypnuté); falešný server na `PurchaseShopItem` přičte `quantity ?? 1` do `mySeedInventoryAtom`, odečte mince a zapíše do `shopPurchases.seed = { restockId: "r1", purchases }`.
Expected: socket dostane `PurchaseShopItem` pro Carrot (quantity 5) a Aloe (quantity 2), **nikdy** pro Apple; log „🛒 5× Carrot, 2× Aloe“; v záložce Sázení „Koupeno v relaci 7 ks · 320 🪙“; další kolo už nic nekupuje; žádné chyby v konzoli.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/ui test/buy-settings.test.ts README.md docs/ARCHITECTURE.md package.json package-lock.json
git commit -m "feat: nastavení nákupu semínek v záložce Sázení, v2.4.0"
```
