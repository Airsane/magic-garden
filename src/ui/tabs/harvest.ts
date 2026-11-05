// Záložka "Sklizeň": filtry, upozornění a obecné chování.

import { S } from "../../config";
import type { GardenSummary } from "../../game/garden";
import { state } from "../../state";
import { drawToggleChips } from "../chips";
import type { TabView } from "../tab";
import { cb, num } from "../templates";

function drawExcludeChips(root: HTMLElement, sum: GardenSummary | null): void {
  drawToggleChips({
    box: root.querySelector('[data-chips="excludeSpecies"]'),
    list: "excludeSpecies",
    all: new Set([...Object.keys(sum?.bySpecies || {}), ...Object.keys(state.game.seeds || {}), ...S.excludeSpecies]),
    emptyText: "Zatím žádné druhy",
    redraw: () => drawExcludeChips(root, sum),
  });
}

export const harvestTab: TabView = {
  icon: "🌾",
  title: "Sklizeň",
  form: () => `
        <h4>Filtry sklizně</h4>
        ${num("minSize", "Min. velikost (50–100)", 50, 100)}
        ${cb("skipPreserved", "Přeskočit preserved plody")}
        ${cb("onlyMutated", "Sklízet jen plody s mutací")}
        ${cb("sellAfter", "Po sklizni prodat vše 💰")}
        <h4>Nesklízet tyto druhy <span class="muted" style="text-transform:none;letter-spacing:0">(klikni)</span></h4>
        <div class="chips" data-chips="excludeSpecies"></div>
        <h4>Upozornění</h4>
        ${cb("notifyMutation", "Upozornit, když dozraje mutace ✨")}
        ${cb("notifySound", "Se zvukem")}
        <h4>Chování</h4>
        ${num("intervalSec", "Interval kontroly (s)", 3)}
        ${num("gapMs", "Rozestup akcí (ms)", 250)}
        ${num("maxPerCycle", "Max. akcí za kolo", 1)}
        ${cb("keepAlive", "Držet spojení i na pozadí (anti-AFK)")}
        <div class="muted" style="font-size:10.5px">Změna se projeví po obnovení stránky (F5).</div>
        <div class="btns"><button class="btn" data-run="harvest">🌾 Sklidit teď</button></div>`,
  live({ live, root, sum, statusHTML }) {
    live.innerHTML = statusHTML;
    drawExcludeChips(root, sum);
  },
};
