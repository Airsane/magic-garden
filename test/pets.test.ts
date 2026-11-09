import { describe, expect, it } from "vitest";
import { petInfo } from "../src/data/catalog";
import { readPets } from "../src/game/pets";

describe("pet catalog", () => {
  it("knows what a Bat eats", () => {
    expect(petInfo("Bat")).toEqual({ species: "Bat", name: "Bat", diet: ["Clover", "Cabbage", "Delphinium"], max: 300 });
    expect(petInfo("bat")?.species).toBe("Bat");
    expect(petInfo("Nope")).toBeNull();
  });
});

describe("readPets", () => {
  it("fills diet and hunger percentage from the catalog", () => {
    expect(readPets([{ id: "p1", petSpecies: "Bat", hunger: 150 }])).toEqual([{
      id: "p1", species: "Bat", name: "Bat", hunger: 150, max: 300, pct: 50,
      diet: ["Clover", "Cabbage", "Delphinium"], mutations: [],
    }]);
  });
  it("falls back for a pet missing from the catalog", () => {
    expect(readPets([{ id: "p2", petSpecies: "Nope", hunger: 300 }])?.[0]).toMatchObject({ max: 3000, pct: 10, diet: [] });
  });
});
