// Kolik by se dostalo za plody na poli a v batohu.

import { plantInfo } from "../data/catalog";
import { allSlots, isRipe, type Crop, type Tiles } from "./garden";
import { cropValue, SIZE_MAX, SIZE_MIN } from "./pricing";
import type { CropItem } from "./reader";

export interface GardenValue {
  /** zralé plody */
  ripe: number;
  /** všechny plody včetně rostoucích (velikost a mutace jsou dané už při zasazení) */
  total: number;
  /** zralé plody, které projdou filtrem sklizně */
  eligible: number;
  ripeCount: number;
  totalCount: number;
  bySpecies: Record<string, { ripe: number; total: number }>;
}

export function gardenValue(tiles: Tiles | null, players: number, now: number, isEligible?: (c: Crop) => boolean): GardenValue {
  const res: GardenValue = { ripe: 0, total: 0, eligible: 0, ripeCount: 0, totalCount: 0, bySpecies: {} };
  for (const c of allSlots(tiles)) {
    const v = cropValue(c.species, c.size, c.mutations, players);
    if (!v) continue;
    const sp = (res.bySpecies[c.species] ||= { ripe: 0, total: 0 });
    res.total += v; res.totalCount++; sp.total += v;
    if (!isRipe(c, now)) continue;
    res.ripe += v; res.ripeCount++; sp.ripe += v;
    if (!isEligible || isEligible(c)) res.eligible += v;
  }
  return res;
}

/** Velikost předmětu: `size`, nebo starší `scale` (1 → maxSize) převedené na 50–100, jinak 50. */
function itemSize(it: CropItem): number {
  if (Number.isFinite(it?.size)) return Number(it.size);
  const max = plantInfo(String(it?.species || ""))?.maxSize ?? 1;
  const scale = Number(it?.scale);
  if (!Number.isFinite(scale) || max <= 1) return SIZE_MIN;
  const ratio = (Math.min(max, Math.max(1, scale)) - 1) / (max - 1);
  return SIZE_MIN + ratio * (SIZE_MAX - SIZE_MIN);
}

export function inventoryValue(items: readonly CropItem[], players: number): number {
  let sum = 0;
  for (const it of items) {
    const size = itemSize(it);
    sum += cropValue(String(it?.species || ""), size, Array.isArray(it?.mutations) ? it.mutations : [], players);
  }
  return sum;
}
