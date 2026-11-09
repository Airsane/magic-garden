# Zápis plodů do sbírky – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Před sklizní zapsat do deníku hry (`LogItem`) zralé plody na poli, jejichž varianta ve sbírce chybí, a takové plody nesklidit ani nesníst, dokud se nezapíšou (nejvýš 3 pokusy).

**Architecture:** Čistá logika bez DOM a socketu v `src/game/journal.ts` (varianty plodu, chybějící varianty, výběr cílů, zadržené plody) – testovaná vitestem. `src/farm/journal.ts` ji napojí na snímek hry a socket stejně jako `harvest.ts`, drží počítadlo pokusů a sadu zadržených plodů pro aktuální kolo. `farm/loop.ts` zápis zařadí před sklizeň; `harvest.ts` a `feed.ts` zadržené plody přeskočí.

**Tech Stack:** TypeScript 7 (strict), esbuild 0.28, vitest 5.1.

**Spec:** [docs/superpowers/specs/2026-11-09-crop-journal-design.md](../specs/2026-11-09-crop-journal-design.md)

## Global Constraints

- Větev `feat/crop-journal` (už existuje, obsahuje spec). Žádné nové závislosti. `./build.sh` musí projít (tsc, check-cycles, vitest, build).
- Příkaz přesně: `{ type: "LogItem", target: { kind: "growSlot", slot, slotsIndex } }` přes `sendCommand`. `TakePhoto` se neposílá.
- Deník: `myDataAtom.journal.produce[druh].variantsLogged[].variant`.
- Varianty: `Normal`, `Wet`, `Chilled`, `Frozen`, `Dawnlit`, `Ambershine`, `Thunderstruck`, `Gold`, `Rainbow`, `Dawncharged`, `Ambercharged`, `Thundercharged`, `Max Weight`. `Max Weight` se nepředpovídá.
- Max. 3 neúspěšné pokusy na plod (`MAX_LOG_ATTEMPTS = 3`); klíč pokusu `políčko:slot:endTime`.
- Nastavení `journalOn`, výchozí `true`. Žádný nový hlavní přepínač v hlavičce.
- Texty v UI a logu česky přesně podle kroků; identifikátory anglicky; komentáře česky v hustotě okolního kódu.
- `src/game/journal.ts` nesmí za běhu importovat nic kromě typů (`import type`) – čistá logika.

## Review Focus

1. **Krmení ze zahrady při vypnuté sklizni** – zápis neběží, takže se nic nesmí zadržet (jinak mazlíček nikdy nesní zralý plod). Test: Task 3 `a feed-only cycle holds nothing`.
2. **Server zápis trvale odmítá** – plod se po 3. neúspěchu uvolní, varování jen jednou, žádné další pokusy. Test: Task 2 `releases a crop after three failed attempts`.
3. **Nový plod na stejném políčku** (sklizeno a znovu dozrálo) – počítadlo začíná od nuly. Test: Task 1 `a new crop on the same slot starts with no attempts`.
4. **Výpadek spojení uprostřed zápisu** – neodeslané plody se nepočítají jako pokus. Test: Task 2 `does not count unsent crops when offline`.
5. **Neúplný deník** (`journal` chybí nebo druh v něm není) – všechny varianty plodu se berou jako chybějící, nic nespadne. Test: Task 1 `treats a missing journal as empty`.

---

### Task 1: Čistá logika deníku

**Files:**
- Create: `src/game/journal.ts`, `test/journal.test.ts`

**Interfaces:**
- Consumes: `type Crop` a `isRipe` z `src/game/garden.ts` (`isRipe` je čistá funkce; import za běhu jen z `garden.ts` je v pořádku, `garden.ts` sám importuje jen `config`).
- Produces:
  ```ts
  export const JOURNAL_VARIANTS: readonly string[];       // 13 názvů ze Global Constraints
  export const MAX_LOG_ATTEMPTS = 3;
  export interface Journal { produce?: Record<string, { variantsLogged?: { variant?: string }[] } | null | undefined> }
  export function cropVariants(c: Pick<Crop, "mutations">): string[];      // známé mutace, jinak ["Normal"]
  export function loggedVariants(journal: Journal | null, species: string): Set<string>;
  export function missingVariants(c: Pick<Crop, "species" | "mutations">, journal: Journal | null): string[];
  export const attemptKey: (c: Pick<Crop, "tileIndex" | "slotsIndex" | "end">) => string; // `${tile}:${slot}:${end}`
  /** Zralé plody s chybějící variantou, nejvýš `max`; plod se vynechá, když všechny jeho chybějící varianty už pokrývá dřív vybraný plod stejného druhu. */
  export function pickLogTargets(crops: readonly Crop[], journal: Journal | null, now: number, max: number): Crop[];
  /** Klíče (attemptKey) zralých plodů s chybějící variantou a méně než MAX_LOG_ATTEMPTS pokusy. */
  export function heldCrops(crops: readonly Crop[], journal: Journal | null, now: number, attempts: ReadonlyMap<string, number>): Set<string>;
  ```

