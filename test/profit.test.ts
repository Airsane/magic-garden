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
