// Katalog rostlin a mutací – snímek veřejného API přibalený do skriptu.
// Obnovení: node scripts/update-catalog.mjs (za běhu hry se nic nestahuje).

import data from "./catalog-data.json";

export type HarvestType = "Single" | "Multiple";
export type MutationGroup = "Growth" | "Hydro" | "Lunar";

export interface PlantInfo {
  /** klíč katalogu, např. "Carrot" */
  species: string;
  name: string;
  /** cena semínka v obchodě; null = nedá se koupit / neznámá */
  seedPrice: number | null;
  /** základní prodejní cena plodu (velikost 50, bez mutací) */
  sellPrice: number;
  /** násobitel ceny při velikosti 100 */
  maxSize: number;
  harvest: HarvestType;
  /** plodů na jednu sklizeň (Single = 1) */
  slots: number;
  /** doba do dozrání víckrát sklízené rostliny (s) */
  secondsToMature: number | null;
}

export interface MutationInfo {
  key: string;
  name: string;
  group: MutationGroup;
  mult: number;
}

const plants = Object.values(data.plants as Record<string, PlantInfo>);
const mutations = Object.values(data.mutations as Record<string, MutationInfo>);

const plantIdx = new Map(plants.map((p) => [p.species.toLowerCase(), p]));
const mutationIdx = new Map<string, MutationInfo>();
for (const m of mutations) {
  mutationIdx.set(m.key.toLowerCase(), m);
  mutationIdx.set(m.name.toLowerCase(), m);
}
const sorted = [...plants].sort((a, b) => a.name.localeCompare(b.name));

export const plantInfo = (species: string): PlantInfo | null =>
  plantIdx.get(String(species).trim().toLowerCase()) ?? null;

export const allPlants = (): PlantInfo[] => sorted;

export const mutationInfo = (keyOrName: string): MutationInfo | null =>
  mutationIdx.get(String(keyOrName).trim().toLowerCase()) ?? null;
