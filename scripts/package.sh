#!/bin/zsh
# Builds a Chrome Web Store-ready zip from a fresh Vite build — no README, no
# .git, no OS junk. The build empties dist/ first, so the zip holds exactly what
# this run produced and nothing left over from a previous one.
set -euo pipefail
cd "$(dirname "$0")/.."

git="/opt/homebrew/bin/git"
version=$(python3 -c "import json; print(json.load(open('public/manifest.json'))['version'])")

if [[ -n "$($git status --porcelain)" ]]; then
  echo "warning: working tree is dirty — the zip is built from the working tree, not from HEAD" >&2
fi

pnpm build

# The old script named every runtime file, so a missing one was impossible.
# A directory zip has no such list; this is what replaces it.
for required in manifest.json background.js popup/index.html options/index.html icon128.png; do
  if [[ ! -f "dist/$required" ]]; then
    echo "error: dist/$required missing — the build did not produce a loadable extension" >&2
    exit 1
  fi
done

mkdir -p release
out="release/attendance-tracker-v${version}.zip"
rm -f "$out"
(cd dist && zip -qr "../$out" . -x '.DS_Store' '**/.DS_Store')

echo "built $out"
unzip -l "$out"
