// Nákup semínek jednorázových rostlin do cíle v batohu (keře a stromy nikdy).

import { S } from "../config";
import { plantInfo } from "../data/catalog";
import { readGame, type GameSnapshot } from "../game/reader";
import { confirmPurchases, planSeedPurchases } from "../game/shop";
import { addLog } from "../log";
import { cmdBuySeed } from "../net/commands";
import { renderLive, state } from "../state";
import { session } from "../stats";
import { sleep } from "../util/misc";

/** Koupí semínka podle plánu. Vrací počet kusů, které opravdu přibyly do batohu. */
export async function doBuy(game: GameSnapshot, force: boolean): Promise<number> {
  if (!force && (!S.buyOn || Date.now() < state.backoffBuy)) return 0;
  const plan = planSeedPurchases(game.seedOffers, {
    coins: game.coins, coinReserve: S.buyCoinReserve, bag: game.seeds,
    target: S.buyTarget, disabled: S.buyDisabled, order: S.plantOrder,
  });
  if (!plan.length) {
    if (force) addLog("Nic ke koupi – obchod nemá povolená semínka nebo chybí mince", "warn");
    return 0;
  }

  state.status = `Kupuji ${plan.length} druhů…`; renderLive();
  let sent = 0;
  for (const p of plan) {
    if (!cmdBuySeed(p.species, p.quantity)) { state.status = "Není spojení se hrou"; break; }
    sent++;
    await sleep(S.gapMs);
  }
  if (!sent) return 0;

  // Ověření: co opravdu přibylo do batohu.
  await sleep(800);
  const after = await readGame();
  const got = confirmPurchases(plan.slice(0, sent), game.seeds, after.seeds);
  const done = Object.entries(got).filter(([, n]) => n > 0);
  const total = done.reduce((a, [, n]) => a + n, 0);
  if (!total) {
    state.backoffBuy = Date.now() + 60_000;
    addLog("Nákup neprošel, pauza 1 min", "warn");
    return 0;
  }
  session.seedsBought += total;
  session.seedCoins += done.reduce((a, [sp, n]) => a + n * (plantInfo(sp)?.seedPrice ?? 0), 0);
  addLog("🛒 " + done.map(([sp, n]) => `${n}× ${sp}`).join(", "));
  return total;
}
