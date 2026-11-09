// Stáhne katalog rostlin, mutací a mazlíčků z veřejného API a uloží ho do src/data/catalog-data.json.
// Ukládají se jen pole, která skript potřebuje (ceny, velikost, sklizeň, doby).
// Použití: node scripts/update-catalog.mjs

import { writeFileSync } from "node:fs";

const API = "https://mg-api.ariedam.fr/data";
const OUT = "src/data/catalog-data.json";
const GROUPS = new Set(["Growth", "Hydro", "Lunar"]);

async function get(path) {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`${API}/${path}: HTTP ${res.status}`);
  return res.json();
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function plant(species, raw) {
  const sellPrice = num(raw?.crop?.baseSellPrice);
  if (sellPrice == null) return null;
  const harvest = raw?.plant?.harvestType === "Multiple" ? "Multiple" : "Single";
  const growSlots = Array.isArray(raw?.plant?.growSlots) ? raw.plant.growSlots.length : 0;
  const seedPrice = num(raw?.seed?.coinPrice);
  return {
    species,
    name: String(raw?.crop?.name || species),
    seedPrice: seedPrice && seedPrice > 0 ? seedPrice : null,
    sellPrice,
    maxSize: num(raw?.crop?.maxSizeMultiplier) ?? 1,
    harvest,
    slots: harvest === "Multiple" ? Math.max(1, growSlots) : 1,
    secondsToMature: num(raw?.plant?.secondsToMature),
  };
}

function pet(species, raw) {
  const diet = Array.isArray(raw?.diet) ? raw.diet.filter((d) => typeof d === "string") : [];
  const max = num(raw?.coinsToFullyReplenishHunger);
  if (max == null || max <= 0) return null;
  return { species, name: String(raw?.name || species), diet, max };
}

function mutation(key, raw) {
  const mult = num(raw?.coinMultiplier);
  if (mult == null || !GROUPS.has(raw?.group)) return null;
  return { key, name: String(raw?.name || key), group: raw.group, mult };
}

try {
  const [plantsRaw, mutationsRaw, petsRaw] = await Promise.all([get("plants"), get("mutations"), get("pets")]);
  const plants = {};
  for (const [k, v] of Object.entries(plantsRaw)) { const p = plant(k, v); if (p) plants[k] = p; }
  const mutations = {};
  for (const [k, v] of Object.entries(mutationsRaw)) { const m = mutation(k, v); if (m) mutations[k] = m; }
  const pets = {};
  for (const [k, v] of Object.entries(petsRaw)) { const p = pet(k, v); if (p) pets[k] = p; }
  const data = { source: API, fetchedAt: new Date().toISOString(), plants, mutations, pets };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${Object.keys(plants).length} rostlin, ${Object.keys(mutations).length} mutací, ${Object.keys(pets).length} mazlíčků → ${OUT}`);
} catch (e) {
  console.error("Katalog se nepodařilo stáhnout:", e.message);
  process.exit(1);
}
