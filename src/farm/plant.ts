// Sázení semínek do prázdných vlastních políček.

import { S, save } from "../config";
import { emptyTiles } from "../game/garden";
import { readGame, type GameSnapshot } from "../game/reader";
import { addLog } from "../log";
import { cmdPlant } from "../net/commands";
import { renderLive, state } from "../state";
import { allTime, saveAll, session } from "../stats";
import { countBy, sleep } from "../util/misc";

let rotateIdx = 0;

/**
 * Seřazený seznam druhů, které se smí sázet (pořadí = priorita).
 * Vedlejší efekt: nově objevené druhy přidá na konec `S.plantOrder`.
 */
export function plantCandidates(seeds: Record<string, number>): string[] {
  for (const sp of Object.keys(seeds)) if (!S.plantOrder.includes(sp)) S.plantOrder.push(sp);
  return S.plantOrder.filter((sp) => !S.plantDisabled.includes(sp) && (seeds[sp] || 0) > S.seedReserve);
}

/** Zasadí semínka do volných políček. Vrací počet skutečně zasazených. */
export async function doPlant(game: GameSnapshot, force: boolean): Promise<number> {
  if (!force && (!S.plantOn || Date.now() < state.backoffPlant)) return 0;
  if (!game.owned) { if (force) addLog("Nevím, která políčka jsou tvoje – mapa se ještě nenačetla", "warn"); return 0; }
  const free = emptyTiles(game).slice(0, S.maxPerCycle);
  if (!free.length) return 0;

  // Plán: které semínko na které políčko (s ohledem na zásobu a rezervu).
  const stock = { ...game.seeds };
  const plan: { tile: number; sp: string }[] = [];
  for (const tile of free) {
    const cands = plantCandidates(stock).filter((sp) => stock[sp]! > S.seedReserve);
    if (!cands.length) break;
    const sp = S.plantMode === "rotate" ? cands[rotateIdx++ % cands.length]! : cands[0]!;
    stock[sp]!--;
    plan.push({ tile, sp });
  }
  if (!plan.length) {
    if (force) addLog("Nemám co sázet – žádná povolená semínka", "warn");
    return 0;
  }

  state.status = `Sázím ${plan.length}…`; renderLive();
  let sent = 0;
  for (const p of plan) {
    if (!force && !S.plantOn) break;
    if (!cmdPlant(p.tile, p.sp)) { state.status = "Není spojení se hrou"; break; }
    sent++;
    await sleep(S.gapMs);
  }
  if (!sent) return 0;

  // Ověření: zasazené políčko už není prázdné.
  await sleep(800);
  const after = await readGame();
  const done = plan.slice(0, sent).filter((p) => after.tiles?.[p.tile]);
  session.planted += done.length; allTime.planted += done.length;
  done.forEach((p) => (session.plantedSpecies[p.sp] = (session.plantedSpecies[p.sp] || 0) + 1));
  session.failedPlant += sent - done.length;
  saveAll(); save();

  if (!done.length) {
    state.backoffPlant = Date.now() + 60_000;
    addLog("Sázení neprošlo, pauza 1 min", "warn");
    return 0;
  }
  const groups = countBy(done, (p) => p.sp);
  addLog("🌱 " + Object.entries(groups).map(([k, v]) => `${v}× ${k}`).join(", "));
  return done.length;
}
