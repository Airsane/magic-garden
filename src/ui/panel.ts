// Plovoucí panel: kostra, přepínače, záložky, přetahování, Alt+H, vykreslování.

import { S, save, type Tab, type ToggleKey } from "../config";
import { active, cycle } from "../farm/loop";
import { summary } from "../game/garden";
import { readGame } from "../game/reader";
import { addLog } from "../log";
import { connected } from "../net/socket";
import { checkMutations } from "../notify";
import { setRenderer, state } from "../state";
import { allTime, saveAll, session } from "../stats";
import { dur, esc, perHour } from "../util/format";
import { bindFields } from "./fields";
import CSS from "./styles.css";
import type { TabView } from "./tab";
import { gardenTab } from "./tabs/garden";
import { harvestTab } from "./tabs/harvest";
import { logTab } from "./tabs/log";
import { overviewTab } from "./tabs/overview";
import { petsTab } from "./tabs/pets";
import { plantTab } from "./tabs/plant";

/** Pořadí záložek = pořadí v panelu. */
const TABS: Record<Tab, TabView> = {
  overview: overviewTab,
  garden: gardenTab,
  harvest: harvestTab,
  plant: plantTab,
  pets: petsTab,
  log: logTab,
};

let root: HTMLElement | null = null;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;

export function buildUI(): void {
  if (root || !document.body) return;
  const st = document.createElement("style");
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  const el = document.createElement("div");
  el.id = "mgaf";
  el.innerHTML = `
      <div class="hd"><span class="dot" data-dot></span><b>🌻 Auto Farm</b>
        <span class="ic" data-now title="Sklidit a zasadit teď">⚡</span>
        <span class="ic" data-min title="Minimalizovat">–</span></div>
      <div class="quick">
        <div class="sw" data-sw="harvestOn">🌾 Sklizeň</div>
        <div class="sw" data-sw="plantOn">🌱 Sázení</div>
        <div class="sw" data-sw="feedOn">🐾 Krmení</div>
      </div>
      <div data-wrap>
        <div class="tabs">${Object.entries(TABS).map(([k, t]) => `<button data-tab="${k}">${t.icon}<span>${t.title}</span></button>`).join("")}</div>
        <div class="pg"><div data-static></div><div data-live></div></div>
      </div>`;
  document.body.appendChild(el);
  root = el;

  if (S.panel.x != null) { el.style.left = S.panel.x + "px"; el.style.top = S.panel.y + "px"; el.style.right = "auto"; }
  if (S.panel.hidden) el.style.display = "none";
  setMin(S.panel.min);

  el.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    state.tab = b.dataset.tab as Tab; S.panel.tab = state.tab; save(); renderStatic(); renderLive();
  }));
  el.querySelectorAll<HTMLElement>("[data-sw]").forEach((sw) => sw.addEventListener("click", () => toggle(sw.dataset.sw as ToggleKey)));
  $("[data-now]").addEventListener("click", () => {
    state.backoffHarvest = state.backoffPlant = 0; addLog("⚡ Ruční běh"); cycle({ force: true });
  });
  $("[data-min]").addEventListener("click", () => { setMin(!S.panel.min); save(); });
  drag(el, $(".hd"));

  // ať psaní do polí nehýbe postavou ve hře
  el.addEventListener("keydown", (e) => e.stopPropagation(), true);
  el.addEventListener("keyup", (e) => e.stopPropagation(), true);

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "h" || e.key === "H")) {
      S.panel.hidden = !S.panel.hidden; save();
      el.style.display = S.panel.hidden ? "none" : "";
      e.preventDefault();
    }
  });

  setRenderer(renderLive);
  renderStatic();
  renderLive();
  setInterval(tick, 1000);
}

const TOGGLE_LOG: Record<ToggleKey, [string, string]> = {
  harvestOn: ["▶ Sklizeň zapnuta", "⏸ Sklizeň vypnuta"],
  plantOn: ["▶ Sázení zapnuto", "⏸ Sázení vypnuto"],
  feedOn: ["▶ Krmení zapnuto", "⏸ Krmení vypnuto"],
};

