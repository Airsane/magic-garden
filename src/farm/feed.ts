// Krmení hladových aktivních mazlíčků.
//
// Jídlo se bere nejdřív z batohu (nejlevnější vhodná plodina), a když tam nic
// není, sklidí se zralý plod ze zahrady a hned se jím nakrmí.

import { S } from "../config";
import { allSlots, cropKey, isRipe, type Crop } from "../game/garden";
import type { Pet } from "../game/pets";
import { readGame, type CropItem, type GameSnapshot } from "../game/reader";
import { addLog } from "../log";
import { cmdFeed, cmdHarvest } from "../net/commands";
import { beep, toast } from "../notify";
import { renderLive, state } from "../state";
import { allTime, countHarvest, saveAll, session } from "../stats";
import { prettyName } from "../util/format";
import { sleep, uuid } from "../util/misc";
import { isHeldForJournal } from "./journal";

/** Max. počet krmení jednoho mazlíčka za kolo. */
const MAX_FEEDS_PER_PET = 6;
/** Jak často (nejvýš) upozornit na hladového mazlíčka bez jídla. */
const HUNGRY_WARN_MS = 10 * 60_000;

const allowedDiet = (pet: Pet) => new Set(pet.diet.filter((c) => !S.feedBanned.includes(c)));

/** Nejlevnější vhodná plodina z batohu: bez mutace, nejmenší, ne oblíbená. */
function pickFood(pet: Pet, game: GameSnapshot, used: Set<string>): CropItem | null {
  const diet = allowedDiet(pet);
  if (!diet.size) return null;
  const items = game.cropItems.filter((it) => {
    const id = String(it?.id || "");
    if (!id || used.has(id) || game.favorites.has(id)) return false;
    if (!diet.has(String(it?.species || ""))) return false;
    const muts = Array.isArray(it?.mutations) ? it.mutations : [];
    if (muts.length && !S.feedMutated) return false;
    return true;
  });
  items.sort((a, b) =>
    ((a.mutations?.length || 0) - (b.mutations?.length || 0)) ||
    ((Number(a.size) || Number(a.scale) || 0) - (Number(b.size) || Number(b.scale) || 0)));
  return items[0] || null;
}

/** Zralý plod v zahradě, kterým jde mazlíčka nakrmit (když v batohu nic není). */
function pickGardenFood(pet: Pet, game: GameSnapshot, used: Set<string>): Crop | null {
  if (!S.feedFromGarden) return null;
  const diet = allowedDiet(pet);
  const t = Date.now();
  const list = allSlots(game.tiles).filter((c) =>
    isRipe(c, t) && diet.has(c.species) && !c.preserved && !used.has(cropKey(c)) && !isHeldForJournal(c) &&
    (S.feedMutated || !c.mutations.length));
  list.sort((a, b) => a.mutations.length - b.mutations.length || a.size - b.size);
  return list[0] || null;
}

type FeedResult = "offline" | null | { species: string; fromGarden?: boolean };

/** Dá mazlíčkovi jednu plodinu. `used` = id/políčka, která už v tomhle kole padla. */
async function feedPetOnce(pet: Pet, game: GameSnapshot, used: Set<string>): Promise<FeedResult> {
  const food = pickFood(pet, game, used);
  if (food) {
    used.add(String(food.id));
    if (!cmdFeed(pet.id, String(food.id))) return "offline";
    return { species: String(food.species) };
  }
  const g = pickGardenFood(pet, game, used);
  if (g) {
    used.add(cropKey(g));
    const cropId = uuid();
    if (!cmdHarvest(g.tileIndex, g.slotsIndex, cropId)) return "offline";
    countHarvest(g);
    await sleep(Math.max(700, S.gapMs));
    if (!cmdFeed(pet.id, cropId)) return "offline";
    return { species: g.species, fromGarden: true };
  }
  return null;
}

const hungryWarned = new Map<string, number>();

/**
 * Nakrmí hladové mazlíčky (pod `S.feedBelow`) až do `S.feedTarget`.
 * S `onlyPetId` nakrmí jen toho jednoho mazlíčka jednou plodinou (ruční krmení).
 */
export async function doFeed(game: GameSnapshot, force: boolean, onlyPetId: string | null): Promise<number> {
  if (!force && !S.feedOn) return 0;
  if (!game.pets || !game.pets.length) { if (force) addLog("Nemáš aktivní žádné mazlíčky", "warn"); return 0; }
  state.feedRunning = true;
  let fedTotal = 0;
  const used = new Set<string>();
  try {
    const pets = game.pets.filter((p) => (onlyPetId ? p.id === onlyPetId : p.pct != null && p.pct < S.feedBelow));
    for (const pet0 of pets) {
      let pet = pet0, fedThis = 0, lastPct = pet.pct;
      for (let n = 0; n < MAX_FEEDS_PER_PET; n++) {
        if (pet.pct != null && pet.pct >= S.feedTarget && !(onlyPetId && n === 0)) break;
        state.status = `Krmím ${pet.name}…`; renderLive();
        const r = await feedPetOnce(pet, game, used);
        if (r === "offline") { state.status = "Není spojení se hrou"; return fedTotal; }
        if (!r) {
          if (!fedThis) warnHungry(pet, force);
          break;
        }
        fedThis++; fedTotal++;
        session.fed++; allTime.fed++;
        session.fedPets[pet.name] = (session.fedPets[pet.name] || 0) + 1;
        addLog(`🍖 ${pet.name} ← ${prettyName(r.species)}${r.fromGarden ? " (ze zahrady)" : ""}`);
        await sleep(Math.max(600, S.gapMs));
        game = await readGame();
        pet = game.pets?.find((p) => p.id === pet0.id) || pet;
        if (onlyPetId && n === 0) break; // ruční krmení = jedna plodina
        if (pet.pct != null && lastPct != null && pet.pct <= lastPct) {
          // sytost se nezvedla – krmení asi neprošlo
          session.failedFeed++;
          break;
        }
        lastPct = pet.pct;
      }
    }
  } finally {
    state.feedRunning = false;
    saveAll();
  }
  return fedTotal;
}

function warnHungry(pet: Pet, force: boolean): void {
  const last = hungryWarned.get(pet.id) || 0;
  if (!force && Date.now() - last <= HUNGRY_WARN_MS) return;
  hungryWarned.set(pet.id, Date.now());
  const want = pet.diet.map(prettyName).join(", ") || "?";
  addLog(`🍽 ${pet.name} má hlad, ale nemám čím krmit (jí: ${want})`, "warn");
  if (S.notifyHungry) { toast(`🍽 ${pet.name} má hlad – chybí jídlo`); if (S.notifySound) beep(); }
}
