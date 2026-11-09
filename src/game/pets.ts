// Mazlíčci: převod dat ze hry. Co jedí a kolik pojmou, je v katalogu (data/catalog.ts).

import { petInfo } from "../data/catalog";

const DEFAULT_MAX_HUNGER = 3000;

export interface Pet {
  id: string;
  species: string;
  name: string;
  /** aktuální sytost (čím víc, tím sytější) */
  hunger: number | null;
  max: number;
  /** sytost v procentech 0–100 */
  pct: number | null;
  diet: string[];
  mutations: string[];
}

/** Mazlíček, jak ho posílá hra – tvar se liší mezi atomy, proto tolik variant. */
interface RawPet {
  id?: unknown;
  petId?: unknown;
  petItemId?: unknown;
  itemId?: unknown;
  petSpecies?: string;
  species?: string;
  hunger?: unknown;
  name?: string;
  petName?: string;
  mutations?: string[];
  slot?: RawPet;
}

export function readPets(raw: unknown): Pet[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Pet[] = [];
  for (const e of raw as (RawPet | null)[]) {
    if (!e || typeof e !== "object") continue;
    const s: RawPet = e.slot && typeof e.slot === "object" ? { ...e, ...e.slot } : e;
    const id = String(s.id ?? s.petId ?? s.petItemId ?? s.itemId ?? "").trim();
    if (!id) continue;
    const species = String(s.petSpecies ?? s.species ?? "").trim();
    const hunger = Number(s.hunger);
    const db = petInfo(species);
    const max = db?.max || DEFAULT_MAX_HUNGER;
    out.push({
      id, species,
      name: s.name || s.petName || species || "Mazlíček",
      hunger: Number.isFinite(hunger) ? hunger : null,
      max,
      pct: Number.isFinite(hunger) ? Math.max(0, Math.min(100, (hunger / max) * 100)) : null,
      diet: db?.diet || [],
      mutations: Array.isArray(s.mutations) ? s.mutations : [],
    });
  }
  return out;
}
