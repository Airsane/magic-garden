// Obchod se semínky: co je skladem, co koupit, co opravdu dorazilo.
//
//  • Obchod místnosti: stateAtom → child.data.shops.seed =
//    { restockId, startedAtMs, inventory: [{ species, initialStock }] };
//    restockId null = zavřeno.
//  • Už koupeno: myUserSlotAtom → data.shopPurchases.seed =
//    { restockId, purchases: { [species]: počet } } – platí jen pro stejný
//    restockId (záznam bez restockId je starý formát a platí vždy).
//  • Příkaz: { type: "PurchaseShopItem", shop: "seed", viewMode,
//    item: { itemType: "Seed", species }, quantity? } – quantity jen když > 1.

import { plantInfo } from "../data/catalog";

export interface SeedOffer {
  species: string;
  /** zbývá v obchodě pro aktuální restock */
  remaining: number;
}

export interface SeedPurchase {
  species: string;
  quantity: number;
  cost: number;
}

export interface BuyOptions {
  coins: number | null;
  coinReserve: number;
  /** semínka v batohu: druh → počet */
  bag: Record<string, number>;
  /** cíl v batohu od každého druhu */
  target: number;
  disabled: readonly string[];
  /** priorita (pořadí sázení) */
  order: readonly string[];
}

export type ShopViewMode = "list" | "grid";

interface RawShop { restockId?: string | null; inventory?: unknown }
interface RawPurchases { restockId?: string; purchases?: Record<string, unknown> }

export function seedOffers(state: unknown, mySlot: unknown): SeedOffer[] {
  const shop = (state as { child?: { data?: { shops?: { seed?: RawShop } } } } | null)?.child?.data?.shops?.seed;
  if (!shop || shop.restockId == null || !Array.isArray(shop.inventory)) return [];
  const entry = (mySlot as { data?: { shopPurchases?: { seed?: RawPurchases } } } | null)?.data?.shopPurchases?.seed;
  const current = entry && (!("restockId" in entry) || entry.restockId === shop.restockId);
  const bought = (current && entry.purchases) || {};
  const out: SeedOffer[] = [];
  for (const it of shop.inventory as { species?: unknown; initialStock?: unknown }[]) {
    const species = typeof it?.species === "string" ? it.species : "";
    const stock = Number(it?.initialStock);
    if (!species || !Number.isFinite(stock)) continue;
    const remaining = Math.max(0, stock - (Number(bought[species]) || 0));
    if (remaining > 0) out.push({ species, remaining });
  }
  return out;
}

export function planSeedPurchases(offers: readonly SeedOffer[], o: BuyOptions): SeedPurchase[] {
  if (o.coins == null || !Number.isFinite(o.coins)) return [];
  const rank = (sp: string) => { const i = o.order.indexOf(sp); return i < 0 ? Infinity : i; };
  const candidates = offers
    .filter((x) => !o.disabled.includes(x.species))
    .map((x, i) => ({ ...x, i, info: plantInfo(x.species) }))
    .filter((x) => x.info?.harvest === "Single" && x.info.seedPrice != null)
    .sort((a, b) => rank(a.species) - rank(b.species) || a.i - b.i);
  let budget = o.coins - o.coinReserve;
  const plan: SeedPurchase[] = [];
  for (const x of candidates) {
    const price = x.info!.seedPrice!;
    const quantity = Math.min(x.remaining, o.target - (o.bag[x.species] ?? 0), Math.floor(budget / price));
    if (quantity <= 0) continue;
    plan.push({ species: x.species, quantity, cost: quantity * price });
    budget -= quantity * price;
  }
  return plan;
}

/** Kolik od každého druhu opravdu přibylo (nejvýš tolik, kolik se kupovalo). */
export function confirmPurchases(plan: readonly SeedPurchase[], before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of plan) {
    const gained = Math.max(0, (after[p.species] ?? 0) - (before[p.species] ?? 0));
    out[p.species] = Math.min(p.quantity, gained);
  }
  return out;
}

const VIEW_MODE_KEY = /^shop:.*:seed:viewMode$/;

/** Zobrazení obchodu, které si hráč zvolil (hra ho drží v localStorage); jinak "list". */
export function readViewMode(storage: Pick<Storage, "length" | "key" | "getItem"> | null): ShopViewMode {
  if (!storage) return "list";
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !VIEW_MODE_KEY.test(key)) continue;
      const raw = storage.getItem(key);
      let v: unknown = raw;
      try { v = JSON.parse(raw ?? ""); } catch {}
      if (v === "list" || v === "grid") return v;
    }
  } catch {}
  return "list";
}

export function purchaseCommand(species: string, quantity: number, viewMode: ShopViewMode): { type: string } & Record<string, unknown> {
  return {
    type: "PurchaseShopItem",
    shop: "seed",
    viewMode,
    item: { itemType: "Seed", species },
    ...(quantity > 1 ? { quantity } : {}),
  };
}
