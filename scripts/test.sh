#!/bin/zsh
# The contract. A change is safe when this passes; it is the only claim about
# correctness this project makes, so it runs whole and stops at the first
# failure.
#
# The build is part of it. Since the shared modules became TypeScript, the
# source popup cannot run in a browser - only the built one can - so anything
# that renders is checked against dist/, which is also what actually ships.
set -euo pipefail
cd "$(dirname "$0")/.."

node_bin="${NODE_BIN:-node}"

echo "--- worker suites ---"
for suite in test/worker/test*.mjs; do
  printf '  %-12s ' "$(basename "$suite")"
  "$node_bin" "$suite" | tail -1
done

echo "\n--- popup.js <-> popup.html contract ---"
# Deleted in phase 4 of the 1.9.0 conversion: once the popup is JSX, a
# reference to an element that does not exist is a compile error instead.
if [[ -f test/contract.sh ]]; then
  bash test/contract.sh | tail -3
fi

echo "\n--- explicit types ---"
"$node_bin" test/annotations.mjs

echo "\n--- typecheck ---"
pnpm -s typecheck && echo "  clean"

echo "\n--- build ---"
pnpm -s build >/dev/null && echo "  dist/ built"

echo "\n--- calendar alignment (against the built extension) ---"
"$node_bin" test/render/alignment.mjs dist/popup/index.html

echo "\nAll green."
