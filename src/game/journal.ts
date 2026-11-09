// Sbírka (deník) hry: které varianty plodů už jsou zapsané a které chybí.
//
// Čistá logika bez socketu a DOM – zápis samotný je ve `farm/journal.ts`.

import { isRipe, type Crop } from "./garden";

/** Varianty plodů, které deník hry zná (z kódu hry). `Max Weight` nepředpovídáme. */
export const JOURNAL_VARIANTS: readonly string[] = [
  "Normal", "Wet", "Chilled", "Frozen", "Dawnlit", "Ambershine", "Thunderstruck",
  "Gold", "Rainbow", "Dawncharged", "Ambercharged", "Thundercharged", "Max Weight",
];

/** Po tolika neúspěšných pokusech o zápis se plod uvolní ke sklizni. */
export const MAX_LOG_ATTEMPTS = 3;

/** `myDataAtom.journal` – jen část, kterou čteme. */
export interface Journal {
  produce?: Record<string, { variantsLogged?: { variant?: string }[] } | null | undefined>;
}

const KNOWN = new Set(JOURNAL_VARIANTS);

/** Varianty plodu: jeho známé mutace, bez nich `Normal`. */
export function cropVariants(c: Pick<Crop, "mutations">): string[] {
  const muts = c.mutations.filter((m) => KNOWN.has(m));
  return muts.length ? muts : ["Normal"];
}

export function loggedVariants(journal: Journal | null, species: string): Set<string> {
  const list = journal?.produce?.[species]?.variantsLogged;
  return new Set((Array.isArray(list) ? list : []).map((v) => String(v?.variant ?? "")));
}

export function missingVariants(c: Pick<Crop, "species" | "mutations">, journal: Journal | null): string[] {
  const have = loggedVariants(journal, c.species);
  return cropVariants(c).filter((v) => !have.has(v));
}

/** Klíč počítadla pokusů – nový plod na stejném místě má jiný `end`. */
export const attemptKey = (c: Pick<Crop, "tileIndex" | "slotsIndex" | "end">): string =>
  `${c.tileIndex}:${c.slotsIndex}:${c.end}`;

/**
 * Zralé plody s chybějící variantou, nejvýš `max`. Plod se vynechá, když všechny
 * jeho chybějící varianty už pokrývá dřív vybraný plod stejného druhu.
 */
export function pickLogTargets(crops: readonly Crop[], journal: Journal | null, now: number, max: number): Crop[] {
  const out: Crop[] = [];
  const covered = new Set<string>();
  for (const c of crops) {
    if (out.length >= max) break;
    if (!isRipe(c, now)) continue;
    const missing = missingVariants(c, journal).filter((v) => !covered.has(c.species + "|" + v));
    if (!missing.length) continue;
    missing.forEach((v) => covered.add(c.species + "|" + v));
    out.push(c);
  }
  return out;
}

/** Klíče zralých plodů s chybějící variantou a méně než MAX_LOG_ATTEMPTS pokusy. */
export function heldCrops(crops: readonly Crop[], journal: Journal | null, now: number, attempts: ReadonlyMap<string, number>): Set<string> {
  const out = new Set<string>();
  for (const c of crops) {
    if (!isRipe(c, now) || !missingVariants(c, journal).length) continue;
    const key = attemptKey(c);
    if ((attempts.get(key) || 0) < MAX_LOG_ATTEMPTS) out.add(key);
  }
  return out;
}
