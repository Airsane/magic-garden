// Herní příkazy, které skript posílá. Všechny vrací false, když není spojení.

import { uuid } from "../util/misc";
import { sendCommand } from "./socket";

/** Sklidí plod. `cropItemId` je id, pod kterým se plod objeví v batohu. */
export const cmdHarvest = (tile: number, slotsIndex: number, cropItemId: string = uuid()) =>
  sendCommand({ type: "HarvestCrop", slot: tile, slotsIndex, cropItemId });

export const cmdPlant = (tile: number, species: string) =>
  sendCommand({ type: "PlantSeed", slot: tile, species });

export const cmdSellAll = () => sendCommand({ type: "SellAllCrops" });

export const cmdFeed = (petItemId: string, cropItemId: string) =>
  sendCommand({ type: "FeedPet", petItemId, cropItemId });
