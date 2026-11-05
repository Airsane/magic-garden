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
