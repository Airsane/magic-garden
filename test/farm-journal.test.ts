import { beforeEach, describe, expect, it, vi } from "vitest";

// env.ts čte `window` (okno stránky) už při načtení
vi.hoisted(() => { (globalThis as Record<string, unknown>).window ??= globalThis; });

vi.mock("../src/net/commands", () => ({ cmdLogItem: vi.fn(() => true) }));
vi.mock("../src/game/reader", () => ({ readGame: vi.fn() }));
vi.mock("../src/util/misc", async (orig) => ({ ...(await orig<typeof import("../src/util/misc")>()), sleep: vi.fn(async () => {}) }));

const { S } = await import("../src/config");
const { allSlots } = await import("../src/game/garden");
const { readGame } = await import("../src/game/reader");
const { cmdLogItem } = await import("../src/net/commands");
const { doLogCrops, isHeldForJournal } = await import("../src/farm/journal");
type Snap = Parameters<typeof doLogCrops>[0];

/** Zralý Squash s mutací Thunderstruck na políčku 56, slot 1. `end` odliší plody mezi testy. */
const snap = (journal: unknown, end: number) => ({
  tiles: { 56: { objectType: "plant", species: "Squash", slots: [{ slotId: 1, species: "Squash", endTime: end, mutations: ["Thunderstruck"] }] } },
  journal,
}) as unknown as Snap;
const crop56 = (end: number) => allSlots(snap({}, end).tiles)[0]!;
const logged = { produce: { Squash: { variantsLogged: [{ variant: "Thunderstruck" }] } } };

describe("doLogCrops", () => {
  beforeEach(() => {
    S.journalOn = true; S.harvestOn = true;
    vi.mocked(cmdLogItem).mockReset().mockReturnValue(true);
    vi.mocked(readGame).mockReset();
  });

  it("logs a missing variant and releases the crop", async () => {
    vi.mocked(readGame).mockResolvedValueOnce(snap(logged, 1));
    expect(await doLogCrops(snap({}, 1), false)).toBe(1);
    expect(cmdLogItem).toHaveBeenCalledWith(56, 1);
    expect(isHeldForJournal(crop56(1))).toBe(false);
  });

  it("releases a crop after three failed attempts", async () => {
    vi.mocked(readGame).mockResolvedValue(snap({}, 2));
    for (let i = 0; i < 2; i++) { await doLogCrops(snap({}, 2), false); expect(isHeldForJournal(crop56(2))).toBe(true); }
    await doLogCrops(snap({}, 2), false);
    expect(isHeldForJournal(crop56(2))).toBe(false);
    vi.mocked(cmdLogItem).mockClear();
    await doLogCrops(snap({}, 2), false);
    expect(cmdLogItem).toHaveBeenCalledTimes(1);
    expect(isHeldForJournal(crop56(2))).toBe(false);
  });

  it("does not count unsent crops when offline", async () => {
    vi.mocked(cmdLogItem).mockReturnValue(false);
    for (let i = 0; i < 3; i++) await doLogCrops(snap({}, 3), false);
    expect(isHeldForJournal(crop56(3))).toBe(true);
  });

  it("does nothing when the journal setting is off", async () => {
    S.journalOn = false;
    expect(await doLogCrops(snap({}, 4), true)).toBe(0);
    expect(cmdLogItem).not.toHaveBeenCalled();
    expect(isHeldForJournal(crop56(4))).toBe(false);
  });
});
