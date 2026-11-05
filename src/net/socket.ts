// Napojení na WebSocket hry a číslování příkazů.
//
// Server přijímá příkazy (`QuinoaCommand`) jen s rostoucím `commandSequence`.
// Hra si ho počítá sama, takže jakmile vložíme vlastní příkaz, musíme od té
// chvíle přečíslovávat i všechny příkazy hry:
//
//  • `Welcome` od serveru nese `executedCommandSequence` → odtud začínáme.
//  • Dokud jsme nic neposlali (`injected === 0`), jen sledujeme čísla hry.
//  • Po prvním vlastním příkazu každý příkaz hry dostane `nextSeq++`.
//  • Naše příkazy poznáme podle `requestId` v `ownIds` – ty už číslo mají.

import { W, LOG } from "../env";
import { addLog } from "../log";
import { session } from "../stats";
import { uuid } from "../util/misc";
import { closeReason, realHidden } from "./visibility";

const NativeWS = W.WebSocket;
let gameWS: WebSocket | null = null;
let nextSeq = 1;
let injected = 0;
const ownIds = new Set<string>();

interface QuinoaMessage {
  type?: string;
  requestId?: string;
  commandSequence?: number;
}

function reset(executed = 0): void {
  nextSeq = executed + 1; injected = 0; ownIds.clear();
}

function seed(executed: unknown): void {
  const n = Number(executed);
  if (!Number.isFinite(n) || n < 0) return;
  reset(n);
}

/** Obalí `WebSocket.prototype.send` a konstruktor `WebSocket`. Volat co nejdřív (document-start). */
export function installSocketHook(): void {
  const origSend = NativeWS.prototype.send;
  NativeWS.prototype.send = function (this: WebSocket, data: Parameters<WebSocket["send"]>[0]) {
    try {
      if (typeof data === "string" && data.includes('"QuinoaCommand"')) {
        const msg = JSON.parse(data) as QuinoaMessage | null;
        if (msg?.type === "QuinoaCommand") {
          if (!gameWS) gameWS = this;
          if (msg.requestId && ownIds.delete(msg.requestId)) {
            /* náš příkaz – už očíslovaný */
          } else if (!injected) {
            const v = Number(msg.commandSequence);
            if (Number.isFinite(v) && v >= nextSeq) nextSeq = v + 1;
          } else {
            const own = Number(msg.commandSequence);
            if (Number.isFinite(own) && own > nextSeq) nextSeq = own;
            msg.commandSequence = nextSeq++;
            data = JSON.stringify(msg);
          }
        }
      }
    } catch (e) { console.error("[AutoFarm] send hook", e); }
    return origSend.call(this, data);
  };

  function WrappedWS(url: string | URL, protocols?: string | string[]): WebSocket {
    const ws = protocols !== undefined ? new NativeWS(url, protocols) : new NativeWS(url);
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (typeof ev.data !== "string" || !ev.data.includes("Welcome")) return;
      try {
        const j = JSON.parse(ev.data);
        if (j?.type === "Welcome") { gameWS = ws; seed(j.executedCommandSequence); addLog("Připojeno ke hře", "ok"); }
      } catch {}
    });
    ws.addEventListener("close", (ev: CloseEvent) => {
      if (ws === gameWS) {
        gameWS = null;
        const why = closeReason(ev);
        session.disconnects++;
        addLog(`Spojení se hrou ukončeno – ${why}`, "warn");
        LOG("close", ev.code, ev.reason, "hidden:", realHidden());
      }
      reset();
    });
    return ws;
  }
  WrappedWS.prototype = NativeWS.prototype;
  Object.assign(WrappedWS, {
    CONNECTING: NativeWS.CONNECTING, OPEN: NativeWS.OPEN, CLOSING: NativeWS.CLOSING, CLOSED: NativeWS.CLOSED,
  });
  W.WebSocket = WrappedWS as unknown as typeof WebSocket;
}

export const connected = (): boolean => !!gameWS && gameWS.readyState === NativeWS.OPEN;

/** Pošle zprávu na socket hry bez číslování (např. PlayerPosition). */
export function sendRaw(msg: object): boolean {
  if (!connected()) return false;
  gameWS!.send(JSON.stringify(msg));
  return true;
}

/** Pošle herní příkaz se správným `commandSequence`. Vrací false, když není spojení. */
export function sendCommand(command: { type: string } & Record<string, unknown>): boolean {
  if (!connected()) return false;
  const requestId = uuid();
  ownIds.add(requestId);
  if (ownIds.size > 64) {
    const oldest = ownIds.values().next().value;
    if (oldest !== undefined) ownIds.delete(oldest);
  }
  injected++;
  return sendRaw({
    scopePath: ["Room", "Quinoa"], type: "QuinoaCommand",
    requestId, commandSequence: nextSeq++, command,
  });
}
