// Zahrada: převod políček na seznam plodů, zralost, filtry sklizně, souhrn.

import { S } from "../config";
import type { GameSnapshot } from "./reader";

/** Jeden plod na rostlině, jak ho posílá hra. */
export interface RawSlot {
  species?: string;
  slotId?: number;
  startTime?: number;
  endTime?: number;
  mutations?: string[];
  size?: number;
  preserved?: boolean;
}

/** Objekt na políčku zahrady (rostlina, dekorace…). */
export interface TileObject {
  objectType?: string;
  species?: string;
  slots?: (RawSlot | null)[];
}

/** Políčka zahrady podle indexu (prázdné políčko chybí nebo je null). */
export type Tiles = Record<string, TileObject | null | undefined>;

/** Normalizovaný plod – s tímhle pracuje zbytek skriptu. */
export interface Crop {
  tileIndex: number;
  slotsIndex: number;
  species: string;
  start: number;
  end: number;
  mutations: string[];
  size: number;
  preserved: boolean;
}

export interface GardenSummary {
  plants: number;
  crops: number;
  ripe: number;
  eligible: number;
  growing: number;
  /** dozraje do 5 minut */
  soon: number;
  mutatedRipe: number;
  next: Crop | null;
  bySpecies: Record<string, { ripe: number; growing: number }>;
  empty: number | null;
  owned: number | null;
  objects: number;
}

const cropSize = (slot: RawSlot) => (Number.isFinite(slot.size) ? Number(slot.size) : 100);

export const cropKey = (c: Pick<Crop, "tileIndex" | "slotsIndex">) => c.tileIndex + ":" + c.slotsIndex;

export function allSlots(tiles: Tiles | null): Crop[] {
  const out: Crop[] = [];
  for (const [idx, tile] of Object.entries(tiles || {})) {
    if (!tile || tile.objectType !== "plant" || !Array.isArray(tile.slots)) continue;
    tile.slots.forEach((slot, i) => {
      if (!slot) return;
      out.push({
        tileIndex: Number(idx),
        slotsIndex: Number.isFinite(slot.slotId) ? Number(slot.slotId) : i,
        species: slot.species || tile.species || "?",
        start: Number(slot.startTime) || 0,
        end: Number(slot.endTime) || 0,
        mutations: Array.isArray(slot.mutations) ? slot.mutations : [],
        size: cropSize(slot),
        preserved: slot.preserved === true,
      });
    });
  }
  return out;
}

export const isRipe = (c: Crop, now: number) => c.end > 0 && c.end <= now;

/** Projde plod filtry sklizně z nastavení? */
export const harvestable = (c: Crop) =>
  !(S.skipPreserved && c.preserved) &&
  !(S.onlyMutated && !c.mutations.length) &&
  c.size >= S.minSize &&
  !S.excludeSpecies.includes(c.species);

/** Vlastní políčka hlíny, na kterých nic není. */
export function emptyTiles(game: GameSnapshot): number[] {
  const taken = new Set(Object.entries(game.tiles || {}).filter(([, v]) => v).map(([k]) => Number(k)));
  const owned = game.owned || [];
  return owned.filter((t) => !taken.has(t));
}

export function summary(game: GameSnapshot): GardenSummary {
  const now = Date.now();
  const slots = allSlots(game.tiles);
  const res: GardenSummary = {
    plants: 0, crops: slots.length, ripe: 0, eligible: 0, growing: 0, soon: 0,
    mutatedRipe: 0, next: null, bySpecies: {}, empty: game.owned ? emptyTiles(game).length : null,
    owned: game.owned ? game.owned.length : null, objects: 0,
  };
  for (const v of Object.values(game.tiles || {})) {
    if (!v) continue;
    if (v.objectType === "plant") res.plants++; else res.objects++;
  }
  for (const c of slots) {
    const sp = (res.bySpecies[c.species] ||= { ripe: 0, growing: 0 });
    if (isRipe(c, now)) {
      res.ripe++; sp.ripe++;
      if (harvestable(c)) res.eligible++;
      if (c.mutations.length) res.mutatedRipe++;
    } else {
      res.growing++; sp.growing++;
      if (c.end - now <= 300_000) res.soon++;
      if (!res.next || c.end < res.next.end) res.next = c;
    }
  }
  return res;
}
