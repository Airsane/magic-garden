// Sestaví src/main.ts do jednoho souboru dist/mg-autoharvest.user.js (+ hlavička dist/mg-autoharvest.meta.js).
// Použití: node scripts/build.mjs [--watch] [--minify]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as esbuild from "esbuild";
import { renderMeta } from "./meta.mjs";

const args = new Set(process.argv.slice(2));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const outfile = "dist/mg-autoharvest.user.js";
// Jen hlavička – Tampermonkey z ní při kontrole aktualizací čte @version.
const metafile = "dist/mg-autoharvest.meta.js";

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/main.ts"],
  outfile,
  bundle: true,
  format: "iife",
  target: "es2022",
  charset: "utf8",
  legalComments: "none",
  minify: args.has("--minify"),
  // CSS se vloží jako řetězec (import CSS from "./styles.css").
  loader: { ".css": "text" },
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: { js: renderMeta(pkg.version) },
  logLevel: "info",
};

if (args.has("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`Sleduji změny → ${outfile} (Ctrl+C ukončí)`);
} else {
  await esbuild.build(options);
}
mkdirSync("dist", { recursive: true });
writeFileSync(metafile, renderMeta(pkg.version));
