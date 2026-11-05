// Hlavní smyčka: jedno kolo = sklizeň → krmení → (prodej) → sázení.

import { S } from "../config";
import { readGame } from "../game/reader";
import { addLog } from "../log";
import { cmdSellAll } from "../net/commands";
import { renderLive, state } from "../state";
import { session } from "../stats";
import { sleep } from "../util/misc";
import { doFeed } from "./feed";
import { doHarvest } from "./harvest";
import { doPlant } from "./plant";

export interface CycleOptions {
  /** ignoruje vypnuté přepínače a pauzy (ruční spuštění) */
  force?: boolean;
  harvest?: boolean;
  plant?: boolean;
  feed?: boolean;
  /** nakrmit jen tohoto mazlíčka jednou plodinou */
  petId?: string | null;
}

export async function cycle({ force = false, harvest = true, plant = true, feed = true, petId = null }: CycleOptions = {}): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.lastCycle = Date.now();
  try {
    let game = await readGame();
    if (!game.tiles) { state.status = "Čekám na zahradu…"; return; }
    let h = 0, p = 0, f = 0;
    if (harvest) h = await doHarvest(game, force);
    // krmení před prodejem, ať mazlíčkům zůstane jídlo
    if (feed) {
      if (h) game = await readGame();
      f = await doFeed(game, force, petId);
    }
    if (h && S.sellAfter) {
      await sleep(S.gapMs);
      if (cmdSellAll()) { session.sells++; addLog("💰 Prodáno vše", "ok"); }
    }
    if (plant) {
      if (h || f) game = await readGame();
      p = await doPlant(game, force);
    }
    if (h || p || f) session.cycles++;
    state.status = h || p || f ? `Hotovo: ${h} sklizeno, ${f} nakrmeno, ${p} zasazeno` : "Nic k práci";
  } catch (e) {
    console.error("[AutoFarm]", e);
    state.status = "Chyba – viz konzole (F12)";
  } finally {
    state.running = false;
    renderLive();
  }
}

/** Je zapnutá aspoň jedna automatika? */
export const active = (): boolean => S.harvestOn || S.plantOn || S.feedOn;

let timer: ReturnType<typeof setInterval> | undefined;

/** (Znovu) spustí periodické kolo podle `S.intervalSec` (min. 3 s). */
export function restartTimer(): void {
  clearInterval(timer);
  timer = setInterval(() => { if (active()) cycle(); }, Math.max(3, S.intervalSec) * 1000);
}
