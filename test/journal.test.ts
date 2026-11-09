import { describe, expect, it } from "vitest";
import type { Crop } from "../src/game/garden";
import { attemptKey, cropVariants, heldCrops, missingVariants, pickLogTargets, type Journal } from "../src/game/journal";

const crop = (o: Partial<Crop>): Crop => ({
  tileIndex: 1, slotsIndex: 0, species: "Squash", start: 0, end: 1000, mutations: [], size: 100, preserved: false, ...o,
});
const j: Journal = { produce: { Squash: { variantsLogged: [{ variant: "Normal" }] } } };

describe("journal variants", () => {
  it("a crop without mutations is Normal", () => expect(cropVariants(crop({}))).toEqual(["Normal"]));
  it("ignores unknown mutations", () => {
    expect(cropVariants(crop({ mutations: ["Thunderstruck", "Bogus"] }))).toEqual(["Thunderstruck"]);
    expect(cropVariants(crop({ mutations: ["Bogus"] }))).toEqual(["Normal"]);
  });
  it("treats a missing journal as empty", () => {
    expect(missingVariants(crop({ mutations: ["Gold"] }), null)).toEqual(["Gold"]);
    expect(missingVariants(crop({ species: "Daffodil" }), j)).toEqual(["Normal"]);
  });
  it("finds only variants not yet logged", () => {
    expect(missingVariants(crop({}), j)).toEqual([]);
    expect(missingVariants(crop({ mutations: ["Wet", "Gold"] }), { produce: { Squash: { variantsLogged: [{ variant: "Wet" }] } } })).toEqual(["Gold"]);
  });
});

describe("log targets", () => {
  it("picks only ripe crops with missing variants, up to max", () => {
    const ripe = crop({ tileIndex: 1, mutations: ["Gold"] });
    const unripe = crop({ tileIndex: 2, mutations: ["Gold"], species: "Daffodil", end: 5000 });
    const done = crop({ tileIndex: 3 });
    const other = crop({ tileIndex: 4, species: "Daffodil" });
    expect(pickLogTargets([ripe, unripe, done, other], j, 2000, 10)).toEqual([ripe, other]);
    expect(pickLogTargets([ripe, other], j, 2000, 1)).toEqual([ripe]);
  });
  it("picks one crop per missing species variant", () => {
    const a = crop({ tileIndex: 1, mutations: ["Gold"] });
    const b = crop({ tileIndex: 2, mutations: ["Gold"] });
    const c = crop({ tileIndex: 3, mutations: ["Gold", "Wet"] });
    expect(pickLogTargets([a, b, c], j, 2000, 10)).toEqual([a, c]);
  });
});

describe("held crops", () => {
  it("holds missing crops until three attempts", () => {
    const a = crop({ mutations: ["Gold"] });
    expect(heldCrops([a], j, 2000, new Map())).toEqual(new Set([attemptKey(a)]));
    expect(heldCrops([a], j, 2000, new Map([[attemptKey(a), 2]])).size).toBe(1);
    expect(heldCrops([a], j, 2000, new Map([[attemptKey(a), 3]])).size).toBe(0);
    expect(heldCrops([crop({})], j, 2000, new Map()).size).toBe(0);
  });
  it("a new crop on the same slot starts with no attempts", () => {
    const old = crop({ mutations: ["Gold"], end: 1000 });
    const fresh = crop({ mutations: ["Gold"], end: 1500 });
    expect(heldCrops([fresh], j, 2000, new Map([[attemptKey(old), 3]])).size).toBe(1);
  });
});
