#!/bin/zsh
# Builds a Chrome Web Store-ready zip from the committed runtime files only —
# no README, no .git, no OS junk. Uses git archive so the zip is reproducible
# and never picks up uncommitted or untracked files.
set -euo pipefail
cd "$(dirname "$0")/.."

# Disabled during the 1.9.0 conversion. This script archives runtime files from
# HEAD, and the runtime now comes out of a Vite build instead - phase 6 rewrites
# it to zip dist/. Failing loudly beats shipping a zip of files that moved.
echo "package.sh is disabled until the 1.9.0 conversion lands - run 'pnpm build' and zip dist/ by hand if you need a build now" >&2
exit 1

git="/opt/homebrew/bin/git"
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")

if [[ -n "$($git status --porcelain)" ]]; then
  echo "warning: working tree is dirty — the zip is built from HEAD, not from unstaged changes" >&2
fi

mkdir -p dist
out="dist/attendance-tracker-v${version}.zip"
rm -f "$out"
$git archive --format=zip -o "$out" HEAD -- \
  manifest.json background.js popup.html popup.js policy.js i18n.js themes.js \
  options.html options.js icon16.png icon48.png icon128.png

echo "built $out"
unzip -l "$out"
