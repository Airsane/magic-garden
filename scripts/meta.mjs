// Hlavička userscriptu (==UserScript==). Verze se bere z package.json.
// Každý klíč se vypíše jako `// @klíč hodnota`, pole se vypíše jako více řádků.

export const meta = {
  name: "Magic Garden – Auto Farm",
  namespace: "mg-autoharvest",
  description: "Automatická sklizeň, sázení a krmení mazlíčků, mapa zahrady, statistiky, upozornění.",
  match: [
    "https://magicgarden.gg/r/*",
    "https://magiccircle.gg/r/*",
    "https://starweaver.org/r/*",
  ],
  // document-start: WebSocket se musí obalit dřív, než ho hra vytvoří.
  "run-at": "document-start",
  // Skript musí běžet v kontextu stránky, aby viděl window.WebSocket a jotai store hry.
  "inject-into": "page",
  grant: "none",
};

export function renderMeta(version) {
  const entries = [["name", meta.name], ["namespace", meta.namespace], ["version", version]];
  for (const [k, v] of Object.entries(meta)) {
    if (k === "name" || k === "namespace") continue;
    for (const item of [].concat(v)) entries.push([k, item]);
  }
  const width = Math.max(...entries.map(([k]) => k.length)) + 2;
  const lines = entries.map(([k, v]) => `// @${k.padEnd(width - 1)}${v}`);
  return ["// ==UserScript==", ...lines, "// ==/UserScript==", ""].join("\n");
}