- [ ] **Step 1: Napiš failing testy `test/journal.test.ts`**

  Pomocník `crop(o: Partial<Crop>): Crop` s výchozími `{ tileIndex: 1, slotsIndex: 0, species: "Squash", start: 0, end: 1000, mutations: [], size: 100, preserved: false }`; `now = 2000`; `j = { produce: { Squash: { variantsLogged: [{ variant: "Normal" }] } } }`.

  ```ts
  it("a crop without mutations is Normal", () => expect(cropVariants(crop({}))).toEqual(["Normal"]));
  it("ignores unknown mutations", () => {
    expect(cropVariants(crop({ mutations: ["Thunderstruck", "Bogus"] }))).toEqual(["Thunderstruck"]);
    expect(cropVariants(crop({ mutations: ["Bogus"] }))).toEqual(["Normal"]);
  });
  it("treats a missing journal as empty", () => {
    expect(missingVariants(crop({ mutations: ["Gold"] }), null)).toEqual(["Gold"]);
    expect(missingVariants(crop({ species: "Daffodil" }), j)).toEqual(["Normal"]);
  });
  it("finds only variants not yet logged", () => {
    expect(missingVariants(crop({}), j)).toEqual([]);
    expect(missingVariants(crop({ mutations: ["Wet", "Gold"] }), { produce: { Squash: { variantsLogged: [{ variant: "Wet" }] } } })).toEqual(["Gold"]);
  });
  it("picks only ripe crops with missing variants, up to max", () => {
    const ripe = crop({ tileIndex: 1, mutations: ["Gold"] });
    const unripe = crop({ tileIndex: 2, mutations: ["Gold"], species: "Daffodil", end: 5000 });
    const done = crop({ tileIndex: 3 });
    const other = crop({ tileIndex: 4, species: "Daffodil" });
    expect(pickLogTargets([ripe, unripe, done, other], j, 2000, 10)).toEqual([ripe, other]);
    expect(pickLogTargets([ripe, other], j, 2000, 1)).toEqual([ripe]);
  });
  it("picks one crop per missing species variant", () => {
    const a = crop({ tileIndex: 1, mutations: ["Gold"] });
    const b = crop({ tileIndex: 2, mutations: ["Gold"] });
    const c = crop({ tileIndex: 3, mutations: ["Gold", "Wet"] });
    expect(pickLogTargets([a, b, c], j, 2000, 10)).toEqual([a, c]);
  });
  it("holds missing crops until three attempts", () => {
    const a = crop({ mutations: ["Gold"] });
    expect(heldCrops([a], j, 2000, new Map())).toEqual(new Set([attemptKey(a)]));
    expect(heldCrops([a], j, 2000, new Map([[attemptKey(a), 2]])).size).toBe(1);
    expect(heldCrops([a], j, 2000, new Map([[attemptKey(a), 3]])).size).toBe(0);
    expect(heldCrops([crop({})], j, 2000, new Map()).size).toBe(0);
  });
  it("a new crop on the same slot starts with no attempts", () => {
    const old = crop({ mutations: ["Gold"], end: 1000 });
    const fresh = crop({ mutations: ["Gold"], end: 1500 });
    expect(heldCrops([fresh], j, 2000, new Map([[attemptKey(old), 3]])).size).toBe(1);
  });
  ```

- [ ] **Step 2: Spusť `npx vitest run test/journal.test.ts`** – Expected: FAIL (modul neexistuje).

- [ ] **Step 3: Implementuj `src/game/journal.ts` podle Interfaces.**

