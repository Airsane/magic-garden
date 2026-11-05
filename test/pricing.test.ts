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
