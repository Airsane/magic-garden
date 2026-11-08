import { describe, expect, it } from "vitest";
import { clampField, DEFAULTS } from "../src/config";

describe("buy settings", () => {
  it("has safe defaults", () => {
    expect(DEFAULTS).toMatchObject({ buyOn: false, buyTarget: 10, buyCoinReserve: 0, buyDisabled: [] });
  });
});

describe("buy field limits", () => {
  it("clamps buy settings", () => {
    expect(clampField("buyTarget", 0)).toBe(1);
    expect(clampField("buyTarget", 25)).toBe(25);
    expect(clampField("buyCoinReserve", -5)).toBe(0);
  });
});
