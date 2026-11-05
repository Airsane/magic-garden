// Záložka "Mazlíčci": nastavení krmení a karty aktivních mazlíčků.

import { S } from "../../config";
import { cycle } from "../../farm/loop";
import { addLog } from "../../log";
import { state } from "../../state";
import { allTime, session } from "../../stats";
import { esc, fmt, prettyName } from "../../util/format";
import { drawToggleChips } from "../chips";
import type { TabView } from "../tab";
import { cb, num, row } from "../templates";

function hungerColor(p: number | null): string {
  if (p == null) return "#777";
  if (p < S.feedBelow) return "linear-gradient(90deg,#c2452f,#e98b4a)";
  if (p < S.feedTarget) return "linear-gradient(90deg,#b58a1f,#f0c34a)";
  return "linear-gradient(90deg,#3f9446,#6bd26b)";
}

function petsHTML(): string {
  const game = state.game;
  if (game.pets == null) return `<div class="muted">Čekám na data mazlíčků…</div>`;
  if (!game.pets.length) return `<div class="muted">Nemáš aktivní žádné mazlíčky.</div>`;
  const cards = game.pets.map((p) => {
    const inBag = game.cropItems.filter((it) => p.diet.includes(String(it?.species || "")) && !game.favorites.has(String(it?.id || ""))).length;
    const muts = p.mutations.length ? ` · ✨ ${esc(p.mutations.join(", "))}` : "";
    return `<div class="pet">
        <div class="t"><b>${esc(p.name)}</b><span class="muted">${p.pct == null ? "?" : p.pct.toFixed(0) + " %"}</span>
          <button data-feedpet="${esc(p.id)}" title="Dát jednu plodinu">🍖</button></div>
        <div class="hb"><i style="width:${p.pct ?? 0}%;background:${hungerColor(p.pct)}"></i></div>
        <div class="d">${esc(prettyName(p.species))}${muts} · ${fmt(p.hunger)} / ${fmt(p.max)}</div>
        <div class="d">Jí: ${esc(p.diet.map(prettyName).join(", ") || "neznámé")} · v batohu ${fmt(inBag)} ks</div>
      </div>`;
  }).join("");
  return `<h4>Aktivní mazlíčci</h4>${cards}
      ${row("Nakrmeno v relaci", fmt(session.fed))}
      ${row("Nakrmeno celkem", fmt(allTime.fed))}
      ${row("Neprošlo", fmt(session.failedFeed))}`;
}

function bindPetButtons(live: HTMLElement): void {
  live.querySelectorAll<HTMLElement>("[data-feedpet]").forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", () => {
      addLog("Ruční krmení");
      cycle({ force: true, harvest: false, plant: false, feed: true, petId: b.dataset.feedpet! });
    });
  });
}

function drawFeedChips(root: HTMLElement): void {
  drawToggleChips({
    box: root.querySelector('[data-chips="feedBanned"]'),
    list: "feedBanned",
    all: new Set([...(state.game.pets || []).flatMap((p) => p.diet), ...S.feedBanned]),
    emptyText: "Žádní aktivní mazlíčci",
    label: prettyName,
    redraw: () => drawFeedChips(root),
  });
}

export const petsTab: TabView = {
  icon: "🐾",
  title: "Mazlíčci",
  form: () => `
        <h4>Krmení</h4>
        ${num("feedBelow", "Krmit pod sytostí (%)", 1, 99)}
        ${num("feedTarget", "Krmit až do (%)", 2, 100)}
        ${cb("feedMutated", "Smí jíst plody s mutací")}
        ${cb("feedFromGarden", "Když chybí jídlo, sklidit ho ze zahrady")}
        ${cb("notifyHungry", "Upozornit, když není čím krmit")}
        <h4>Nikdy nekrmit <span class="muted" style="text-transform:none;letter-spacing:0">(klikni)</span></h4>
        <div class="chips" data-chips="feedBanned"></div>
        <div class="btns"><button class="btn" data-run="feed">🍖 Nakrmit hladové teď</button></div>
        <div class="muted" style="font-size:10.5px;margin-top:5px">Oblíbené plodiny (⭐) se nikdy nekrmí.</div>`,
  live({ live, root, statusHTML }) {
    // během krmení karty nepřekreslovat (tlačítka by mizela pod kurzorem)
    if (!state.feedRunning || !live.innerHTML) live.innerHTML = petsHTML() + statusHTML;
    bindPetButtons(live);
    drawFeedChips(root);
  },
};
