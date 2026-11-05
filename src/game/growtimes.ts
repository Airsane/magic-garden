// Doby růstu plodin naučené ze zahrady.
//
// Katalog zná jen dobu dozrání víckrát sklízených rostlin (secondsToMature),
// dobu dozrání jednotlivých plodů ne. Tu proto zjistíme z `endTime − startTime`
// plodů na poli a uložíme do localStorage (poslední pozorování vyhrává).

import { plantInfo } from "../data/catalog";
import { readLS, writeLS } from "../config";
import { allSlots, type Tiles } from "./garden";

const KEY = "mg-autofarm-growtimes";
/** delší doba je nesmysl – typicky plod bez startTime (start = 0) */
const MAX_SECONDS = 7 * 24 * 3600;

/** druh → sekundy */
let times: Record<string, number> = readLS<Record<string, number>>(KEY, {});

export function observeGrowTimes(tiles: Tiles | null): void {
  let changed = false;
  for (const c of allSlots(tiles)) {
    if (!(c.end > c.start)) continue;
    const sec = Math.round((c.end - c.start) / 1000);
    if (sec > 0 && sec <= MAX_SECONDS && times[c.species] !== sec) { times[c.species] = sec; changed = true; }
  }
  if (changed) writeLS(KEY, times);
}

export const observedSeconds = (species: string): number | null => times[species] ?? null;

export function defaultTimes(species: string): { grow: number | null; regrow: number | null } {
  const p = plantInfo(species);
  if (!p) return { grow: null, regrow: null };
  const seen = observedSeconds(p.species);
  return p.harvest === "Multiple"
    ? { grow: p.secondsToMature ?? seen, regrow: seen }
    : { grow: seen, regrow: null };
}

export function resetGrowTimes(): void {
  times = {};
  try { localStorage.removeItem(KEY); } catch {}
}
