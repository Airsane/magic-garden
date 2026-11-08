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
