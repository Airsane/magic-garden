// Herní příkazy, které skript posílá. Všechny vrací false, když není spojení.

import { purchaseCommand, readViewMode } from "../game/shop";
import { uuid } from "../util/misc";
import { sendCommand } from "./socket";

/** Sklidí plod. `cropItemId` je id, pod kterým se plod objeví v batohu. */
export const cmdHarvest = (tile: number, slotsIndex: number, cropItemId: string = uuid()) =>
  sendCommand({ type: "HarvestCrop", slot: tile, slotsIndex, cropItemId });

export const cmdPlant = (tile: number, species: string) =>
  sendCommand({ type: "PlantSeed", slot: tile, species });

/** Zapíše plod na poli do sbírky (deníku). */
export const cmdLogItem = (tile: number, slotsIndex: number) =>
  sendCommand({ type: "LogItem", target: { kind: "growSlot", slot: tile, slotsIndex } });

export const cmdSellAll = () => sendCommand({ type: "SellAllCrops" });

/** Koupí semínka v obchodě místnosti (viewMode podle nastavení obchodu ve hře). */
export function cmdBuySeed(species: string, quantity: number): boolean {
  let storage: Storage | null = null;
  try { storage = localStorage; } catch {}
  return sendCommand(purchaseCommand(species, quantity, readViewMode(storage)));
}

export const cmdFeed = (petItemId: string, cropItemId: string) =>
  sendCommand({ type: "FeedPet", petItemId, cropItemId });
