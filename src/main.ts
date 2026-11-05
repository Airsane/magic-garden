/*
 * Magic Garden – Auto Farm
 * ------------------------
 * • Napojí se na WebSocket hry a hlídá číslování příkazů (commandSequence).
 * • Čte data hry z jotai store (zahrada, semínka, mince, mapa).
 * • Sklízí zralé plody (HarvestCrop) a sází semínka do prázdných políček (PlantSeed).
 * • Krmí hladové aktivní mazlíčky plodinami z batohu (FeedPet).
 * • Alt+H skryje / zobrazí panel.
 *
 * Nekombinuj s Arie's Mod – oba přečíslovávají stejný socket.
 *
 * Pořadí startu je důležité: socket se musí obalit dřív, než ho hra vytvoří
 * (proto @run-at document-start), UI až když existuje <body>.
 */

import { S } from "./config";
import { LOG } from "./env";
import { restartTimer } from "./farm/loop";
import { installKeepAlive } from "./net/keepalive";
import { installSocketHook } from "./net/socket";
import { buildUI } from "./ui/panel";

installSocketHook();
if (S.keepAlive) installKeepAlive();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildUI);
else buildUI();
restartTimer();
LOG(`načteno v${__VERSION__}`);
