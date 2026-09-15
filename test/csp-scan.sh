#!/bin/zsh
# Scans the built pages for MV3 CSP violations. TypeScript proves the markup is
# internally consistent; nothing but this proves what Vite emitted is loadable.
cd "$(dirname "$0")/.."
fail=0

for page in dist/popup/index.html dist/options/index.html; do
  echo "--- $page ---"
  if [[ ! -f $page ]]; then
    echo "  FAIL not built"
    fail=1
    continue
  fi

  grep -qE '<script[^>]*>[^<]' "$page" && { echo "  FAIL inline <script> present"; fail=1; }
  grep -qE ' on[a-z]+="' "$page" && { echo "  FAIL inline event handler present"; fail=1; }
  grep -qE 'eval\(|new Function' "$page" && { echo "  FAIL eval/new Function present"; fail=1; }
  grep -qE '<script[^>]+src="https?:' "$page" && { echo "  FAIL remote script source"; fail=1; }
  grep -q '<script type="module" crossorigin src="' "$page" || { echo "  FAIL no module script tag"; fail=1; }

  remote=$(grep -oE 'https?://[^"'"'"' )]+' "$page" | grep -v 'w3.org' | sort -u)
  echo "  remote URLs: ${remote:-none}"
done

echo
[[ $fail -eq 0 ]] && echo "CSP OK" || echo "CSP VIOLATIONS FOUND"
exit $fail
