// Jeden "snímek" stavu hry poskládaný z několika jotai atomů.

import { readAtom } from "./store";
import { readPets, type Pet } from "./pets";
import { clampPlayers } from "./pricing";
import type { Tiles } from "./garden";

/** Plodina v batohu. */
export interface CropItem {
  id?: string;
  species?: string;
  mutations?: string[];
  size?: number;
  scale?: number;
}

export interface GameSnapshot {
  tiles: Tiles | null;
  coins: number | null;
  /** počet plodin v batohu */
  cropInv: number | null;
  cropItems: CropItem[];
  /** id oblíbených (⭐) předmětů – ty se nikdy nekrmí */
  favorites: Set<string>;
  /** semínka v batohu: druh → počet */
  seeds: Record<string, number>;
  /** indexy políček hlíny, která patří hráči (null = mapa ještě není načtená) */
  owned: number[] | null;
  pets: Pet[] | null;
  /** hráčů v místnosti 1–6 (bonus za přátele) */
  players: number;
}

interface MyData {
  coinsCount?: number;
  coins?: number;
  garden?: { tileObjects?: Tiles };
}
interface RawSeed { species?: string; quantity?: number }
interface DirtTile { userSlotIdx?: number; dirtTileIdx?: number }
interface GameMap { globalTileIdxToDirtTile?: Record<string, DirtTile | null> }
interface Inventory { favoritedItemIds?: unknown[] }

let ownedTileCache: { key: string | null; tiles: number[] | null } = { key: null, tiles: null };

/** Která políčka hlíny patří hráči (podle mapy a jeho slotu ve hře). */
function ownedDirtTiles(map: GameMap | undefined, slotIdx: number): number[] | null {
  const key = slotIdx + ":" + (map ? Object.keys(map.globalTileIdxToDirtTile || {}).length : 0);
  if (ownedTileCache.key === key) return ownedTileCache.tiles;
  let tiles: number[] | null = null;
  if (map && Number.isInteger(slotIdx) && slotIdx >= 0) {
    const set: number[] = [];
    for (const meta of Object.values(map.globalTileIdxToDirtTile || {})) {
      if (meta?.userSlotIdx === slotIdx && Number.isInteger(meta.dirtTileIdx)) set.push(meta.dirtTileIdx!);
    }
    if (set.length) tiles = set.sort((a, b) => a - b);
  }
  ownedTileCache = { key, tiles };
  return tiles;
}

export async function readGame(): Promise<GameSnapshot> {
  const [data, crops, seeds, map, slotIdx, inv, petsA, petsB, players] = await Promise.all([
    readAtom<MyData>("myDataAtom"),
    readAtom<CropItem[]>("myCropInventoryAtom"),
    readAtom<RawSeed[]>("mySeedInventoryAtom"),
    readAtom<GameMap>("mapAtom"),
    readAtom<number>("myUserSlotIdxAtom"),
    readAtom<Inventory>("myInventoryAtom"),
    readAtom<unknown>("myPredictedPetSlotsAtom"),
    readAtom<unknown>("myPrimitivePetSlotsAtom"),
    readAtom<number>("numPlayersAtom"),
  ]);
  const coins = Number(data?.coinsCount ?? data?.coins);
  const seedMap: Record<string, number> = {};
  for (const r of Array.isArray(seeds) ? seeds : []) {
    const sp = String(r?.species || "").trim();
    const q = Math.floor(Number(r?.quantity) || 0);
    if (sp && q > 0) seedMap[sp] = (seedMap[sp] || 0) + q;
  }
  return {
    tiles: data?.garden?.tileObjects || null,
    coins: Number.isFinite(coins) ? coins : null,
    cropInv: Array.isArray(crops) ? crops.length : null,
    cropItems: Array.isArray(crops) ? crops : [],
    favorites: new Set(Array.isArray(inv?.favoritedItemIds) ? inv.favoritedItemIds.map(String) : []),
    seeds: seedMap,
    owned: ownedDirtTiles(map, Number(slotIdx)),
    pets: readPets(Array.isArray(petsA) ? petsA : petsB),
    players: clampPlayers(players),
  };
}
