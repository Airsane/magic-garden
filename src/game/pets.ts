// Mazlíčci: katalog (co jedí, kolik pojmou) a převod dat ze hry.

interface PetInfo {
  diet: string[];
  /** maximální "sytost" */
  max: number;
}

/** Co který mazlíček jí a kolik sytosti pojme (z katalogu hry, převzato z Arie's Mod). */
export const PET_DB: Record<string, PetInfo> = {
  Worm: { diet: ["Carrot", "Strawberry", "Aloe", "Tomato", "Apple"], max: 500 },
  Snail: { diet: ["Blueberry", "Tomato", "Corn", "Daffodil", "Chrysanthemum"], max: 1000 },
  Bee: { diet: ["Strawberry", "Blueberry", "Daffodil", "Lily", "Chrysanthemum"], max: 1500 },
  Chicken: { diet: ["Aloe", "Corn", "Watermelon", "Pumpkin"], max: 3000 },
  Bunny: { diet: ["Carrot", "Strawberry", "Blueberry", "OrangeTulip", "Apple"], max: 750 },
  Dragonfly: { diet: ["Apple", "OrangeTulip", "Echeveria"], max: 250 },
  Pig: { diet: ["Watermelon", "Pumpkin", "Mushroom", "Bamboo"], max: 50000 },
  Cow: { diet: ["Coconut", "Banana", "BurrosTail", "Mushroom"], max: 25000 },
  Turkey: { diet: ["FavaBean", "Corn", "Squash"], max: 500 },
  Squirrel: { diet: ["Pumpkin", "Banana", "Grape"], max: 15000 },
  Turtle: { diet: ["Watermelon", "BurrosTail", "Bamboo", "Pepper"], max: 100000 },
  Goat: { diet: ["Pumpkin", "Coconut", "Pepper", "Camellia", "PassionFruit"], max: 20000 },
  SnowFox: { diet: ["Echeveria", "Squash", "Grape"], max: 14000 },
  Stoat: { diet: ["Banana", "Pepper", "Cactus"], max: 10000 },
  WhiteCaribou: { diet: ["Camellia", "BurrosTail", "Mushroom"], max: 30000 },
  Pony: { diet: ["Beet", "Pear", "Coconut"], max: 4000 },
  Horse: { diet: ["Squash", "Echeveria", "Gentian"], max: 25000 },
  FireHorse: { diet: ["DragonFruit", "Poinsettia", "Cacao"], max: 200000 },
  Butterfly: { diet: ["Daffodil", "Lily", "Grape", "Lemon", "Sunflower"], max: 25000 },
  Capybara: { diet: ["Lemon", "PassionFruit", "DragonFruit", "Lychee"], max: 150000 },
  Peacock: { diet: ["Cactus", "Sunflower", "Lychee"], max: 100000 },
};

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
    const db = PET_DB[species];
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
