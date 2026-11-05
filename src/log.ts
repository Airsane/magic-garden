// Log událostí zobrazený v záložce "Log" (posledních 50 záznamů, nejnovější první).

import { renderLive, state } from "./state";

export type LogKind = "" | "ok" | "warn" | "gold";

export interface LogEntry {
  t: number;
  text: string;
  kind: LogKind;
}

export const log: LogEntry[] = [];

export function addLog(text: string, kind: LogKind = ""): void {
  log.unshift({ t: Date.now(), text, kind });
  if (log.length > 50) log.length = 50;
  if (state.tab === "log") renderLive();
}
