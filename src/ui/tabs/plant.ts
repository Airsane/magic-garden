// Záložka "Sázení": režim, rezerva a pořadí (priorita) semínek.

import { S, save } from "../../config";
import { plantInfo } from "../../data/catalog";
import { plantCandidates } from "../../farm/plant";
import type { GardenSummary } from "../../game/garden";
import { state } from "../../state";
import { session } from "../../stats";
import { esc, fmt, fmtShort } from "../../util/format";
import { toggleIn } from "../../util/misc";
import { drawToggleChips } from "../chips";
import type { TabView } from "../tab";
import { bars, cb, num, row } from "../templates";

function plantLiveHTML(sum: GardenSummary | null): string {
  const game = state.game;
  const total = Object.values(game.seeds || {}).reduce((a, b) => a + b, 0);
  return `
      <h4>Přehled</h4>
      ${row("Volná políčka", sum?.empty != null ? `${fmt(sum.empty)} z ${fmt(sum.owned)}` : game.tiles ? "mapa se načítá…" : "–")}
      ${row("Semínek v batohu", fmt(total))}
      ${row("Zasazeno v relaci", fmt(session.planted))}
      ${row("Koupeno v relaci", `${fmt(session.seedsBought)} ks · ${fmtShort(session.seedCoins)} 🪙`)}
      ${Object.keys(session.plantedSpecies).length ? "<h4>Nejvíc zasazeno</h4>" + bars(session.plantedSpecies, 4) : ""}`;
}

/** Seznam semínek s checkboxem (sázet/nesázet) a šipkami pro pořadí. */
function drawSeeds(root: HTMLElement): void {
  const box = root.querySelector<HTMLElement>("[data-seeds]");
  if (!box) return;
  const seeds = state.game.seeds || {};
  plantCandidates(seeds); // doplní nové druhy do pořadí
  const order = S.plantOrder;
  const key = order.join("|") + "#" + S.plantDisabled.join("|") + "#" + order.map((s) => seeds[s] || 0).join(",");
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  if (!order.length) { box.innerHTML = `<div class="muted">V batohu nemáš žádná semínka</div>`; return; }
  box.innerHTML = order.map((sp, i) => {
    const q = seeds[sp] || 0;
    const on = !S.plantDisabled.includes(sp);
    return `<div class="sp">
        <input type="checkbox" data-en="${esc(sp)}"${on ? " checked" : ""}>
        <span class="n"${q ? "" : ' style="opacity:.45"'}>${i + 1}. ${esc(sp)}</span>
        <span class="q">${fmt(q)} ks</span>
        <span class="mv" data-up="${i}" title="Výš">▲</span><span class="mv" data-down="${i}" title="Níž">▼</span></div>`;
  }).join("") + `<div class="muted" style="font-size:10.5px;margin-top:4px">Druhy bez semínek se přeskočí.</div>`;

  const redraw = () => { save(); box.dataset.key = ""; drawSeeds(root); };
  box.querySelectorAll<HTMLInputElement>("[data-en]").forEach((c) => c.addEventListener("change", () => {
    S.plantDisabled = toggleIn(S.plantDisabled, c.dataset.en!);
    redraw();
  }));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    redraw();
  };
  box.querySelectorAll<HTMLElement>("[data-up]").forEach((b) => b.addEventListener("click", () => move(+b.dataset.up!, -1)));
  box.querySelectorAll<HTMLElement>("[data-down]").forEach((b) => b.addEventListener("click", () => move(+b.dataset.down!, 1)));
}

/** Štítky "nekupovat": jednorázová semínka, která má obchod teď skladem. */
function drawBuyChips(root: HTMLElement): void {
  drawToggleChips({
    box: root.querySelector('[data-chips="buyDisabled"]'),
    list: "buyDisabled",
    all: new Set([
      ...state.game.seedOffers.map((o) => o.species).filter((sp) => plantInfo(sp)?.harvest === "Single"),
      ...S.buyDisabled,
    ]),
    emptyText: "Obchod teď nemá jednorázová semínka",
    redraw: () => drawBuyChips(root),
  });
}

export const plantTab: TabView = {
  icon: "🌱",
  title: "Sázení",
  form: () => `
        <h4>Jak sázet</h4>
        <label class="f">Režim<select data-k="plantMode">
          <option value="priority">Podle priority</option>
          <option value="rotate">Střídat druhy</option></select></label>
        ${num("seedReserve", "Nechat v batohu (ks)", 0)}
        <h4>Semínka · pořadí = priorita</h4>
        <div data-seeds></div>
        <div class="btns"><button class="btn" data-run="plant">🌱 Zasadit teď</button></div>
        <h4>Nákup semínek</h4>
        ${cb("buyOn", "Kupovat semínka (jen jednorázové rostliny)")}
        ${num("buyTarget", "Držet v batohu (ks od druhu)", 1)}
        ${num("buyCoinReserve", "Nechat si mincí", 0)}
        <h4>Nekupovat <span class="muted" style="text-transform:none;letter-spacing:0">(klikni)</span></h4>
        <div class="chips" data-chips="buyDisabled"></div>
        <div class="btns"><button class="btn" data-run="buy">🛒 Koupit teď</button></div>
        <div class="muted" style="font-size:10.5px">Keře a stromy (víc sklizní) se nekupují nikdy.</div>`,
  live({ live, root, sum, statusHTML }) {
    live.innerHTML = plantLiveHTML(sum) + statusHTML;
    drawSeeds(root);
    drawBuyChips(root);
  },
};
