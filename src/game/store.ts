// Přístup k datům hry přes její jotai store.
//
// Store se hledá dvěma způsoby:
//  1. přes React DevTools hook – projde fiber strom a najde Provider, jehož
//     `value` vypadá jako jotai store (má get/set/sub),
//  2. záložně se dočasně obalí `write` všech atomů v `jotaiAtomCache`; první
//     zápis, který hra udělá, nám dá funkci `get`.
// Atomy se pak hledají podle `debugLabel` (např. "myDataAtom").

import { W } from "../env";
import { addLog } from "../log";

type Getter = (atom: Atom) => unknown;

export interface Atom {
  debugLabel?: string;
  label?: string;
  write?: (this: Atom, get: Getter, set: unknown, ...args: unknown[]) => unknown;
  /** původní `write`, dokud je atom obalený (storeViaWrite) */
  __afOrig?: Atom["write"];
}

export interface JotaiStore {
  get(atom: Atom): unknown;
}

interface Fiber {
  pendingProps?: { value?: unknown } | null;
  child?: Fiber | null;
  sibling?: Fiber | null;
  alternate?: Fiber | null;
}

export interface ReactDevtoolsHook {
  renderers?: Map<number, unknown>;
  getFiberRoots?(rendererId: number): Set<{ current: Fiber }>;
}

let store: JotaiStore | null = null;
let storePending: Promise<JotaiStore | null> | null = null;
const atomCache = () => W.jotaiAtomCache?.cache;

const looksLikeStore = (v: unknown): v is JotaiStore => {
  const o = v as Record<string, unknown> | null;
  return !!o && typeof o.get === "function" && typeof o.set === "function" && typeof o.sub === "function";
};

function storeViaFiber(): JotaiStore | null {
  const hook = W.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.renderers?.size) return null;
  for (const [rid] of hook.renderers) {
    for (const root of hook.getFiberRoots?.(rid) || []) {
      const seen = new Set<Fiber>(), stack: (Fiber | null | undefined)[] = [root.current];
      while (stack.length) {
        const f = stack.pop();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        const v = f.pendingProps?.value;
        if (looksLikeStore(v)) return v;
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
        if (f.alternate) stack.push(f.alternate);
      }
    }
  }
  return null;
}

function storeViaWrite(): Promise<JotaiStore | null> {
  return new Promise((resolve) => {
    const cache = atomCache();
    if (!cache) return resolve(null);
    const patched: Atom[] = [];
    let done = false;
    const restore = () => { for (const a of patched) { a.write = a.__afOrig; delete a.__afOrig; } };
    for (const a of cache.values()) {
      if (!a || typeof a.write !== "function" || a.__afOrig) continue;
      const orig = a.write;
      a.__afOrig = orig;
      a.write = function (get, set, ...args) {
        if (!done) { done = true; restore(); resolve({ get: (x) => get(x) }); }
        return orig.call(this, get, set, ...args);
      };
      patched.push(a);
    }
    setTimeout(() => { if (!done) { done = true; restore(); resolve(null); } }, 5000);
  });
}

function ensureStore(): Promise<JotaiStore | null> {
  if (store) return Promise.resolve(store);
  if (!storePending) {
    storePending = (async () => {
      const s = storeViaFiber() || (await storeViaWrite());
      if (s) { store = s; addLog("Data hry nalezena", "ok"); }
      storePending = null;
      return s;
    })();
  }
  return storePending;
}

const atomIdx: Record<string, Atom> = {};

function atomByLabel(label: string): Atom | null {
  if (atomIdx[label]) return atomIdx[label];
  const cache = atomCache();
  if (!cache) return null;
  for (const a of cache.values()) if ((a?.debugLabel || a?.label) === label) return (atomIdx[label] = a);
  return null;
}

/**
 * Přečte hodnotu atomu podle jeho debugLabel. Typ `T` je jen očekávaný tvar –
 * data pocházejí ze hry a volající s nimi musí zacházet opatrně.
 */
export async function readAtom<T = unknown>(label: string): Promise<T | undefined> {
  const s = await ensureStore();
  const a = atomByLabel(label);
  if (!s || !a) return undefined;
  try { return s.get(a) as T; } catch { return undefined; }
}
