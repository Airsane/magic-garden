// Najde cykly v runtime importech src/ (importy jen typů se nepočítají).
// Cyklus v bundlu = některý modul při startu uvidí `undefined` místo hodnoty.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) files.push(p);
  }
})("src");

const typeOnly = (names) => /^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(names.trim());
const graph = {};
for (const f of files) {
  const src = readFileSync(f, "utf8");
  graph[f] = [...src.matchAll(/^import\s+(?!type\b)([^;]*?)from\s+"(\.[^"]+)"/gm)]
    .filter((m) => !typeOnly(m[1]) && !m[2].endsWith(".css"))
    .map((m) => join(dirname(f), m[2]) + ".ts");
}

const cycles = new Set();
const done = new Set();
function dfs(node, stack) {
  const i = stack.indexOf(node);
  if (i >= 0) { cycles.add(stack.slice(i).concat(node).map((p) => relative("src", p)).join(" → ")); return; }
  if (done.has(node)) return;
  for (const next of graph[node] || []) dfs(next, [...stack, node]);
  done.add(node);
}
for (const f of files) dfs(f, []);

if (cycles.size) {
  console.error("Cyklické importy:\n  " + [...cycles].join("\n  "));
  process.exit(1);
}
