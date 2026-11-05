// Rozhraní jedné záložky panelu.
//
// Každá záložka má dvě části:
//  • `form` – formuláře; vykreslí se jen při přepnutí záložky, aby se pole
//    nepřekreslovala, zatímco do nich uživatel píše,
//  • `live` – živá data; volá se každou sekundu a po každé akci.

import type { GardenSummary } from "../game/garden";

export interface LiveContext {
  /** kontejner pro živou část (`[data-live]`) */
  live: HTMLElement;
  /** kořen panelu – pro prvky ve formulářové části (štítky, seznam semínek) */
  root: HTMLElement;
  sum: GardenSummary | null;
  /** hotové HTML se stavovým řádkem */
  statusHTML: string;
}

export interface TabView {
  icon: string;
  title: string;
  form?: () => string;
  /** navázání prvků z `form`, které neobslouží obecné `bindFields` */
  bindForm?: (box: HTMLElement) => void;
  live: (ctx: LiveContext) => void;
}
