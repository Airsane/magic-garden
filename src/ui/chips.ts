// Seznam klikacích štítků navázaný na pole druhů v nastavení
// (např. "nesklízet tyto druhy"). Kliknutí druh přidá/odebere.

import { S, save } from "../config";
import { toggleIn } from "../util/misc";
import { chips } from "./templates";

type ListKey = "excludeSpecies" | "feedBanned" | "buyDisabled";

export function drawToggleChips(opts: {
  box: HTMLElement | null;
  list: ListKey;
  /** všechny druhy, které se mají nabídnout */
  all: Set<string>;
  emptyText: string;
  label?: (sp: string) => string;
  /** po kliknutí – znovu vykreslit (sada `all` se může změnit) */
  redraw: () => void;
}): void {
  const { box, list, all } = opts;
  if (!box) return;
  // překreslit jen když se něco změnilo, jinak by se ztrácel hover/klik
  const key = [...all].sort().join("|") + "#" + S[list].join("|");
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  if (!all.size) { box.innerHTML = `<span class="muted">${opts.emptyText}</span>`; return; }
  box.innerHTML = chips([...all].sort(), S[list], opts.label);
  box.querySelectorAll<HTMLElement>("[data-sp]").forEach((c) => c.addEventListener("click", () => {
    S[list] = toggleIn(S[list], c.dataset.sp!);
    save(); box.dataset.key = ""; opts.redraw();
  }));
}
