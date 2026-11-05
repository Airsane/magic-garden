// Globální deklarace pro build a prostředí stránky hry.

/** Verze z package.json, dosadí ji esbuild (scripts/build.mjs). */
declare const __VERSION__: string;

/** Tampermonkey: okno stránky. S `@grant none` + `@inject-into page` neexistuje. */
declare const unsafeWindow: (Window & typeof globalThis) | undefined;

/** CSS soubory se importují jako text (esbuild loader "text"). */
declare module "*.css" {
  const css: string;
  export default css;
}

interface Window {
  /** Registr všech jotai atomů hry (jotai-devtools / babel plugin). */
  jotaiAtomCache?: { cache: Map<string, import("./game/store").Atom> };
  /** React DevTools hook – přes něj se dá dostat k fiber stromu a najít jotai store. */
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: import("./game/store").ReactDevtoolsHook;
  webkitAudioContext?: typeof AudioContext;
}
