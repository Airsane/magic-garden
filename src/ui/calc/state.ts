// Stav kalkulačky (bez DOM) a převod na vstup výpočtu zisku.
// Stav žije jen do obnovení stránky.

import { allPlants } from "../../data/catalog";
import { defaultTimes } from "../../game/growtimes";
import { clampPlayers, clampSize } from "../../game/pricing";
import type { ProfitInput } from "../../game/profit";

export interface CalcState {
  species: string;
  size: number;
  /** "" = žádná, jinak jméno mutace z katalogu */
  color: string;
  hydro: string;
  lunar: string;
  /** null = vzít z hry */
  players: number | null;
  plants: number;
  harvests: number;
  /** null = výchozí doba (naučená / z katalogu) */
  growMin: number | null;
  regrowMin: number | null;
}

export const calc: CalcState = {
  species: allPlants()[0]?.species ?? "",
  size: 100,
  color: "", hydro: "", lunar: "",
  players: null,
  plants: 1, harvests: 1,
  growMin: null, regrowMin: null,
};

const atLeastOne = (n: number) => (Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1);

/** Minuty z formuláře → sekundy; prázdné / nesmyslné → výchozí doba. */
const seconds = (min: number | null, fallback: number | null) =>
  min != null && Number.isFinite(min) && min > 0 ? Math.round(min * 60) : fallback;

export function toProfitInput(s: CalcState, gamePlayers: number): ProfitInput {
  const times = defaultTimes(s.species);
  return {
    species: s.species,
    size: clampSize(s.size),
    mutations: [s.color, s.hydro, s.lunar].filter(Boolean),
    players: clampPlayers(s.players ?? gamePlayers),
    plants: atLeastOne(s.plants),
    harvests: atLeastOne(s.harvests),
    growSeconds: seconds(s.growMin, times.grow),
    regrowSeconds: seconds(s.regrowMin, times.regrow),
  };
}
