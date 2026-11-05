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