- [ ] **Step 4: Spusť `npx vitest run test/journal.test.ts`** – Expected: PASS.

- [ ] **Step 5: Commit** – `git add src/game/journal.ts test/journal.test.ts && git commit -m "feat: logika deníku – chybějící varianty plodů"`

---

### Task 2: Zápis do sbírky (`farm/journal.ts`)

**Files:**
- Create: `src/farm/journal.ts`, `test/farm-journal.test.ts`
- Modify: `src/game/reader.ts` (pole `journal`), `src/state.ts` (`emptyGame()` → `journal: null`), `src/net/commands.ts`, `src/config.ts`, `src/stats.ts`

**Interfaces:**
- Consumes: vše z Task 1; `readGame`, `sendCommand`, `S`, `state`, `renderLive`, `addLog`, `session`/`allTime`/`saveAll`, `sleep`, `allSlots`.
- Produces:
  ```ts
  // reader.ts
  GameSnapshot.journal: Journal | null      // z MyData.journal (doplnit `journal?: Journal` do interface MyData)
  // commands.ts
  export const cmdLogItem = (tile: number, slotsIndex: number) =>
    sendCommand({ type: "LogItem", target: { kind: "growSlot", slot: tile, slotsIndex } });
  // config.ts
  Settings.journalOn: boolean               // DEFAULTS.journalOn = true; komentář `// sbírka (deník)`
  // stats.ts
  Session.logged: number; AllTime.logged: number   // nové varianty zapsané do sbírky, výchozí 0
  // farm/journal.ts
  export async function doLogCrops(game: GameSnapshot, force: boolean): Promise<number>; // počet nově zapsaných variant
  export function isHeldForJournal(c: Crop): boolean;  // attemptKey(c) je v sadě zadržených z posledního doLogCrops
  export function clearJournalHold(): void;            // vyprázdní sadu zadržených
  ```
  Chování `doLogCrops` (pořadí kroků):
  1. `clearJournalHold()`; když `!S.journalOn` nebo (`!force && !S.harvestOn`) → `return 0`.
  2. Ze zahrady zahodit z počítadla pokusů klíče plodů, které už na poli nejsou.
  3. `targets = pickLogTargets(allSlots(game.tiles), game.journal, now, S.maxPerCycle)`; pro každý `cmdLogItem` + `sleep(S.gapMs)`; při `false` stav `"Není spojení se hrou"` a konec odesílání. Před odesláním `state.status = \`Zapisuji ${targets.length} do sbírky…\``; `renderLive()`.
  4. Když se něco odeslalo: `sleep(800)`, `after = await readGame()`; pro každý odeslaný plod: chybějící varianty, které jsou teď v `loggedVariants(after.journal, sp)`, se počítají jako zapsané; když z jeho chybějících nepřibylo nic → pokus +1; při dosažení `MAX_LOG_ATTEMPTS` `addLog(\`📷 Nepodařilo se zapsat ${sp} (${missing.join(", ")}) – sklidím ho normálně\`, "warn")`.
  5. Zadržené = `heldCrops(allSlots(after.tiles), after.journal, Date.now(), attempts)` (bez odeslání se použije `game`).
  6. Zapsané: `session.logged += n; allTime.logged += n; saveAll()`; log `"📷 " + "Squash: Thunderstruck, Daffodil: Gold"` (druh: varianty oddělené `, `, skupiny `, `). Vrací `n`.

