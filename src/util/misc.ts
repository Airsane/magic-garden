import { W } from "../env";

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function uuid(): string {
  try { if (W.crypto?.randomUUID) return W.crypto.randomUUID(); } catch {}
  return Date.now().toString(16) + "-" + Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
}

/** Přidá prvek do pole, nebo ho odebere, pokud tam už je. Vrací nové pole. */
export const toggleIn = <T>(list: T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Spočítá výskyty podle klíče: ["a","b","a"] → { a: 2, b: 1 }. */
export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) { const k = key(it); out[k] = (out[k] || 0) + 1; }
  return out;
}
