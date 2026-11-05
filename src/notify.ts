// Upozornění: toast v okně, pípnutí, systémová oznámení, hlídání mutací.

import { S } from "./config";
import { W } from "./env";
import { allSlots, isRipe } from "./game/garden";
import type { GameSnapshot } from "./game/reader";
import { addLog } from "./log";

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string): void {
  let t = document.getElementById("mgaf-toast");
  if (!t) { t = document.createElement("div"); t.id = "mgaf-toast"; document.body.appendChild(t); }
  t.textContent = text;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.opacity = "0"), 3500);
}

let audioCtx: AudioContext | null = null;

export function beep(): void {
  try {
    audioCtx ||= new (W.AudioContext || W.webkitAudioContext!)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.36);
  } catch {}
}

export function requestNotif(): void {
  try {
    if (W.Notification && W.Notification.permission === "default") W.Notification.requestPermission();
    else toast(W.Notification?.permission === "granted" ? "Oznámení jsou povolená" : "Oznámení jsou v prohlížeči zakázaná");
  } catch {}
}

/** Plody s mutací, o kterých už víme (tile:slot:endTime). */
const notified = new Set<string>();

/** Upozorní na každý nově dozrálý plod s mutací. */
export function checkMutations(game: GameSnapshot): void {
  if (!S.notifyMutation) return;
  const now = Date.now();
  for (const c of allSlots(game.tiles)) {
    if (!isRipe(c, now) || !c.mutations.length) continue;
    const key = `${c.tileIndex}:${c.slotsIndex}:${c.end}`;
    if (notified.has(key)) continue;
    notified.add(key);
    const text = `✨ Dozrálo: ${c.species} (${c.mutations.join(", ")})`;
    addLog(text, "gold");
    toast(text);
    if (S.notifySound) beep();
    try {
      if (W.Notification?.permission === "granted" && document.hidden) new W.Notification("Magic Garden", { body: text });
    } catch {}
  }
}