- [ ] **Step 1: Napiš failing testy `test/farm-journal.test.ts`**

  Mocky jako v `test/loop-buy.test.ts`: `vi.hoisted` pro `window`; `vi.mock("../src/net/commands", () => ({ cmdLogItem: vi.fn(() => true) }))`; `vi.mock("../src/game/reader", () => ({ readGame: vi.fn() }))`; `vi.mock("../src/util/misc", async (orig) => ({ ...(await orig()), sleep: vi.fn(async () => {}) }))`. Pomocník `snap(journal)` vrátí `{ tiles: { 56: { objectType: "plant", species: "Squash", slots: [{ slotId: 1, species: "Squash", endTime: 1, mutations: ["Thunderstruck"] }] } }, journal }`. `beforeEach`: `S.journalOn = true; S.harvestOn = true`, `vi.mocked(...).mockClear()`.

  ```ts
  it("logs a missing variant and releases the crop", async () => {
    vi.mocked(readGame).mockResolvedValueOnce(snap({ produce: { Squash: { variantsLogged: [{ variant: "Thunderstruck" }] } } }));
    expect(await doLogCrops(snap({}), false)).toBe(1);
    expect(cmdLogItem).toHaveBeenCalledWith(56, 1);
    expect(isHeldForJournal(crop56)).toBe(false);    // crop56 = allSlots(snap({}).tiles)[0]
  });
  it("releases a crop after three failed attempts", async () => {
    vi.mocked(readGame).mockResolvedValue(snap({}));
    for (let i = 0; i < 2; i++) { await doLogCrops(snap({}), false); expect(isHeldForJournal(crop56)).toBe(true); }
    await doLogCrops(snap({}), false);
    expect(isHeldForJournal(crop56)).toBe(false);
    vi.mocked(cmdLogItem).mockClear();
    await doLogCrops(snap({}), false);
    expect(cmdLogItem).toHaveBeenCalledTimes(1);     // ještě se zkouší (pick nefiltruje pokusy)…
    expect(isHeldForJournal(crop56)).toBe(false);    // …ale už nezadržuje
  });
  it("does not count unsent crops when offline", async () => {
    vi.mocked(cmdLogItem).mockReturnValue(false);
    for (let i = 0; i < 3; i++) await doLogCrops(snap({}), false);
    expect(isHeldForJournal(crop56)).toBe(true);
  });
  it("does nothing when the journal setting is off", async () => {
    S.journalOn = false;
    expect(await doLogCrops(snap({}), true)).toBe(0);
    expect(cmdLogItem).not.toHaveBeenCalled();
    expect(isHeldForJournal(crop56)).toBe(false);
  });
  ```
  Stav modulu (pokusy) přežívá mezi testy, proto má `snap(journal, end)` druhý parametr a každý test používá jiný `endTime` (1, 2, 3, 4); `crop56` je pak `allSlots(snap({}, end).tiles)[0]`. Po vyčerpání pokusů se plod dál **posílá** (`pickLogTargets` pokusy nefiltruje), ale nezadržuje – sklizeň ho vezme hned ve stejném kole.

- [ ] **Step 2: Spusť `npx vitest run test/farm-journal.test.ts`** – Expected: FAIL.

- [ ] **Step 3: Doplň `reader.ts`, `state.ts`, `commands.ts`, `config.ts`, `stats.ts` podle Interfaces a implementuj `src/farm/journal.ts`.**

- [ ] **Step 4: Spusť `npm test && npm run typecheck`** – Expected: vše PASS, žádný cyklus importů.

- [ ] **Step 5: Commit** – `git add -A src test && git commit -m "feat: zápis plodů do sbírky (LogItem) s ověřením a pokusy"`

---

### Task 3: Zapojení do kola, sklizně a krmení

**Files:**
- Modify: `src/farm/loop.ts`, `src/farm/harvest.ts`, `src/farm/feed.ts`
- Test: `test/loop-journal.test.ts` (nový, styl `test/loop-buy.test.ts`)

**Interfaces:**
- Consumes: `doLogCrops`, `isHeldForJournal`, `clearJournalHold` z Task 2.
- Produces: pořadí kola **zápis → sklizeň → krmení → (prodej) → nákup → sázení**.
  - `cycle()`: hned po `readGame()` zavolat `clearJournalHold()`. V bloku `if (harvest)`: `const l = await doLogCrops(game, force); if (l) game = await readGame(); h = await doHarvest(game, force);`. `l` se započítá do `session.cycles`/stavu: `Hotovo: ${l} zapsáno, ${h} sklizeno, …` (jen když `l > 0`, jinak text beze změny).
  - `doHarvest`: filtr kandidátů rozšířit o `&& !isHeldForJournal(c)`.
  - `pickGardenFood` ve `feed.ts`: podmínku rozšířit o `&& !isHeldForJournal(c)`.
  - Komentář v hlavičce `loop.ts` aktualizovat na nové pořadí.

