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
