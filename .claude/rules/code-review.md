# Code review rules — zoho-attendance-tracker

Applies to `/code-review`, the interactive review workflow, and the automated
Claude PR review action. Report findings as a prioritized list: critical →
important → minor. Do not nitpick anything Prettier already enforces.

## Project-specific invariants

These are non-obvious constraints this codebase has already been burned by or
deliberately committed to. A PR that violates one of these is at least
"important", usually "critical" if it ships.

- **1.9.0 conversion scope discipline.** The framework conversion (Preact +
  TypeScript + Vite + Tailwind v4) is view-layer only. `src/lib/policy.ts`,
  `src/lib/i18n.ts`, `src/lib/themes.ts`, `src/lib/storage.ts`, and
  `src/worker/background.js` are framework-agnostic logic — flag any PR that
  makes them import Preact, hold component state, or otherwise gain view
  concerns while claiming to be a UI change.
- **No `dark:` Tailwind variant, ever.** Theming runs through this project's
  own `--color-*` custom-property tokens (`applyTokens`), not
  `prefers-color-scheme`. A `dark:` utility class anywhere is a bug, not a
  style choice — it silently no-ops against the token system.
- **Explicit types always.** No relying on inference for declarations or
  return types — every function signature and variable declaration carries a
  written type. `test/annotations.mjs` checks part of this mechanically; the
  rest is a review judgment call.
- **Comments are one-liners, and only for non-obvious WHY.** No block
  comments, no restating what the code does, no "used by X" / "added for the
  Y flow" references to the current task — that belongs in the commit
  message. Flag comment additions that explain WHAT rather than WHY.
- **Calendar cell alignment invariant.** Calendar dates differ by colour
  only — the glyph position must not shift between states. Any change
  touching calendar cell rendering must preserve glyph-level alignment, not
  just box/container alignment. See `ARCH-calendar-cell-alignment` in the
  vault if unsure.
- **Popup paints from cache on first frame.** The popup must render
  immediately from cached `chrome.storage.local` data, then revalidate behind
  it — never a spinner-first render while a fetch is in flight. Flag any
  change to popup data-loading order that risks a blank/loading first paint.
- **MV3 CSP.** No inline `<script>`, no inline event handler attributes
  (`onclick=` etc.), no `eval`/`new Function`, no remote `script-src`. Styles
  are unrestricted — CSS-in-JS and style tags are fine.
- **Worker listeners register synchronously at top level.** `background.js`
  is an MV3 service worker: `chrome.*.addListener` calls must run
  synchronously during initial script evaluation, not after an `await` or
  inside a promise callback, or Chrome can miss the event that would have
  woken the worker.
- **No secrets, ever.** This extension authenticates purely off the ambient
  Zoho session cookie already in the browser. Any PR introducing an API key,
  hardcoded credential, token, or new persisted auth material is a blocker —
  raise it even if it looks like test fixture data.

## What counts as "done"

`scripts/test.sh` is this project's only claim about correctness — it runs
worker suites, the popup/HTML DOM contract, the explicit-types check,
`tsc --noEmit`, the production build, and the render harnesses against
`dist/`, and stops at the first failure. A PR that changes behavior without
the relevant suite under `test/` reflecting that change is incomplete, not
just under-tested — say so explicitly rather than filing it as a minor nit.

## Out of scope for this review

- No abstractions, helpers, or config "for future use" beyond what the PR's
  stated purpose requires — flag speculative generalization same as a bug.
- Don't ask for error handling around scenarios that can't happen given MV3 /
  Chrome extension guarantees (e.g. `chrome.storage.local` being unavailable).
- Don't suggest introducing ESLint, a different formatter, or other tooling
  changes as part of a feature/bugfix review — that's a separate decision for
  the user to make deliberately.
