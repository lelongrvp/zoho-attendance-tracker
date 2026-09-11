#!/bin/zsh
# The contract. A change is safe when this passes; it is the only claim about
# correctness this project makes, so it runs whole and stops at the first
# failure.
#
#   ./scripts/test.sh            source tree
#   ./scripts/test.sh dist       the built extension (after the Vite conversion)
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-source}"
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
  bash test/contract.sh | tail -6
fi

echo "\n--- calendar alignment ---"
if [[ "$target" == "dist" ]]; then
  "$node_bin" test/render/alignment.mjs dist/popup/index.html
else
  "$node_bin" test/render/alignment.mjs
fi

echo "\nAll green."
