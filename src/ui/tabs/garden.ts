// Záložka "Zahrada": mapa políček a stav podle druhu.

import type { GardenSummary, TileObject } from "../../game/garden";
import { state } from "../../state";
import { dur, esc, fmt } from "../../util/format";
import type { TabView } from "../tab";
import { row, tile } from "../templates";

/** Jedna buňka mapy: m = mutace, r = zralé, p = preserved, g = roste, o = jiný objekt, e = volné. */
function cellHTML(i: number, obj: TileObject | null | undefined, ownedSet: Set<number> | null, t: number): string {
  if (!obj) return ownedSet && !ownedSet.has(i) ? `<i style="opacity:0"></i>` : `<i class="e" title="#${i} volné"></i>`;
  if (obj.objectType !== "plant") return `<i class="o" title="#${i} ${esc(obj.objectType || "objekt")}"></i>`;
  const slots = (obj.slots || []).filter((s) => !!s);
  const ripe = slots.filter((s) => Number(s.endTime) > 0 && Number(s.endTime) <= t);
  const mut = ripe.some((s) => Array.isArray(s.mutations) && s.mutations.length);
  const pres = slots.some((s) => s.preserved === true);
  // průměrná zralost plodů 0–1 → sytost zelené
  let p = 0;
  if (slots.length) {
    p = slots.reduce((a, s) => {
      const st = Number(s.startTime) || 0, en = Number(s.endTime) || 0;
      return a + (en > st ? Math.min(1, Math.max(0, (t - st) / (en - st))) : 1);
    }, 0) / slots.length;
  }
  const nextEnd = Math.min(...slots.map((s) => Number(s.endTime) || Infinity).filter((e) => e > t));
  const title = `#${i} ${obj.species || ""} · ${ripe.length}/${slots.length} zralé` +
    (Number.isFinite(nextEnd) ? ` · další za ${dur(nextEnd - t)}` : "");
  const cls = mut ? "m" : ripe.length ? "r" : pres ? "p" : "g";
  return `<i class="${cls}" style="--p:${(0.15 + p * 0.55).toFixed(2)}" title="${esc(title)}"></i>`;
}

function gardenHTML(sum: GardenSummary | null): string {
  const game = state.game;
  if (!sum || !game.tiles) return `<div class="muted">Čekám na data zahrady…</div>`;
  const tiles = game.tiles;
  const t = Date.now();
  const count = Math.max(200, game.owned ? Math.max(...game.owned) + 1 : 0, ...Object.keys(tiles).map((k) => Number(k) + 1));
  const ownedSet = game.owned ? new Set(game.owned) : null;
  const cells: string[] = [];
  for (let i = 0; i < count; i++) cells.push(cellHTML(i, tiles[i], ownedSet, t));

  const species = Object.entries(sum.bySpecies).sort((a, b) => b[1].ripe + b[1].growing - (a[1].ripe + a[1].growing));
  const pct = sum.crops ? Math.round((sum.ripe / sum.crops) * 100) : 0;
  return `
      <div class="grid">
        ${tile(fmt(sum.plants), "rostlin")}
        ${tile(fmt(sum.growing), "roste")}
        ${tile(fmt(sum.ripe), "zralé")}
      </div>
      <h4>Mapa zahrady</h4>
      <div class="map">${cells.join("")}</div>
      <div class="legend">
        <span><b style="background:#6bd26b"></b>zralé</span><span><b style="background:#f0c34a"></b>mutace</span>
        <span><b style="background:rgba(107,210,107,.4)"></b>roste</span><span><b style="background:#6fb6ff"></b>preserved</span>
        <span><b style="background:#8a7a9a"></b>jiné</span><span><b style="border:1px dashed #666"></b>volné</span></div>
      <h4>Stav</h4>
      ${row("Zralost zahrady", pct + " %")}<div class="bar"><i style="width:${pct}%"></i></div>
      ${row("Další dozraje", sum.next ? `${esc(sum.next.species)} za ${dur(sum.next.end - t)}` : "–")}
      ${row("Dozraje do 5 min", fmt(sum.soon))}
      ${row("Zralé s mutací", fmt(sum.mutatedRipe))}
      ${row("Volná políčka", sum.empty != null ? fmt(sum.empty) : "?")}
      <h4>Podle druhu · zralé / roste</h4>
      ${species.length ? species.map(([k, v]) => row(esc(k), `${v.ripe} / ${v.growing}`)).join("") : `<div class="muted">Prázdná zahrada</div>`}`;
}

export const gardenTab: TabView = {
  icon: "🗺️",
  title: "Zahrada",
  live({ live, sum }) {
    live.innerHTML = gardenHTML(sum);
  },
};
