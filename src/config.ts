// Uživatelské nastavení – ukládá se do localStorage stránky.

export type Tab = "overview" | "garden" | "harvest" | "plant" | "pets" | "calc" | "log";
export type PlantMode = "priority" | "rotate";

export interface PanelState {
  x: number | null;
  y: number | null;
  tab: Tab;
  min: boolean;
  hidden: boolean;
}

export interface Settings {
  // sklizeň
  harvestOn: boolean;
  minSize: number;
  skipPreserved: boolean;
  onlyMutated: boolean;
  /** druhy, které se nesklízí */
  excludeSpecies: string[];
  sellAfter: boolean;
  // sázení
  plantOn: boolean;
  plantMode: PlantMode;
  /** pořadí druhů (priorita) */
  plantOrder: string[];
  /** druhy, které se nesází */
  plantDisabled: string[];
  /** kolik semínek od druhu nechat v batohu */
  seedReserve: number;
  // krmení mazlíčků
  feedOn: boolean;
  /** krmit, když je sytost pod X % */
  feedBelow: number;
  /** krmit až do X % */
  feedTarget: number;
  /** smí sníst plody s mutací */
  feedMutated: boolean;
  /** když v batohu není jídlo, sklidit ho ze zahrady */
  feedFromGarden: boolean;
  /** plodiny, které se nikdy nekrmí */
  feedBanned: string[];
  /** upozornit, když hladový mazlíček nemá co jíst */
  notifyHungry: boolean;
  // obecné
  intervalSec: number;
  gapMs: number;
  maxPerCycle: number;
  notifyMutation: boolean;
  notifySound: boolean;
  /** držet spojení i na pozadí (anti-AFK) */
  keepAlive: boolean;
  panel: PanelState;
}

/** Hlavní přepínače v hlavičce panelu. */
export type ToggleKey = "harvestOn" | "plantOn" | "feedOn";

/** Klíče nastavení, která jdou upravit formulářovým prvkem (`data-k`). */
export type FieldKey = {
  [K in keyof Settings]: Settings[K] extends number | boolean | string ? K : never;
}[keyof Settings];

export const DEFAULTS: Settings = {
  harvestOn: false,
  minSize: 50,
  skipPreserved: true,
  onlyMutated: false,
  excludeSpecies: [],
  sellAfter: false,
  plantOn: false,
  plantMode: "priority",
  plantOrder: [],
  plantDisabled: [],
  seedReserve: 0,
  feedOn: false,
  feedBelow: 40,
  feedTarget: 90,
  feedMutated: false,
  feedFromGarden: true,
  feedBanned: [],
  notifyHungry: true,
  intervalSec: 10,
  gapMs: 450,
  maxPerCycle: 40,
  notifyMutation: false,
  notifySound: true,
  keepAlive: true,
  panel: { x: null, y: null, tab: "overview", min: false, hidden: false },
};

const KEY = "mg-autofarm-settings";

/** Načte objekt z localStorage a doplní chybějící klíče z výchozích hodnot. */
export function readLS<T extends object>(key: string, defaults: T): T {
  const fresh = (): T => JSON.parse(JSON.stringify(defaults));
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null") as Partial<T> | null;
    return stored ? { ...fresh(), ...stored } : fresh();
  } catch { return fresh(); }
}

export function writeLS(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const stored = readLS(KEY, DEFAULTS);

/** Aktuální nastavení (mutuje se na místě, pak se volá `save()`). */
export const S: Settings = { ...stored, panel: { ...DEFAULTS.panel, ...stored.panel } };

export const save = (): void => writeLS(KEY, S);

export function setField<K extends FieldKey>(k: K, v: Settings[K]): void {
  S[k] = v;
}
