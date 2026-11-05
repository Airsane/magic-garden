# Kalkulačka plodin – návrh

Zadání (uživatel, 2026-11-05): „implementuj kalkulačku na cropy (inspirace
https://github.com/Ariedam64/MG-AriesMod). Ideálně i výpočet, za kolik by se
prodalo aktuální pole atd., a ať si můžu v kalkulačce počítat profit na
rostlinách, kolik bude.“

## Co se staví

1. **Cena plodu** – stejný vzorec, jaký používá hra (zjištěno z Aries Mod
   `src/data/rules/cropValue.ts` + `cropSize.ts`, přepsáno vlastním kódem –
   repo nemá licenci, kód se nekopíruje, převzatá jsou jen fakta o hře):

   ```
   cena = round( baseSellPrice × velikost × mutace × přátelé )
   velikost = 1 + (maxSizeMultiplier − 1) × (size − 50) / 50      size zaokrouhlit, omezit na 50–100
   mutace   = barva × (počasí + světlo − počet_přítomných + 1)
              barva   = nejvyšší násobitel ze skupiny Growth (Gold 25, Rainbow 50), jinak 1
              počasí  = nejvyšší ze skupiny Hydro; Wet + Chilled zároveň = Frozen
              světlo  = nejvyšší ze skupiny Lunar
              (počasí a světlo se sčítají: Frozen 6 + Amberbound 10 → 15; chybí-li obě, 1)
   přátelé  = 1 + 0,1 × (hráčů − 1), hráčů omezit na 1–6
   ```

   Neznámý druh → cena 0 (v UI „–“). Neznámá mutace se ignoruje. Mutace se
   poznají podle klíče i jména z katalogu (`Ambershine` = `Amberlit`).

2. **Katalog** – snímek dat z veřejného API `https://mg-api.ariedam.fr/data/plants`
   a `/data/mutations`, uložený v repu (`src/data/catalog.json`) a obnovitelný
   skriptem. Skript za běhu hry **nic nestahuje**.

3. **Hodnota pole a batohu** – kolik by se dostalo za:
   zralé plody na poli, celé pole (i rostoucí – velikost a mutace jsou dané už
   při zasazení), plody, které projdou filtry sklizně, a plody v batohu.
   Počítá se s aktuálním počtem hráčů v místnosti (`numPlayersAtom`).
   Zobrazení: záložka Přehled a záložka Zahrada.

4. **Kalkulačka zisku** – nová záložka „🧮 Kalkulačka“: druh, velikost, mutace,
   hráči, počet rostlin, počet sklizní (víckrát sklízené rostliny), doba růstu
   a dorůstání → cena za plod, tržba, náklady na semínka, zisk, zisk za hodinu.
   Plus žebříček druhů podle zisku za hodinu.

   ```
   plodů na sklizeň = growSlots (Single = 1)
   tržba  = rostlin × sklizní × plodů na sklizeň × cena
   náklad = rostlin × cena semínka          (Single: sklizní je vždy 1)
   doba   = doba růstu + (sklizní − 1) × doba dorůstání      rostliny rostou souběžně
   zisk/h = (tržba − náklad) / doba × 3600; neznámá doba → „–“
   ```

5. **Doby růstu** – katalog je zná jen pro dozrání víckrát sklízených rostlin
   (`plant.secondsToMature`). Doby dozrání plodů se proto **učí ze zahrady**
   (`endTime − startTime` každého plodu), ukládají do localStorage a dají se
   v kalkulačce ručně přepsat.

## Mimo rozsah

Šance na mutace, ceny vajec/mazlíčků, nákup semínek, ukládání stavu kalkulačky
mezi obnoveními stránky.
