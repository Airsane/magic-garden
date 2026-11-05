// Malé HTML šablony pro panel. Hodnoty z hry vždy prohnat `esc()` před vložením.

import type { FieldKey } from "../config";
import { esc, fmt } from "../util/format";

/** Řádek "popisek … hodnota". */
export const row = (k: string, v: string) => `<div class="row"><span>${k}</span><span>${v}</span></div>`;

/** Dlaždice s velkým číslem a popiskem. */
export const tile = (v: string, l: string) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`;

/** Zaškrtávátko navázané na nastavení `k` (viz bindFields). */
export const cb = (k: FieldKey, t: string) => `<label class="f"><input type="checkbox" data-k="${k}"> ${t}</label>`;

/** Číselné pole navázané na nastavení `k` (viz bindFields). */
export const num = (k: FieldKey, t: string, min: number, max?: number) =>
  `<label class="f">${t}<input type="number" data-k="${k}" min="${min}"${max ? ` max="${max}"` : ""}></label>`;

/** Žebříček nejčastějších položek s pruhy. */
export function bars(obj: Record<string, number>, n = 6): string {
  const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (!e.length) return `<div class="muted">Zatím nic</div>`;
  const max = e[0]![1];
  return e.map(([k, v]) => `${row(esc(k), fmt(v))}<div class="bar"><i style="width:${(v / max) * 100}%"></i></div>`).join("");
}

/** Malý SVG graf z bodů [čas, hodnota]. */
export function spark(points: [number, number][]): string {
  if (points.length < 2) return `<div class="muted" style="font-size:11px">Graf se ukáže po pár minutách…</div>`;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (x: number) => ((x - x0) / (x1 - x0 || 1)) * 280, Y = (y: number) => 38 - ((y - y0) / (y1 - y0 || 1)) * 34;
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
  return `<svg class="spark" viewBox="0 0 280 42" preserveAspectRatio="none">
      <path d="${d}L280,42L0,42Z" fill="rgba(107,210,107,.15)"/>
      <path d="${d}" fill="none" stroke="#6bd26b" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Klikací štítky pro seznam druhů (zapnuto/vypnuto). */
export const chips = (all: string[], off: string[], label: (sp: string) => string = (s) => s) =>
  all.map((sp) => `<span class="chip${off.includes(sp) ? " off" : ""}" data-sp="${esc(sp)}">${esc(label(sp))}</span>`).join("");
