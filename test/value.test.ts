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
  it("converts a legacy scale to size", () => {
    expect(inventoryValue([{ species: "Carrot", scale: 3 }], 1)).toBe(60);
    expect(inventoryValue([{ species: "Carrot", scale: 2 }], 1)).toBe(40);
  });
  it("inventory item without size is valued at size 50", () => {
    expect(inventoryValue([{ species: "Carrot" }], 1)).toBe(20);
  });
});
