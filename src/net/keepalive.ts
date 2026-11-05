// Držení spojení (anti-AFK).
//
// Hra odpojí hráče, když je záložka na pozadí nebo okno není aktivní.
// Tohle hře tvrdí, že je okno pořád vidět, brání prohlížeči uspat záložku
// a občas pošle "pohyb myši" a aktuální pozici hráče.

import { W } from "../env";
import { readAtom } from "../game/store";
import { connected, sendRaw } from "./socket";

export function installKeepAlive(): void {
  const docProto = Object.getPrototypeOf(document) as Document;
  const swallow = (e: Event) => { e.stopImmediatePropagation(); };
  for (const type of ["visibilitychange", "blur", "focusout", "pagehide", "freeze"]) {
    document.addEventListener(type, swallow, true);
    W.addEventListener(type, swallow, true);
  }
  try { Object.defineProperty(docProto, "hidden", { configurable: true, get: () => false }); } catch {}
  try { Object.defineProperty(docProto, "visibilityState", { configurable: true, get: () => "visible" }); } catch {}
  try { document.hasFocus = () => true; } catch {}

  // Tichý zvuk brání prohlížeči zpomalit/uspat záložku na pozadí.
  let ka: AudioContext | null = null;
  const startAudio = () => {
    try {
      if (!ka) {
        const Ctx = W.AudioContext || W.webkitAudioContext!;
        ka = new Ctx({ latencyHint: "interactive" });
        const g = ka.createGain(); g.gain.value = 0.00001;
        const o = ka.createOscillator(); o.frequency.value = 1;
        o.connect(g).connect(ka.destination); o.start();
      }
      if (ka.state !== "running") ka.resume?.().catch(() => {});
    } catch {}
  };
  // Prohlížeč pustí zvuk až po první interakci.
  for (const t of ["pointerdown", "keydown"]) W.addEventListener(t, startAudio, true);

  setInterval(() => {
    try {
      const target = document.querySelector("canvas") || document.body;
      target?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 1, clientY: 1 }));
    } catch {}
    if (ka && ka.state !== "running") ka.resume?.().catch(() => {});
  }, 25_000);

  // Pošle serveru pozici, na které hráč už stojí – jako by se hýbal.
  setInterval(async () => {
    if (!connected()) return;
    try {
      const pos = await readAtom<{ x?: number; y?: number }>("positionAtom");
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        sendRaw({ scopePath: ["Room", "Quinoa"], type: "PlayerPosition", position: { x: Math.round(pos.x!), y: Math.round(pos.y!) } });
      }
    } catch {}
  }, 60_000);
}
