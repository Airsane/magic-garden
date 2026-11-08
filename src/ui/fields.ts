// Obecné navázání formulářových prvků na nastavení.
//
//  • `[data-k="klíč"]` – checkbox / číslo / select, hodnota se ukládá do S[klíč]
//  • `[data-run="harvest|plant|feed|buy"]` – tlačítko "udělej to teď"

import { clampField, S, save, setField, type FieldKey } from "../config";
import { cycle, restartTimer } from "../farm/loop";
import { addLog } from "../log";
import { requestNotif, toast } from "../notify";
import { state } from "../state";

export function bindFields(box: HTMLElement): void {
  box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]").forEach((el) => {
    const k = el.dataset.k as FieldKey;
    const isCheckbox = el instanceof HTMLInputElement && el.type === "checkbox";
    if (isCheckbox) el.checked = !!S[k]; else el.value = String(S[k]);
    el.addEventListener("change", () => {
      let v: number | boolean | string =
        isCheckbox ? (el as HTMLInputElement).checked : el.tagName === "SELECT" ? el.value : Number(el.value);
      if (typeof v === "number") v = clampField(k, v);
      setField(k, v as never); el.value = String(v); save();
      if (k === "intervalSec") restartTimer();
      if (k === "notifyMutation" && v) requestNotif();
      if (k === "keepAlive") toast("Obnov stránku (F5), aby se změna projevila");
    });
  });

  box.querySelectorAll<HTMLElement>("[data-run]").forEach((b) => b.addEventListener("click", () => {
    const what = b.dataset.run as "harvest" | "plant" | "feed" | "buy";
    if (what === "harvest") state.backoffHarvest = 0;
    else if (what === "plant") state.backoffPlant = 0;
    else if (what === "buy") state.backoffBuy = 0;
    addLog({ harvest: "Ruční sklizeň", plant: "Ruční sázení", feed: "Ruční krmení", buy: "Ruční nákup" }[what]);
    cycle({ force: true, harvest: what === "harvest", plant: what === "plant", feed: what === "feed", buy: what === "buy" });
  }));
}
