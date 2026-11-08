# Nákup semínek – návrh

Zadání (uživatel, 2026-11-08): „Naplánuj kupování semínek, chci aby se kupovala
semínka, která nejsou keře, tzn. vyrostou jenom 1× a sklidí se.“

Staví na větvi `feat/crop-calculator` (katalog rostlin s typem sklizně).

## Chování

- Nová automatika **Nákup semínek** (vypnutá ve výchozím stavu). Běží v hlavním
  kole po sklizni/krmení/prodeji a **před sázením**, aby se koupená semínka
  zasadila hned.
- Kupují se **jen jednorázové rostliny**: druh musí být v katalogu s
  `harvest === "Single"` a známou cenou semínka. Neznámý druh se nekupuje nikdy
  (nevíme, jestli to není keř).
- Kolik: od každého druhu se dokupuje do **cíle v batohu** (`buyTarget`,
  výchozí 10 ks; počítají se jen semínka v batohu). Nikdy víc, než je v obchodě
  skladem pro aktuální restock.
- Rozpočet: neutratit pod **rezervu mincí** (`buyCoinReserve`, výchozí 0).
  Neznámý počet mincí → nekupovat nic.
- Pořadí, když nestačí mince: podle priority sázení (`S.plantOrder`), druhy, které
  v pořadí ještě nejsou, v pořadí obchodu.
- Uživatel může vybrané druhy z nákupu vyřadit (`buyDisabled`, štítky).
- Po nákupu se ověří přírůstek semínek v batohu. Když nepřibylo nic, nákup se na
  1 min pozastaví (stejně jako sklizeň/sázení).

## Protokol (zjištěno z Aries Mod, kód vlastní)

- Obchod: `readAtom("stateAtom").child.data.shops.seed` =
  `{ restockId, startedAtMs, inventory: [{ species, initialStock }], ... }`;
  `restockId === null` = zavřeno.
- Už koupeno: `readAtom("myUserSlotAtom").data.shopPurchases.seed` =
  `{ restockId, startedAtMs, purchases: { [species]: počet } }`. Počítá se jen,
  když `restockId` sedí s obchodem; záznam bez `restockId` (starý formát) se
  počítá vždy. Skladem = `max(0, initialStock − koupeno)`.
- Příkaz (přes `sendCommand`, tj. s číslováním):
  `{ type: "PurchaseShopItem", shop: "seed", viewMode, item: { itemType: "Seed", species }, quantity? }`
  – `quantity` jen když > 1; `viewMode` z localStorage hry
  (`shop:<cokoli>:seed:viewMode`, JSON `"list"`/`"grid"`), jinak `"list"`.

## Mimo rozsah

Osobní restock obchodu (`customRestocks`) a počasové obchody – čte se jen
obchod místnosti `seed`; když server nákup odmítne, zachytí to ověření a pauza.
Nákup vajec, nástrojů, dekorací. Kupování podle ziskovosti.
