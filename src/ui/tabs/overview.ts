// Záložka "Přehled": mince, statistiky relace a celkové.

import type { GardenSummary } from "../../game/garden";
import { addLog } from "../../log";
import { requestNotif } from "../../notify";
import { renderLive, state } from "../../state";
import { allTime, resetAllTime, resetSession, session } from "../../stats";
import { dur, esc, fmt, fmtShort, perHour, signed } from "../../util/format";
import type { TabView } from "../tab";
import { bars, row, spark, tile } from "../templates";

function overviewHTML(sum: GardenSummary | null): string {
  const game = state.game;
  const now = Date.now();
  const d = now - session.start;
  const gained = session.coinsStart != null && session.coinsNow != null ? session.coinsNow - session.coinsStart : null;
  const hungriest = (game.pets || []).filter((p) => p.pct != null).sort((a, b) => a.pct! - b.pct!)[0];
  const topSpecies = Object.entries(allTime.species).sort((a, b) => b[1] - a[1])[0]?.[0];
  return `
      <div class="grid">
        ${tile(fmtShort(game.coins), "🪙 mince")}
        ${tile(signed(gained), "za relaci")}
        ${tile(fmtShort(perHour(gained, d)), "🪙 / hod")}
      </div>
      ${spark(session.coinHistory.concat(game.coins != null ? [[now, game.coins]] : []))}
      <h4>Relace · ${dur(d)}</h4>
      <div class="grid">
        ${tile(fmt(session.harvested), "sklizeno")}
        ${tile(fmt(session.planted), "zasazeno")}
        ${tile(fmt(session.mutated), "mutací")}
      </div>
      <div style="height:6px"></div>
      ${row("Sklizní za hodinu", fmt(perHour(session.harvested, d)))}
      ${row("Nakrmeno mazlíčků", fmt(session.fed))}
      ${row("Nejhladovější mazlíček", hungriest ? `${esc(hungriest.name)} ${hungriest.pct!.toFixed(0)} %` : "–")}
      ${row("Zralé teď / podle filtrů", sum ? `${fmt(sum.ripe)} / ${fmt(sum.eligible)}` : "–")}
      ${row("Další dozraje", sum?.next ? `${esc(sum.next.species)} za ${dur(sum.next.end - now)}` : "–")}
      ${row("Volná políčka", sum?.empty != null ? `${fmt(sum.empty)} z ${fmt(sum.owned)}` : "–")}
      ${row("Plodiny v batohu", fmt(game.cropInv))}
      ${row("Odpojení v relaci", fmt(session.disconnects))}
      ${row("Nejvíc mincí v relaci", fmtShort(session.coinsPeak))}
      ${row("Neprošlo (sklizeň / sázení)", `${fmt(session.failedHarvest)} / ${fmt(session.failedPlant)}`)}
      <h4>Nejvíc sklizeno</h4>
      ${bars(session.species, 5)}
      <h4>Celkem od ${new Date(allTime.since).toLocaleDateString("cs-CZ")}</h4>
      ${row("Sklizeno", fmt(allTime.harvested))}
      ${row("Zasazeno", fmt(allTime.planted))}
      ${row("Nakrmeno", fmt(allTime.fed))}
      ${row("S mutací", fmt(allTime.mutated))}
      ${row("Rekord sklizní / hod", fmt(allTime.bestPerHour))}
      ${row("Nejčastější druh", esc(topSpecies || "–"))}`;
}

export const overviewTab: TabView = {
  icon: "📊",
  title: "Přehled",
  form: () => `<div class="btns" style="margin:0 0 8px">
        <button class="btn sec" data-reset>↺ Relace</button>
        <button class="btn sec" data-reset-all>↺ Celkové</button>
        <button class="btn sec" data-notif title="Povolit systémová oznámení">🔔</button></div>`,
  bindForm(box) {
    box.querySelector("[data-reset]")?.addEventListener("click", () => {
      if (!confirm("Vynulovat statistiky této relace?")) return;
      resetSession(); addLog("Statistiky relace vynulovány"); renderLive();
    });
    box.querySelector("[data-reset-all]")?.addEventListener("click", () => {
      if (!confirm("Vynulovat celkové statistiky?")) return;
      resetAllTime(); renderLive();
    });
    box.querySelector("[data-notif]")?.addEventListener("click", requestNotif);
  },
  live({ live, sum, statusHTML }) {
    live.innerHTML = overviewHTML(sum) + statusHTML;
  },
};
