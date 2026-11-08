import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../src/config";

describe("buy settings", () => {
  it("has safe defaults", () => {
    expect(DEFAULTS).toMatchObject({ buyOn: false, buyTarget: 10, buyCoinReserve: 0, buyDisabled: [] });
  });
});
