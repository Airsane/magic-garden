// Formátování čísel, časů a textu pro UI (česká lokalizace).

type Num = number | null | undefined;

export const fmt = (n: Num): string =>
  n == null || !Number.isFinite(n) ? "–" : Math.round(n).toLocaleString("cs-CZ");

export function fmtShort(n: Num): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace(".", ",") + " mld";
  if (a >= 1e6) return (n / 1e6).toFixed(2).replace(".", ",") + " M";
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(".", ",") + " k";
  return fmt(n);
}

export const signed = (n: Num): string => (n == null ? "–" : (n > 0 ? "+" : "") + fmtShort(n));

/** Doba trvání: "2 h 5 min", "3 min 07 s", "12 s". */
export function dur(ms: number): string {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${String(x).padStart(2, "0")} s`;
  return `${x} s`;
}

/** Přepočet na hodinu; pro krátké intervaly (< 1 min) vrací null. */
export const perHour = (n: Num, ms: number): number | null =>
  ms > 60_000 && n != null ? (n / ms) * 3_600_000 : null;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESC[c]!);

/** "OrangeTulip" → "Orange Tulip". */
export const prettyName = (sp: string): string => String(sp).replace(/([a-z])([A-Z])/g, "$1 $2");
