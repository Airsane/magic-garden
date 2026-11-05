// Statistiky: relace (do obnovení stránky) a celkové (v localStorage).

import { readLS, writeLS } from "./config";
import type { Crop } from "./game/garden";

export interface Session {
  start: number;
  harvested: number;
  mutated: number;
  planted: number;
  fed: number;
  failedHarvest: number;
  failedPlant: number;
  failedFeed: number;
  /** jméno mazlíčka → počet krmení */
  fedPets: Record<string, number>;
  cycles: number;
  sells: number;
  disconnects: number;
  /** sklizeno podle druhu */
  species: Record<string, number>;
  /** zasazeno podle druhu */
  plantedSpecies: Record<string, number>;
  coinsStart: number | null;
  coinsNow: number | null;
  coinsPeak: number | null;
  /** [čas, mince] každých 30 s */
  coinHistory: [number, number][];
}

export interface AllTime {
  harvested: number;
  mutated: number;
  planted: number;
  fed: number;
  species: Record<string, number>;
  since: number;
  bestPerHour: number;
}

const KEY_ALL = "mg-autofarm-alltime";

const newSession = (): Session => ({
  start: Date.now(),
  harvested: 0, mutated: 0, planted: 0, fed: 0,
  failedHarvest: 0, failedPlant: 0, failedFeed: 0, fedPets: {},
  cycles: 0, sells: 0, disconnects: 0,
  species: {}, plantedSpecies: {},
  coinsStart: null, coinsNow: null, coinsPeak: null,
  coinHistory: [],
});

const newAllTime = (): AllTime => ({
  harvested: 0, mutated: 0, planted: 0, fed: 0, species: {}, since: Date.now(), bestPerHour: 0,
});

export let session: Session = newSession();
export let allTime: AllTime = readLS(KEY_ALL, newAllTime());

export const saveAll = (): void => writeLS(KEY_ALL, allTime);

export function resetSession(): void {
  session = newSession();
}

export function resetAllTime(): void {
  allTime = newAllTime();
  saveAll();
}

/** Započítá jeden sklizený plod do relace i celkových statistik. */
export function countHarvest(c: Crop): void {
  session.harvested++; allTime.harvested++;
  session.species[c.species] = (session.species[c.species] || 0) + 1;
  allTime.species[c.species] = (allTime.species[c.species] || 0) + 1;
  if (c.mutations.length) { session.mutated++; allTime.mutated++; }
}
