# Zápis plodů do sbírky (deníku) – návrh

Zadání (uživatel, 2026-11-09): „Ve hře byl přidán foťák, dalo by se udělat, aby
rostliny, které nejsou ve sbírce, vyfotil? Tzn. nějaké mutace atd.“

Rozhodnutí z brainstormingu:

- jen **plody na poli** (ne batoh, ne mazlíčci),
- když zápis selže, plod zůstane na poli a zkusí se znovu; po **3 neúspěšných
  pokusech** se uvolní ke sklizni,
- ovládání jako **zaškrtávátko v záložce Sklizeň** (žádný nový hlavní přepínač).

## Protokol (zjištěno z kódu hry a ověřeno testem v konzoli)

- Foťák při stisku spouště pošle `TakePhoto` (bez polí – jen záblesk/animace) a
  pak za každý objekt v záběru s novou variantou `LogItem`. Do deníku zapisuje
  **jen `LogItem`**; `TakePhoto` neposíláme.
- Příkaz (přes `sendCommand`, tj. s číslováním):
  `{ type: "LogItem", target: { kind: "growSlot", slot, slotsIndex } }`
  – `slot` = index políčka, `slotsIndex` = stejné číslo jako u `HarvestCrop`.
- Odpověď serveru:
  `{ type: "QuinoaCommandResult", requestId, commandType: "LogItem", ok: true,
  payload: { type: "LogItem", journalType: "Produce", speciesId, variants: [...] } }`.
- Test 2026-11-09: zralý Squash s mutací Thunderstruck, **foťák nebyl v ruce**,
  server zápis přijal a varianta se objevila v deníku. Server tedy foťák v ruce
  ani záběr nekontroluje.
- Deník: `readAtom("myDataAtom").journal` =
  `{ produce: { [druh]: { variantsLogged: [{ variant, ... }] } }, pets: {...} }`.
- Známé varianty plodů (z kódu hry): `Normal`, `Wet`, `Chilled`, `Frozen`,
  `Dawnlit`, `Ambershine`, `Thunderstruck`, `Gold`, `Rainbow`, `Dawncharged`,
  `Ambercharged`, `Thundercharged`, `Max Weight`. Názvy mutací v `slot.mutations`
  se s nimi shodují.

## Chování

- Nové nastavení `journalOn` (výchozí **zapnuto** – nic nestojí), zaškrtávátko
  „📷 Zapisovat nové varianty do sbírky“ v záložce Sklizeň.
- Zápis je součást kroku sklizně: běží jen, když běží sklizeň (`harvestOn`, nebo
  vynucený běh ⚡ / „Sklidit teď“), a to **těsně před ní**.
- Kandidáti: **zralé** plody na vlastním poli. Filtry sklizně (min. velikost,
  vyřazené druhy, preserved…) se nepoužijí – zápis plod nesklízí, takže se
  zapisuje i to, co se nesklízí.
- Varianty plodu: jeho mutace (jen názvy ze seznamu výše); bez mutací `Normal`.
  `Max Weight` se nepředpovídá (nevíme, od jaké velikosti platí) – když ho server
  zapíše sám, započítá se.
- Plod se zapisuje, když aspoň jedna jeho varianta chybí v
  `journal.produce[druh].variantsLogged`. Víc plodů stejného druhu se stejnou
  chybějící variantou → v jednom kole se pošle jen jeden (první).
- Max. `S.maxPerCycle` příkazů za kolo, rozestup `S.gapMs`.
- Ověření: po odeslání pauza 800 ms, nové čtení hry; zapsáno = varianty, které
  v deníku nově přibyly. Do logu `📷 Squash: Thunderstruck`.
- **Ochrana plodu:** plod s chybějící variantou, který má méně než 3 neúspěšné
  pokusy, se nesklidí (`doHarvest`) a nesní se ze zahrady (`feedFromGarden`).
  Neúspěšný pokus = příkaz odešel, ale chybějící varianta v deníku nepřibyla.
- Pokusy se počítají za **druh + variantu** (ne za jednotlivý plod), protože se
  v kole posílá jen jeden plod od varianty. Po 3. neúspěchu se varianta do
  obnovení stránky vzdá: uvolní se všechny její plody, nic dalšího se nezkouší a
  do logu jde jednou varování
  `📷 Nepodařilo se zapsat Squash (Thunderstruck) – plody s touto variantou už nezadržuji`.
  Úspěšný zápis počítadlo varianty smaže.
- Když deník chybí (`journal` se nenačetl nebo ho hra přejmenovala), zápis se
  přeskočí a nic se nezadrží.
- Bez spojení (`sendCommand` vrátí false) se zápis přeruší, stav „Není spojení se
  hrou“, pokus se nepočítá.
- Zadržení platí jen v kole, ve kterém zápis opravdu běžel. Když je `journalOn`
  vypnuté nebo se v kole nesklízí (např. jen krmení ze zahrady při vypnuté
  sklizni), plody se nezadržují – jinak by je krmení nikdy nesmělo sníst.

## Moduly

| Soubor | Změna |
| --- | --- |
| `game/journal.ts` (nový) | čistá logika: `JOURNAL_VARIANTS`, `cropVariants(crop)`, `loggedVariants(journal, species)`, `missingVariants(crop, journal)`, `pickLogTargets(crops, journal, max)` |
| `farm/journal.ts` (nový) | `doLogCrops(game, force)` – odeslání, ověření, počítadlo pokusů; `isHeldForJournal(crop, journal)` pro sklizeň a krmení |
| `game/reader.ts` | `GameSnapshot.journal` z `myDataAtom.journal` |
| `net/commands.ts` | `cmdLogItem(tile, slotsIndex)` |
| `farm/loop.ts` | `doLogCrops` před `doHarvest` (když se sklízí); po zápisu nové čtení hry |
| `farm/harvest.ts`, `farm/feed.ts` | vynechat plody, pro které `isHeldForJournal` platí |
| `config.ts` | `journalOn: boolean`, výchozí `true` |
| `stats.ts` | `session.logged`, `allTime.logged` |
| `ui/tabs/harvest.ts` | zaškrtávátko v sekci „Filtry sklizně“ + řádek „📷 zapsáno: X (relace) / Y (celkem)“ |
| `docs/ARCHITECTURE.md`, `README.md` | příkaz `LogItem`, atom `journal`, nový krok kola |

## Testy (vitest)

- `cropVariants`: bez mutací → `["Normal"]`; neznámá mutace se ignoruje; plod jen
  s neznámými mutacemi → `["Normal"]`.
- `missingVariants`: prázdný deník, částečně zapsaný druh, vše zapsáno → `[]`.
- `pickLogTargets`: jen zralé, limit `max`, jeden plod na stejnou chybějící
  variantu druhu.
- Ochrana: plod s chybějící variantou je zadržen; po 3 neúspěších varianty jsou
  uvolněny všechny její plody; plod s jinou chybějící variantou zůstává zadržen;
  bez deníku a s `journalOn = false` nic nezadržuje.

## Mimo rozsah

Zápis plodů v batohu (`inventoryItem`), mazlíčků (`petSlot`), vystavených a
zasazených v květináči; předpověď `Max Weight`; zápis nezralých plodů (neověřeno);
záložka s přehledem chybějících variant.
