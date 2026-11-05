/** Okno stránky hry (ve Tampermonkey s izolací by to bylo `unsafeWindow`). */
export const W: Window & typeof globalThis = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

export const LOG = (...a: unknown[]): void => console.log("[AutoFarm]", ...a);
