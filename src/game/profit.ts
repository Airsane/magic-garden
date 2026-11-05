// Zisk z pěstování: tržba za plody minus nákup semínek, za dávku rostlin
// zasazených najednou (rostou souběžně, doba se tedy nenásobí počtem rostlin).

import { allPlants, plantInfo } from "../data/catalog";
import { cropValue } from "./pricing";

export interface ProfitInput {
  species: string;
  size: number;
  mutations: readonly string[];
  players: number;
  /** počet rostlin (≥ 1) */
  plants: number;
  /** sklizní z jednoho semínka (≥ 1; jednorázové rostliny vždy 1) */
  harvests: number;
  /** do první sklizně (s) */
  growSeconds: number | null;
  /** mezi dalšími sklizněmi (s) */
  regrowSeconds: number | null;
}

export interface ProfitResult {
  /** null = druh není v katalogu */
  pricePerCrop: number | null;
  cropsPerHarvest: number;
  seedCost: number | null;
  harvests: number;
  revenue: number;
  cost: number;
  profit: number;
  seconds: number | null;
  profitPerHour: number | null;
}

const atLeastOne = (n: number) => (Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1);

export function profitEstimate(input: ProfitInput): ProfitResult {
  const p = plantInfo(input.species);
  const plants = atLeastOne(input.plants);
  const harvests = p?.harvest === "Multiple" ? atLeastOne(input.harvests) : 1;
  const cropsPerHarvest = p?.slots ?? 1;
  const price = p ? cropValue(p.species, input.size, input.mutations, input.players) : null;
  const revenue = plants * harvests * cropsPerHarvest * (price ?? 0);
  const cost = plants * (p?.seedPrice ?? 0);
  const profit = revenue - cost;
  const { growSeconds: grow, regrowSeconds: regrow } = input;
  const seconds = harvests === 1 ? grow : grow != null && regrow != null ? grow + (harvests - 1) * regrow : null;
  return {
    pricePerCrop: price, cropsPerHarvest, seedCost: p?.seedPrice ?? null, harvests,
    revenue, cost, profit, seconds,
    profitPerHour: seconds != null && seconds > 0 ? (profit / seconds) * 3600 : null,
  };
}

export interface RankRow {
  species: string;
  name: string;
  profit: number;
  profitPerHour: number;
}

/** Žebříček druhů podle zisku za hodinu (1 rostlina); druhy s neznámou dobou chybí. */
export function rankPlants(
  opts: { size: number; mutations: readonly string[]; players: number; harvests: number },
  timesOf: (species: string) => { grow: number | null; regrow: number | null },
): RankRow[] {
  const rows: RankRow[] = [];
  for (const p of allPlants()) {
    const t = timesOf(p.species);
    const r = profitEstimate({ ...opts, species: p.species, plants: 1, growSeconds: t.grow, regrowSeconds: t.regrow });
    if (r.profitPerHour != null) rows.push({ species: p.species, name: p.name, profit: r.profit, profitPerHour: r.profitPerHour });
  }
  return rows.sort((a, b) => b.profitPerHour - a.profitPerHour);
}
