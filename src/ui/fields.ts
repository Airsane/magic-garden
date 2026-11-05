// Obecné navázání formulářových prvků na nastavení.
//
//  • `[data-k="klíč"]` – checkbox / číslo / select, hodnota se ukládá do S[klíč]
//  • `[data-run="harvest|plant|feed"]` – tlačítko "udělej to teď"

import { DEFAULTS, S, save, setField, type FieldKey } from "../config";
import { cycle, restartTimer } from "../farm/loop";
import { addLog } from "../log";
import { requestNotif, toast } from "../notify";
import { state } from "../state";

/** Omezení rozsahu hodnot – stejné meze jako v HTML atributech min/max. */
function clamp(k: FieldKey, v: number): number {
  switch (k) {
    case "gapMs": return Math.max(250, v || DEFAULTS.gapMs);
    case "intervalSec": return Math.max(3, v || DEFAULTS.intervalSec);
    case "minSize": return Math.min(100, Math.max(50, v || 50));
    case "maxPerCycle": return Math.max(1, v || 1);
    case "seedReserve": return Math.max(0, v || 0);
    case "feedBelow": return Math.min(99, Math.max(1, v || 40));
    case "feedTarget": return Math.min(100, Math.max(S.feedBelow + 1, v || 90));
    default: return v;
  }
}

export function bindFields(box: HTMLElement): void {
  box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]").forEach((el) => {
    const k = el.dataset.k as FieldKey;
    const isCheckbox = el instanceof HTMLInputElement && el.type === "checkbox";
    if (isCheckbox) el.checked = !!S[k]; else el.value = String(S[k]);
    el.addEventListener("change", () => {
      let v: number | boolean | string =
        isCheckbox ? (el as HTMLInputElement).checked : el.tagName === "SELECT" ? el.value : Number(el.value);
      if (typeof v === "number") v = clamp(k, v);
      setField(k, v as never); el.value = String(v); save();
      if (k === "intervalSec") restartTimer();
      if (k === "notifyMutation" && v) requestNotif();
      if (k === "keepAlive") toast("Obnov stránku (F5), aby se změna projevila");
    });
  });

  box.querySelectorAll<HTMLElement>("[data-run]").forEach((b) => b.addEventListener("click", () => {
    const what = b.dataset.run as "harvest" | "plant" | "feed";
    if (what === "harvest") state.backoffHarvest = 0; else if (what === "plant") state.backoffPlant = 0;
    addLog({ harvest: "Ruční sklizeň", plant: "Ruční sázení", feed: "Ruční krmení" }[what]);
    cycle({ force: true, harvest: what === "harvest", plant: what === "plant", feed: what === "feed" });
  }));
}
