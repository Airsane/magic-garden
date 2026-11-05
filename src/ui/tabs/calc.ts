// Záložka "Kalkulačka": cena plodu, zisk z dávky rostlin a žebříček druhů.
//
// Formulář je navázaný na `calc` (ui/calc/state.ts) přes `data-c`, ne na
// nastavení – stav kalkulačky se neukládá.

import { allPlants, plantInfo } from "../../data/catalog";
import { defaultTimes, resetGrowTimes } from "../../game/growtimes";
import { profitEstimate, rankPlants } from "../../game/profit";
import { renderLive, state } from "../../state";
import { dur, esc, fmt, fmtShort } from "../../util/format";
import { calc, toProfitInput, type CalcState } from "../calc/state";
import type { TabView } from "../tab";
import { row, tile } from "../templates";

const COLORS = ["Gold", "Rainbow"];
const HYDRO = ["Wet", "Chilled", "Frozen", "Thunderstruck", "Thundercharged"];
const LUNAR = ["Dawnlit", "Amberlit", "Dawnbound", "Amberbound"];

type NumKey = "size" | "players" | "plants" | "harvests" | "growMin" | "regrowMin";

const minutes = (sec: number | null) => (sec == null ? "?" : String(Math.round(sec / 6) / 10));

const select = (k: keyof CalcState, label: string, options: [string, string][]) =>
  `<label class="f">${label}<select data-c="${k}">${options.map(([v, t]) =>
    `<option value="${esc(v)}"${calc[k] === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;

const mutSelect = (k: "color" | "hydro" | "lunar", label: string, none: string, list: string[]) =>
  select(k, label, [["", none], ...list.map((m): [string, string] => [m, m])]);

const numInput = (k: NumKey, label: string, placeholder: string, min: number, max?: number) =>
  `<label class="f">${label}<input type="number" data-c="${k}" min="${min}"${max ? ` max="${max}"` : ""} ` +
  `value="${calc[k] ?? ""}" placeholder="${esc(placeholder)}"></label>`;

function formHTML(): string {
  const p = plantInfo(calc.species);
  const multi = p?.harvest === "Multiple";
  const times = defaultTimes(calc.species);
  return `
        <h4>Plodina</h4>
        ${select("species", "Plodina", allPlants().map((x): [string, string] => [x.species, x.name]))}
        ${numInput("size", "Velikost (50–100)", "100", 50, 100)}
        <h4>Mutace</h4>
        ${mutSelect("color", "Barva", "Žádná", COLORS)}
        ${mutSelect("hydro", "Počasí", "Žádné", HYDRO)}
        ${mutSelect("lunar", "Světlo", "Žádné", LUNAR)}
        <h4>Pěstování</h4>
        ${numInput("players", "Hráčů v místnosti (1–6)", String(state.game.players), 1, 6)}
        ${numInput("plants", "Počet rostlin", "1", 1)}
        ${multi ? numInput("harvests", "Počet sklizní", "1", 1) : ""}
        ${numInput("growMin", "Doba růstu (min)", minutes(times.grow), 0)}
        ${multi ? numInput("regrowMin", "Doba dorůstání (min)", minutes(times.regrow), 0) : ""}
        <div class="btns"><button class="btn sec" data-calc-reset>↺ Zapomenout naučené časy</button></div>`;
}

function bindForm(box: HTMLElement): void {
  const redraw = () => { box.innerHTML = formHTML(); bindForm(box); renderLive(); };
  box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-c]").forEach((el) => {
    const k = el.dataset.c as keyof CalcState;
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      if (el.tagName === "SELECT") {
        Object.assign(calc, { [k]: el.value });
        // nový druh = nové výchozí časy v placeholderech
        if (k === "species") { calc.growMin = null; calc.regrowMin = null; redraw(); return; }
      } else {
        const v = el.value.trim() === "" ? null : Number(el.value);
        Object.assign(calc, { [k]: k === "size" || k === "plants" || k === "harvests" ? (v ?? (k === "size" ? 100 : 1)) : v });
      }
      renderLive();
    });
  });
  box.querySelector("[data-calc-reset]")?.addEventListener("click", () => { resetGrowTimes(); redraw(); });
}

function liveHTML(): string {
  const input = toProfitInput(calc, state.game.players);
  const r = profitEstimate(input);
  const ranking = rankPlants(
    { size: input.size, mutations: input.mutations, players: input.players, harvests: input.harvests },
    defaultTimes,
  ).slice(0, 10);
  return `
      <h4>Výsledek</h4>
      <div class="grid">
        ${tile(fmtShort(r.pricePerCrop), "🪙 za plod")}
        ${tile(fmtShort(r.profit), "zisk")}
        ${tile(fmtShort(r.profitPerHour), "🪙 / hod")}
      </div>
      <div style="height:6px"></div>
      ${row("Plodů na sklizeň", fmt(r.cropsPerHarvest))}
      ${row("Cena semínka", fmtShort(r.seedCost))}
      ${row("Tržba", fmtShort(r.revenue))}
      ${row("Náklady na semínka", fmtShort(r.cost))}
      ${row("Zisk", fmtShort(r.profit))}
      ${row("Doba", r.seconds != null ? dur(r.seconds * 1000) : "? – doplň dobu růstu")}
      ${row("Zisk za hodinu", fmtShort(r.profitPerHour))}
      <h4>Žebříček · zisk za hodinu</h4>
      ${ranking.length
        ? ranking.map((x) => row(esc(x.name), fmtShort(x.profitPerHour) + " / h")).join("")
        : `<div class="muted">Zatím neznám žádné doby růstu – zasaď něco a chvíli počkej.</div>`}
      <div class="muted" style="font-size:10.5px">Doby růstu se učí z tvé zahrady. Druhy, které jsi ještě nesázel, v žebříčku chybí.</div>`;
}

export const calcTab: TabView = {
  icon: "🧮",
  title: "Kalkulačka",
  form: formHTML,
  bindForm,
  live({ live }) {
    live.innerHTML = liveHTML();
  },
};
