// Záložka "Log": posledních 50 událostí.

import { log } from "../../log";
import { esc } from "../../util/format";
import type { TabView } from "../tab";

function logHTML(): string {
  if (!log.length) return `<div class="muted">Zatím žádné události</div>`;
  return `<div class="lg">${log.map((l) =>
    `<div><time>${new Date(l.t).toLocaleTimeString("cs-CZ")}</time><span class="${l.kind}">${esc(l.text)}</span></div>`).join("")}</div>`;
}

export const logTab: TabView = {
  icon: "📜",
  title: "Log",
  live({ live }) {
    live.innerHTML = logHTML();
  },
};