- [ ] **Step 1: Napiš failing testy `test/loop-journal.test.ts`**

  Mocky jako `loop-buy.test.ts` plus `vi.mock("../src/farm/journal", () => ({ doLogCrops: vi.fn(async () => 0), clearJournalHold: vi.fn(), isHeldForJournal: vi.fn(() => false) }))`.

  ```ts
  it("logs before harvesting", async () => {
    const order: string[] = [];
    vi.mocked(doLogCrops).mockImplementation(async () => { order.push("log"); return 0; });
    vi.mocked(doHarvest).mockImplementation(async () => { order.push("harvest"); return 0; });
    await cycle({ force: true });
    expect(order).toEqual(["log", "harvest"]);
  });
  it("a feed-only cycle holds nothing", async () => {
    await cycle({ force: true, harvest: false, plant: false, feed: true, petId: "p1" });
    expect(clearJournalHold).toHaveBeenCalled();
    expect(doLogCrops).not.toHaveBeenCalled();
  });
  ```
  Filtr v `harvest.ts`/`feed.ts` je jedna podmínka bez vlastního testu; ověří ho ruční test v Task 4.

- [ ] **Step 2: Spusť `npx vitest run test/loop-journal.test.ts`** – Expected: FAIL.

- [ ] **Step 3: Uprav `loop.ts`, `harvest.ts`, `feed.ts` podle Interfaces.**

- [ ] **Step 4: Spusť `npm test && npm run typecheck`** – Expected: PASS (včetně `loop-buy.test.ts` – tam doplň mock `../src/farm/journal` stejný jako výše, jinak test sáhne na skutečný modul).

- [ ] **Step 5: Commit** – `git add -A src test && git commit -m "feat: zápis do sbírky před sklizní, zadržené plody se nesklízí ani nesní"`

---

### Task 4: UI, dokumentace, verze

**Files:**
- Modify: `src/ui/tabs/harvest.ts`, `docs/ARCHITECTURE.md`, `README.md`, `scripts/meta.mjs` (description), `package.json` (`version` → `2.5.0`)

**Interfaces:**
- Consumes: `session.logged`, `allTime.logged`, `Settings.journalOn`.
- Produces:
  - `harvestTab.form()`: v sekci „Filtry sklizně“ jako první řádek `${cb("journalOn", "📷 Zapisovat nové varianty do sbírky")}` a pod ním `<div class="muted" style="font-size:10.5px">Zralé plody s variantou, která ve sbírce chybí, se před sklizní zapíšou do deníku.</div>`.
  - `harvestTab.live()`: `live.innerHTML = statusHTML + row("📷 Zapsáno do sbírky", \`${fmt(session.logged)} · celkem ${fmt(allTime.logged)}\`)` (`row` z `templates`, `fmt` z `util/format`).
  - `ARCHITECTURE.md`: krok 3 toku dat s novým pořadím; řádek tabulky příkazů `LogItem` | `target: { kind: "growSlot", slot, slotsIndex }`; řádek tabulky atomů `myDataAtom` doplnit o `journal` (sbírka); krátká sekce „Sbírka (deník)“ – odpověď serveru `QuinoaCommandResult` s `payload.variants`, foťák v ruce není potřeba, `TakePhoto` neposíláme.
  - `README.md`: úvodní věta (+ „zápis do sbírky“), `commands.ts` v Struktuře (+ `LogItem`), nové řádky `game/journal.ts` „deník: chybějící varianty plodů“ a `farm/journal.ts` „zápis plodů do sbírky“, `loop.ts` s novým pořadím.
  - `meta.mjs` description: `"Automatická sklizeň, sázení, krmení mazlíčků a zápis do sbírky, mapa zahrady, statistiky, upozornění."`

- [ ] **Step 1: Uprav soubory podle Interfaces.**

- [ ] **Step 2: Spusť `./build.sh`** – Expected: typecheck, check-cycles, vitest i build projdou; `dist/mg-autoharvest.user.js` má `@version 2.5.0`.

- [ ] **Step 3: Ruční ověření ve hře (uživatel)** – načíst build, v záložce Sklizeň je zaškrtnuté 📷; s plodem s chybějící variantou ⚡ → v logu `📷 Druh: Varianta`, plod se sklidí v dalším kole; řádek „📷 Zapsáno do sbírky“ ukazuje 1.

- [ ] **Step 4: Commit** – `git add -A && git commit -m "feat: nastavení zápisu do sbírky v záložce Sklizeň, v2.5.0"`
