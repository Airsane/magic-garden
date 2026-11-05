// Prodejní cena plodu – stejný vzorec, jaký používá hra:
//
//   cena = round(základ × velikost × mutace × přátelé)
//
//   velikost = 1 + (maxSize − 1) × (size − 50) / 50
//   mutace   = barva × (počasí + světlo − počet_přítomných + 1)
//              barva  = nejlepší z Growth (Gold, Rainbow)
//              počasí = nejlepší z Hydro; Wet + Chilled zároveň = Frozen
//              světlo = nejlepší z Lunar
//   přátelé  = 1 + 0,1 × (hráčů − 1), hráčů 1–6

import { mutationInfo, plantInfo, type MutationGroup, type MutationInfo } from "../data/catalog";

export const SIZE_MIN = 50, SIZE_MAX = 100;
const MAX_PLAYERS = 6;

export function clampSize(size: unknown): number {
  const n = Number(size);
  if (!Number.isFinite(n)) return SIZE_MIN;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n)));
}

export function clampPlayers(players: unknown): number {
  const n = Number(players);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_PLAYERS, Math.max(1, Math.floor(n)));
}

export const sizeMultiplier = (maxSize: number, size: number): number =>
  maxSize > 1 ? 1 + (maxSize - 1) * (clampSize(size) - SIZE_MIN) / (SIZE_MAX - SIZE_MIN) : 1;

export const friendMultiplier = (players: number): number => 1 + (clampPlayers(players) - 1) * 0.1;

const best = (list: MutationInfo[], group: MutationGroup): MutationInfo | null =>
  list.filter((m) => m.group === group).reduce<MutationInfo | null>((a, m) => (!a || m.mult > a.mult ? m : a), null);

export function mutationMultiplier(mutations: readonly string[]): number {
  let list = mutations.map(mutationInfo).filter((m): m is MutationInfo => !!m);
  // mokrý + zmrzlý plod se počítá jako Frozen
  const names = new Set(list.map((m) => m.name));
  const frozen = mutationInfo("Frozen");
  if (names.has("Wet") && names.has("Chilled") && frozen) {
    list = list.filter((m) => m.name !== "Wet" && m.name !== "Chilled").concat(frozen);
  }
  const color = best(list, "Growth")?.mult ?? 1;
  const present = [best(list, "Hydro"), best(list, "Lunar")].filter((m): m is MutationInfo => !!m);
  const weather = present.length ? present.reduce((a, m) => a + m.mult, 0) - present.length + 1 : 1;
  return color * weather;
}

/** Cena plodu v mincích; neznámý druh → 0. */
export function cropValue(species: string, size: number, mutations: readonly string[] = [], players = 1): number {
  const p = plantInfo(species);
  if (!p || !(p.sellPrice > 0)) return 0;
  return Math.round(p.sellPrice * sizeMultiplier(p.maxSize, size) * mutationMultiplier(mutations) * friendMultiplier(players));
}