function toggle(k: ToggleKey): void {
  S[k] = !S[k]; save();
  if (k === "harvestOn") state.backoffHarvest = 0;
  else if (k === "plantOn") state.backoffPlant = 0;
  addLog(TOGGLE_LOG[k][S[k] ? 0 : 1]);
  if (S[k]) cycle();
  renderLive();
}

function setMin(v: boolean): void {
  S.panel.min = v;
  if (root) $("[data-wrap]").style.display = v ? "none" : "";
}

function drag(el: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest(".ic")) return;
    const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev: PointerEvent) => {
      const x = Math.min(window.innerWidth - 60, Math.max(0, ev.clientX - dx));
      const y = Math.min(window.innerHeight - 30, Math.max(0, ev.clientY - dy));
      el.style.left = x + "px"; el.style.top = y + "px"; el.style.right = "auto";
      S.panel.x = x; S.panel.y = y;
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); save(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

/* ------------------------------- data ------------------------------- */

let lastSample = 0;

/** Každou sekundu: načte hru, aktualizuje mince/rekordy, hlídá mutace, překreslí. */
async function tick(): Promise<void> {
  try { state.game = await readGame(); } catch {}
  const game = state.game;
  if (game.coins != null) {
    if (session.coinsStart == null) session.coinsStart = game.coins;
    session.coinsNow = game.coins;
    session.coinsPeak = Math.max(session.coinsPeak ?? game.coins, game.coins);
    if (Date.now() - lastSample > 30_000 || !session.coinHistory.length) {
      lastSample = Date.now();
      session.coinHistory.push([Date.now(), game.coins]);
      if (session.coinHistory.length > 240) session.coinHistory.shift();
    }
  }
  if (game.tiles) checkMutations(game);
  const rate = perHour(session.harvested, Date.now() - session.start);
  if (rate && Date.now() - session.start > 10 * 60_000 && rate > (allTime.bestPerHour || 0)) {
    allTime.bestPerHour = rate; saveAll();
  }
  renderLive();
}

/* ----------------------------- vykreslení ----------------------------- */

function statusLine(): string {
  if (!connected()) return "🔌 Nepřipojeno ke hře";
  if (!active()) return "⏸ Vše vypnuto – zapni Sklizeň, Sázení nebo Krmení";
  const parts: string[] = [];
  const now = Date.now();
  if (S.harvestOn && state.backoffHarvest > now) parts.push(`sklizeň v pauze ${dur(state.backoffHarvest - now)}`);
  if (S.plantOn && state.backoffPlant > now) parts.push(`sázení v pauze ${dur(state.backoffPlant - now)}`);
  if (state.running) return "⏳ " + state.status;
  const next = Math.max(0, Math.ceil((state.lastCycle + S.intervalSec * 1000 - now) / 1000));
  return `${state.status} · další kontrola za ${next} s${parts.length ? " · " + parts.join(", ") : ""}`;
}

/** Formulářová část záložky – jen při přepnutí záložky. */
function renderStatic(): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => b.classList.toggle("act", b.dataset.tab === state.tab));
  const box = $("[data-static]");
  const view = TABS[state.tab];
  box.innerHTML = view.form?.() ?? "";
  bindFields(box);
  view.bindForm?.(box);
}

/** Živá část: tečka stavu, přepínače a obsah aktuální záložky. */
function renderLive(): void {
  if (!root) return;

  const now = Date.now();
  const dot = $("[data-dot]");
  const paused = (S.harvestOn && state.backoffHarvest > now) || (S.plantOn && state.backoffPlant > now);
  dot.className = "dot" + (!connected() ? "" : !active() ? " idle" : paused ? " pause" : " on");
  dot.title = !connected() ? "Nepřipojeno" : !active() ? "Připojeno, vypnuto" : paused ? "Pauza" : "Běží";
  root.querySelectorAll<HTMLElement>("[data-sw]").forEach((el) => el.classList.toggle("on", !!S[el.dataset.sw as ToggleKey]));
  if (S.panel.min) return;

  TABS[state.tab].live({
    live: $("[data-live]"),
    root,
    sum: state.game.tiles ? summary(state.game) : null,
    statusHTML: `<div class="st">${esc(statusLine())}</div>`,
  });
}
