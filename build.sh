#!/usr/bin/env bash
# Sestavení userscriptu.
#
#   ./build.sh            typecheck + build → dist/mg-autoharvest.user.js
#   ./build.sh --watch    build při každé změně (bez typechecku)
#   ./build.sh --minify   zmenšený výstup
#   ./build.sh --no-check build bez typechecku
set -euo pipefail
cd "$(dirname "$0")"

check=1
build_args=()
for arg in "$@"; do
  case "$arg" in
    --no-check) check=0 ;;
    --watch) check=0; build_args+=("$arg") ;;
    --minify) build_args+=("$arg") ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Neznámý přepínač: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -d node_modules ]]; then
  echo "→ Instaluji závislosti"
  npm ci --no-audit --no-fund
fi

if (( check )); then
  echo "→ Kontrola typů"
  npx --no-install tsc --noEmit
  echo "→ Kontrola cyklických importů"
  node scripts/check-cycles.mjs
fi

echo "→ Build"
node scripts/build.mjs "${build_args[@]}"
