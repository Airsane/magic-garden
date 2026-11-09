import { describe, expect, it, vi } from "vitest";

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

const { doHarvest } = await import("../src/farm/harvest");
const { clearJournalHold, doLogCrops } = await import("../src/farm/journal");
const { cycle } = await import("../src/farm/loop");

describe("cycle journal step", () => {
  it("logs before harvesting", async () => {
    const order: string[] = [];
    vi.mocked(doLogCrops).mockImplementation(async () => { order.push("log"); return 0; });
    vi.mocked(doHarvest).mockImplementation(async () => { order.push("harvest"); return 0; });
    await cycle({ force: true });
    expect(order).toEqual(["log", "harvest"]);
  });

  it("a feed-only cycle holds nothing", async () => {
    vi.mocked(doLogCrops).mockClear(); vi.mocked(clearJournalHold).mockClear();
    await cycle({ force: true, harvest: false, plant: false, feed: true, petId: "p1" });
    expect(clearJournalHold).toHaveBeenCalled();
    expect(doLogCrops).not.toHaveBeenCalled();
  });
});
