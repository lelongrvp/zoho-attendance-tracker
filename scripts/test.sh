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

# Gate logic keys off checkinDate.getHours() - a plain wall-clock read - so
# the org's real timezone (Vietnam) has to be pinned here, or a runner
# defaulting to UTC (GitHub Actions) reinterprets the same checkin instant as
# a different hour and misclassifies early/late start.
export TZ="Asia/Ho_Chi_Minh"

node_bin="${NODE_BIN:-node}"

echo "--- worker suites ---"
for suite in test/worker/test*.mjs; do
  printf '  %-12s ' "$(basename "$suite")"
  "$node_bin" "$suite" | tail -1
done

echo "\n--- component and pure-logic units ---"
pnpm -s test:unit 2>&1 | grep -E "Test Files|Tests " | sed 's/^/  /'

echo "\n--- deprecated preact types ---"
if grep -rn "JSX\.Targeted\|JSX\.Element" src/ 2>/dev/null; then
  echo "  use the preact root exports (VNode, TargetedInputEvent) - the JSX namespace copies are deprecated"
  exit 1
fi
echo "  none"

echo "\n--- explicit types ---"
"$node_bin" test/annotations.mjs

echo "\n--- typecheck ---"
pnpm -s typecheck && echo "  clean"

echo "\n--- build ---"
pnpm -s build >/dev/null && echo "  dist/ built"

echo "\n--- MV3 / CSP safety ---"
bash test/csp-scan.sh | tail -4

echo "\n--- options page round-trip ---"
"$node_bin" test/render/options.mjs

echo "\n--- calendar alignment (against the built extension) ---"
"$node_bin" test/render/alignment.mjs dist/popup/index.html

echo "\nAll green."
