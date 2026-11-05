// Sklizeň zralých plodů podle filtrů z nastavení.

import { S } from "../config";
import { allSlots, cropKey, harvestable, isRipe } from "../game/garden";
import { readGame, type GameSnapshot } from "../game/reader";
import { addLog } from "../log";
import { cmdHarvest } from "../net/commands";
import { renderLive, state } from "../state";
import { countHarvest, saveAll, session } from "../stats";
import { countBy, sleep } from "../util/misc";

/** Sklidí zralé plody. Vrací počet skutečně sklizených (ověřeno novým čtením hry). */
export async function doHarvest(game: GameSnapshot, force: boolean): Promise<number> {
  if (!force && (!S.harvestOn || Date.now() < state.backoffHarvest)) return 0;
  const now = Date.now();
  const crops = allSlots(game.tiles).filter((c) => isRipe(c, now) && harvestable(c)).slice(0, S.maxPerCycle);
  if (!crops.length) return 0;

  state.status = `Sklízím ${crops.length}…`; renderLive();
  let sent = 0;
  for (const c of crops) {
    if (!force && !S.harvestOn) break;
    if (!cmdHarvest(c.tileIndex, c.slotsIndex)) { state.status = "Není spojení se hrou"; break; }
    sent++;
    await sleep(S.gapMs);
  }
  if (!sent) return 0;

  // Ověření: co je po chvíli pořád zralé, to se nesklidilo.
  await sleep(800);
  const after = await readGame();
  const t = Date.now();
  const still = new Set(allSlots(after.tiles).filter((c) => isRipe(c, t)).map(cropKey));
  const picked = crops.slice(0, sent).filter((c) => !still.has(cropKey(c)));
  picked.forEach(countHarvest);
  session.failedHarvest += sent - picked.length;
  saveAll();

  if (!picked.length) {
    state.backoffHarvest = Date.now() + 60_000;
    addLog("Sklizeň neprošla – asi plný batoh, pauza 1 min", "warn");
    return 0;
  }
  const groups = countBy(picked, (c) => c.species);
  addLog("🌾 " + Object.entries(groups).map(([k, v]) => `${v}× ${k}`).join(", "));
  return picked.length;
}
