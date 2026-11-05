// Sdílený běhový stav (neukládá se) a most k UI.
//
// Logika farmy nemá na UI přímou závislost – jen volá `renderLive()`,
// které UI při startu zaregistruje přes `setRenderer()`.
//
// Pozor: tenhle modul smí za běhu importovat jen `config` (ostatní jen jako
// `import type`), jinak vznikne cyklus importů a hodnoty budou při startu undefined.

import { S, type Tab } from "./config";
import type { GameSnapshot } from "./game/reader";

const emptyGame = (): GameSnapshot => ({
  tiles: null, coins: null, cropInv: null, cropItems: [], favorites: new Set(), seeds: {}, owned: null, pets: null, players: 1,
});

export const state = {
  /** text stavu ve spodní části panelu */
  status: "Připraveno",
  /** právě běží `cycle()` */
  running: false,
  /** právě se krmí (UI pak nepřekresluje karty mazlíčků) */
  feedRunning: false,
  /** do kdy je sklizeň / sázení v pauze po neúspěchu (timestamp) */
  backoffHarvest: 0,
  backoffPlant: 0,
  lastCycle: 0,
  /** otevřená záložka panelu */
  tab: (S.panel.tab || "overview") as Tab,
  /** poslední snímek hry pro UI (obnovuje se každou sekundu) */
  game: emptyGame(),
};

let renderer: () => void = () => {};

export const setRenderer = (fn: () => void): void => { renderer = fn; };

/** Překreslí živé části panelu (bezpečné volat i před vytvořením UI). */
export const renderLive = (): void => renderer();
