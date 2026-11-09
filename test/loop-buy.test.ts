import { beforeEach, describe, expect, it, vi } from "vitest";

// env.ts čte `window` (okno stránky) už při načtení
vi.hoisted(() => { (globalThis as Record<string, unknown>).window ??= globalThis; });

const game = { tiles: {}, coins: 1000, seeds: {}, seedOffers: [] };
vi.mock("../src/game/reader", () => ({ readGame: vi.fn(async () => game) }));
vi.mock("../src/net/commands", () => ({ cmdSellAll: vi.fn(() => true) }));
vi.mock("../src/farm/buy", () => ({ doBuy: vi.fn(async () => 0) }));
vi.mock("../src/farm/feed", () => ({ doFeed: vi.fn(async () => 0) }));
vi.mock("../src/farm/harvest", () => ({ doHarvest: vi.fn(async () => 0) }));
vi.mock("../src/farm/plant", () => ({ doPlant: vi.fn(async () => 0) }));
vi.mock("../src/farm/journal", () => ({ doLogCrops: vi.fn(async () => 0), clearJournalHold: vi.fn(), isHeldForJournal: vi.fn(() => false) }));

const { S } = await import("../src/config");
const { doBuy } = await import("../src/farm/buy");
const { cycle } = await import("../src/farm/loop");

describe("cycle buy step", () => {
  beforeEach(() => { vi.mocked(doBuy).mockClear(); S.buyOn = false; });
  it("a forced run does not buy when buying is off", async () => {
    await cycle({ force: true });
    await cycle({ force: true, harvest: false, plant: false, feed: true, petId: "p1" });
    expect(doBuy).not.toHaveBeenCalled();
  });
  it("the buy button buys even when buying is off", async () => {
    await cycle({ force: true, harvest: false, plant: false, feed: false, buy: true });
    expect(doBuy).toHaveBeenCalledWith(game, true);
  });
  it("a timed run buys when buying is on", async () => {
    S.buyOn = true;
    await cycle();
    expect(doBuy).toHaveBeenCalledWith(game, false);
  });
});
