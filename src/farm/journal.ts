// Zápis plodů do sbírky (deníku) před sklizní.
//
// Zralý plod s variantou, která ve sbírce chybí, dostane `LogItem`. Dokud se
// nezapíše, sklizeň ani krmení ho nevezmou. Pokusy se počítají za druh + variantu;
// po MAX_LOG_ATTEMPTS neúspěších se varianta do obnovení stránky vzdá.
// Zadržení platí jen pro kolo, ve kterém zápis běžel (`clearJournalHold`).

import { S } from "../config";
import { allSlots, type Crop } from "../game/garden";
import { attemptKey, heldCrops, loggedVariants, MAX_LOG_ATTEMPTS, missingVariants, pickLogTargets, variantKey } from "../game/journal";
import { readGame, type GameSnapshot } from "../game/reader";
import { addLog } from "../log";
import { cmdLogItem } from "../net/commands";
import { renderLive, state } from "../state";
import { allTime, saveAll, session } from "../stats";
import { sleep } from "../util/misc";

/** variantKey → počet neúspěšných pokusů */
const attempts = new Map<string, number>();
/** attemptKey plodů, které se v tomhle kole nesmí sklidit ani sníst */
let held = new Set<string>();

export const clearJournalHold = (): void => { held = new Set(); };

export const isHeldForJournal = (c: Crop): boolean => held.has(attemptKey(c));

/** Zapíše chybějící varianty zralých plodů. Vrací počet nově zapsaných variant (ověřeno v deníku). */
export async function doLogCrops(game: GameSnapshot, force: boolean): Promise<number> {
  clearJournalHold();
  if (!S.journalOn || (!force && !S.harvestOn)) return 0;
  // deník se nenačetl (nebo ho hra přejmenovala) – nic nezadržovat
  if (!game.journal) return 0;

  const crops = allSlots(game.tiles);
  const gaveUp = new Set([...attempts].filter(([, n]) => n >= MAX_LOG_ATTEMPTS).map(([k]) => k));
  const targets = pickLogTargets(crops, game.journal, Date.now(), S.maxPerCycle, gaveUp);
  let sent = 0;
  if (targets.length) {
    state.status = `Zapisuji ${targets.length} do sbírky…`; renderLive();
    for (const c of targets) {
      if (!cmdLogItem(c.tileIndex, c.slotsIndex)) { state.status = "Není spojení se hrou"; break; }
      sent++;
      await sleep(S.gapMs);
    }
  }
  if (!sent) { held = heldCrops(crops, game.journal, Date.now(), attempts); return 0; }

  // Ověření: co z chybějících variant v deníku opravdu přibylo.
  await sleep(800);
  const after = await readGame();
  const added: Record<string, Set<string>> = {};
  for (const c of targets.slice(0, sent)) {
    const missing = missingVariants(c, game.journal).filter((v) => !gaveUp.has(variantKey(c.species, v)));
    const now = loggedVariants(after.journal, c.species);
    for (const v of missing) {
      const key = variantKey(c.species, v);
      if (now.has(v)) {
        (added[c.species] ||= new Set()).add(v);
        attempts.delete(key);
        continue;
      }
      const n = (attempts.get(key) || 0) + 1;
      attempts.set(key, n);
      if (n === MAX_LOG_ATTEMPTS) addLog(`📷 Nepodařilo se zapsat ${c.species} (${v}) – plody s touto variantou už nezadržuji`, "warn");
    }
  }
  held = heldCrops(allSlots(after.tiles), after.journal, Date.now(), attempts);

  const total = Object.values(added).reduce((a, s) => a + s.size, 0);
  if (!total) return 0;
  session.logged += total; allTime.logged += total;
  saveAll();
  addLog("📷 " + Object.entries(added).map(([sp, vs]) => `${sp}: ${[...vs].join(", ")}`).join(", "));
  return total;
}
