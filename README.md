# Zoho Attendance Tracker

A Chrome extension (Manifest V3) that reads your own Zoho People attendance data
and shows, in a single popup, how much of today is left to work and how much of
the monthly quota you have already spent. The UI is a printed-timesheet design
set in the Gruvbox palette, light and dark.

## What it shows

- **Today** — check-in time, the part-time and full-time checkout targets, a live
  countdown to each, and a progress bar for the day. A late start (after 13:15)
  shortens the required day from 7h15/9h15 to 6h/8h.
- **Cycle usage** — quotas for the payroll cycle, which runs from the 21st of one
  month to the 20th of the next: days worked 6-8 hours (5 allowed), attendance
  requests (3 allowed), days under 6 hours (flagged as violations), plus leave
  and absence counts. Going over a quota turns the count red and marks the
  overflow; sitting exactly on it turns the count amber. Each filled slot's
  tooltip names the day it came from, and the attendance-request row lists
  those dates in full underneath, so a used request is traceable to a day
  rather than being just a number.
- **Daily hours** — one bar per day of the cycle, so short days read as a pattern
  rather than a list, and a running **balance** against 8h per recorded day.
- **Notifications** — Chrome notifies you at the part-time and full-time marks,
  scheduled by `chrome.alarms` so they fire whether or not the popup is open. The
  toolbar badge counts down to the full-time target, turns red when that target
  falls past the late-evening threshold, and shows `OK` once you pass it;
  hovering it shows the actual target time. A notification always names the
  target time and how long ago it passed, because an alarm missed while the
  machine slept is delivered late on wake. If your check-in already puts the
  full-time target past 19:30, a one-time "long day ahead" heads-up fires right
  away, while something can still be done about it.
- **Past midnight** — a late start can push the full-time target past 00:00.
  Yesterday's session stays on screen (labelled "Yesterday") until its target
  elapses, and its gate notification still fires, instead of the display
  resetting to "No record today" at the stroke of midnight.
- **Freshness** — the header shows how long ago Zoho was last reached
  successfully, and turns red past 30 minutes. If a refresh fails, the reason is
  shown in the alert strip rather than swallowed. This is what distinguishes
  "Zoho hasn't logged your check-in yet" from "we haven't reached Zoho in hours",
  which otherwise look identical.
- **Two languages** — the popup and its notifications speak English or
  Vietnamese; the header button switches instantly and the choice is remembered.
- **Colorschemes** — ten built-in palettes (Gruvbox, Catppuccin, Nord, Dracula,
  Solarized, Tokyo Night, Everforest, Rosé Pine, One Dark, Kanagawa), each with
  a light and dark side driven by the same mode toggle, selectable on the
  options page. A custom scheme takes six colors per mode — paper, panel, ink,
  red, green, yellow — and derives the borders, tints and muted text from them.
  The toolbar badge follows the scheme too.
- **Calendar tab** — the popup has two tabs, Attendance and Calendar. The
  calendar renders the whole payroll cycle as a grid from the same cached data:
  full days in ink, 6-8h days grey, sub-6h days red, leave green, absences
  tinted, days off hatched (holiday) or washed (weekend), future days dashed,
  today ringed. A day carrying an attendance request is filled amber, which
  outranks its hours bucket because a day that needed a request is the one
  worth spotting in the grid; the hours and the request's own raw contents are
  in the tooltip. The arrows beside the label walk back through past cycles: a
  cycle outside the rolling two-month window is fetched from Zoho once, cached
  under its own month key, and instant on every later visit. Statuses the quota
  logic does not understand are shown verbatim in each cell's tooltip rather
  than interpreted. The active tab is remembered.
- **Stale-while-revalidate** — the popup always paints instantly from cache,
  then quietly asks the worker for fresh data if the cache is older than five
  minutes; the display repaints on its own when the answer lands. The header
  brand is also a link straight to Zoho People.

The popup follows your system light/dark setting on first open. The toggle in the
header overrides that, and the choice is remembered in `chrome.storage.local`.

## Install

Non-developers: see **INSTALL.md** (English + Tiếng Việt). The intended
distribution channel is the Chrome Web Store as an *unlisted* extension —
one-click install and automatic updates; `store/listing.md` is the complete
submission kit and `scripts/package.sh` builds the store-ready zip from the
committed tree.

For development:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked**, then pick this directory.
3. Sign in to <https://people.zoho.com/> in the same browser profile. The
   extension reads the `CSRF_TOKEN` cookie and reuses your existing session; it
   never handles your password.

After editing any file, press **Reload** on the extension card. There is no build
step, no dependencies, and no package manager.

## How it works

`background.js` is the service worker. It reads the CSRF token from the Zoho
cookie, POSTs twice to `AttendanceViewAction.zp` (the current month and the
previous one), merges and de-duplicates the two responses, and caches the result
in `chrome.storage.local`. A `chrome.alarms` timer repeats this every 15 minutes,
which matters because an MV3 service worker is shut down whenever it goes idle.

`popup.js` only reads that cache and renders it, so opening the popup is instant.
The refresh button messages the worker and reports failures inline.

## Configuration

The Zoho attendance endpoint is namespaced by an org-specific portal id, which
defaults to the one this extension was written for. To point it at a different
org, set the id from the extension's service worker console:

```js
chrome.storage.local.set({ portalId: "hrportal0000000000000" });
```

The attendance policy — quotas, target offsets, the late-start cutoff, the
late-evening threshold, the cycle start day — lives in `policy.js`
(`DEFAULT_POLICY`) and is edited from the **options page** (gear icon in the
popup, or Options on `chrome://extensions`). The console route still works and
writes the same keys:

```js
chrome.storage.local.set({ policy: { shortDayQuota: 6, cycleStartDay: 1 } });
```

Changing the policy re-arms the notification gates and redraws the badge
immediately, with no refetch.

**Day statuses.** `holidayStatuses` and `weekendStatuses` are keyword lists
matched case-insensitively anywhere in a day's `status`, so "Weekend/Holiday",
"Public Holiday" and "Weekly Off" all land without listing every variant.
Holiday is tested first, and an unmatched status leaves the day rendering as
it always did. The options page shows the distinct statuses in your cached
data, with counts, so the lists can be matched to what this portal really
sends rather than to what `policy.js` guesses it sends.

## Known limitations

- Only the current and previous month are fetched on a refresh, which is
  exactly enough for the 21st-to-20th cycle. Older months are fetched only
  when the calendar is actually navigated back to them, one request per month,
  a year back at most.
- Holidays and weekends are recognised from the day's `status` text, so a
  holiday Zoho does not label is just an empty day. The keywords are editable
  on the options page, which also lists the status strings your portal
  actually sends.
- The default target model is check-in plus a fixed offset, which assumes your
  break is the standard 1.25 hours. The popup also computes a **worked-hours**
  projection from the day's raw entries (check-in/check-out pairs or alternating
  punches, both handled) and shows it under the progress bar: "Worked 5h 12m —
  full day at 18:15". When the two projections drift more than ten minutes apart
  the line turns red — the signal that Zoho's entries do not carry your breaks
  and the offset model is the one to trust. Once the worked line has matched
  reality for a week, switch **Target model** to "Hours actually worked" on the
  options page and the countdown, notifications, and badge all follow it. In
  worked mode a fully checked-out day falls back to the offset model, because a
  projection from frozen hours would drift forward one second per second.
- Notifications only fire while Chrome is running, and one missed during sleep
  arrives late (which is why the text always states the real target time).
- Only the first check-in of a day is read, so a day split across two sessions is
  measured from the first one.

## Unverified assumptions

The Zoho endpoint is undocumented and the response shape here is inferred from
the original code, not observed. Three assumptions are load-bearing and worth
confirming from the service worker console on `chrome://extensions`:

```js
chrome.storage.local.get("attendanceData", (d) =>
  console.log(d.attendanceData.dayList[0], d.attendanceData.entries),
);
```

- ~~`preMonth` past 1~~ — verified live 2026-09-10: it is a true month offset,
  not the two-state flag its only two original call sites (`0` and `1`) left
  it looking like. Probed at 0, 1, 2, 3 and 6; each returned exactly that
  month, whole (`preMonth=6` → 2026-03-01..31). The calendar's back-arrows can
  therefore address any month. The guard that refuses a payload whose days do
  not fall in the month that was asked for stays: it costs nothing and it is
  what would catch this changing.
- `approvalInfo` being present means an attendance request. Emptiness is now
  handled - an empty object, empty array or blank string no longer counts as a
  used request - but what the field means is still inferred. The calendar puts
  each flagged day's raw `approvalInfo` in its tooltip, so the assumption can
  be checked from the popup on a real day, without the console.
- `orgdate` is `yyyy-MM-dd`. Another format would misparse silently.
- ~~`entries` pair shape~~ — verified live 2026-09-10: entries are
  `{fdate, tdate}` pairs in `DD-MMM-YYYY - HH:mm` format, with `tdate: "-"` for
  an open session, and a day can hold several sessions. Both date formats are
  parsed; the worked-hours model's premise is confirmed.

A payload that no longer looks like attendance data is rejected rather than
cached, so a schema change surfaces as a visible error instead of a screen of
zeroes. Entry timestamps are normalised to ISO once at ingest; a value in a
format this extension does not know is kept verbatim, skipped by every
computation, and reported in the worker console once per refresh — never
guessed at, and never warned about once a second from the popup's timer loop.

## Roadmap

The next version is **1.9.0**, and it converts the front end to a framework.
Nothing else ships with it. Everything that was queued as 1.8.3 through 1.8.9
waits until the conversion is done — including the Chrome Web Store release,
which will now publish the rewritten extension rather than this one.

The trade that buys: the rewrite happens while the surface is small and nobody
outside this machine depends on it, and there is no window where two versions
of the same UI have to be kept working. What it costs: the conversion is
validated by the test suite and by daily use, not by other people's machines,
because the release comes after it.

### 1.9.0 — Framework conversion, and only that

**In scope.** The popup and the options page. That is the whole feature list;
no behaviour changes, no new tabs, no visual redesign. A version of this
README's *What it shows* section that is still true afterwards is the goal.

**Explicitly not in scope.** The service worker — MV3's worker is an event
handler with no DOM, and a framework buys it nothing. `policy.js`, `themes.js`
and `i18n.js` are framework-agnostic already and should come through
untouched; if the rewrite wants to change them, that is a sign the rewrite is
doing too much.

**The one thing that ships alongside it**, because it is the conversion's own
harness rather than an enhancement: the test suites move into the repo. Ten
node suites, the DOM-contract check and the render harnesses currently live in
a temporary directory. They are the definition of "the rewrite is correct", so
they have to exist before it starts, not after.

**Constraints the framework choice has to respect.**

- **MV3's CSP forbids remote scripts and `eval`**, so everything ships
  bundled and self-contained. This supersedes the no-build-step entry below,
  for the front end only.
- **The popup must still paint from cache on the first frame.** Today it
  renders cached data immediately and revalidates behind it. A framework that
  pays hydration cost before first paint trades away the property the whole
  design rests on — measure it rather than assuming it.
- **The worker suites must pass unchanged.** They are what proves the
  behaviour survived; rewriting them alongside the UI would prove nothing.
- **The DOM-contract check needs a component-shaped replacement**, or the
  rewrite loses the guarantee that the popup and its markup agree.
- **Both themes, both languages, ten colorschemes and the custom scheme keep
  working**, driven by the same tokens and string tables as now.

**Still to decide: which framework.** React with a build step is the
conventional answer and is fine here. Preact is the same programming model at
a fraction of the bundle, which matters for a surface whose entire budget is
one frame. Decide it on a first-paint measurement of a spike, not on
familiarity.

**Done when** every behaviour in the release notes below still holds, the
suite passes unchanged, and `scripts/package.sh` ships a bundle that loads
unpacked with no CSP errors.

### After 1.9.0

Deferred from the 1.8 line by the change of plan, in the order they are most
likely to matter. None of them are started until the conversion is done.

- **Chrome Web Store, unlisted** — the submission kit is already written
  (`store/listing.md`, `store/announcement.md`, `PRIVACY.md`, `INSTALL.md`).
  Remaining: screenshots generated from the render harness on synthetic data,
  a promo tile, `PRIVACY.md` hosted at a public URL, the $5 developer account,
  upload, submit. Unlisted still goes through human review.
- **Truth pass** — read the raw `approvalInfo` from a real request day's
  calendar tooltip and the status list on the options page, then replace the
  guessed keyword defaults with what the portal actually sends. If
  `approvalInfo` is an always-present empty object, the requests quota needs a
  different predicate.
- **Vietnamese everywhere** — the options page is English-only, and worker
  error messages surface verbatim in the alert strip. Store a code and
  parameters in `lastError` and translate at render time.
- **Archives that stay true** — a month fetched by the back-arrows is cached
  forever, so a correction to a closed cycle never appears. Refresh on demand
  or expire after a week; prune what falls outside the twelve-cycle window.
- **Fit and finish** — the ~609px worst-case height, a first run in a
  different org (the portal id error should name the options page), the VI
  freshness stamp wrapping, keyboard stepping for the calendar.
- **Release engineering** — a packaging guard that checks the zip against
  what `manifest.json` and the HTML reference, a version-consistency check
  (anchored under *Release notes*, since the roadmap also uses version
  headings), and a written clean-profile smoke test.

**Gated on a DevTools capture.** Each becomes a new popup tab once one request
is captured from Zoho with the Network tab open on the relevant page.

- **Leave balances** by type (leave page capture).
- **Upcoming holidays with names** (holidays page capture — often the same
  response as leave). Holidays already in the attendance payload are marked on
  the calendar as of 1.8.0.
- **Team: who's out today** (team/colleagues page capture).

**Gated on observation, not code.** Flip the target model to worked hours once
the popup's "Worked …" line has gone a week without turning red. Model, tests
and UI shipped in 1.4.0; only the default is conservative.

### Decided against (and why)

- **Any write to Zoho** (auto check-out, filing requests): undocumented
  endpoint, scraped token, consequences land on a real HR record.
- **Content script on people.zoho.com**: more permissions and breakage surface
  for nothing the existing endpoint doesn't provide.
- ~~**Fetching more than two months**~~ — revisited in 1.8.0. Two months are
  still all a refresh fetches; the calendar's back-arrows fetch one extra
  month on demand, cache it under its own key, and never refetch it. The
  original objection (load on an internal endpoint for history nobody looks
  at) holds for fetching history nobody asked for, not for a month the user
  just navigated to.
- **`chrome.storage.sync`**: single user, single machine; adds write quotas.
- **Charting library / build step / TypeScript**: MV3 CSP forbids remote
  scripts and the no-tooling property is a feature at this size — superseded
  for the front end by 1.9.0, which cannot ship a framework without bundling.
  The worker keeps the property.
- **Options page as the only config path**: console overrides intentionally
  keep working; they write the same storage keys.

## Release notes

### 1.8.2.1 — 2026-09-10

- Past-cycle loading confirmed working against a live session: the calendar's
  back-arrows fetch, cache and render a month outside the rolling two-month
  window. A four-part version because this confirms 1.8.2 and adds no
  behaviour — 1.8.3 is spoken for by the roadmap.
- `preMonth` verified as a true month offset rather than the two-state flag
  its only two original call sites made it look like; see *Unverified
  assumptions*.

### 1.8.2 — 2026-09-10

- A month Zoho answers with the wrong period is refused instead of cached
  under the label that was asked for. `preMonth` is undocumented past 1, and
  the calendar's back-arrows ask for more than that; the error now names both
  the month requested and the month received.
- The calendar no longer claims to be loading a month it will never ask for.
  From the 21st onward the current cycle reaches into next month, and a future
  month is not missing data — it has none yet.
- A month that fails to load says why, and keeps saying it. The failure was
  previously written straight to the note, so the next repaint — any storage
  change causes one — replaced it with "loading" for a fetch that was no
  longer running. The refresh button now also retries a failed month.

### 1.8.1 — 2026-09-10

- Attendance-request days are filled amber across the whole cell instead of
  carrying a corner dot: the request outranks the hours bucket in the grid,
  and the hours stay in the tooltip. Today's ring switches to `--on-amber` on
  those cells, since an amber ring on an amber cell is no ring at all.

### 1.8.0 — 2026-09-10

- The calendar navigates: arrows beside the label step a whole payroll cycle
  at a time, up to a year back. A cycle the rolling two-month window never
  covered is fetched from Zoho once, stored under its own month key in a
  separate `archivedMonths` store — separate because a refresh replaces
  `attendanceData` wholesale twice an hour and would otherwise throw the
  archive away with it — and is instant on every later visit. Quotas stay on
  the current cycle; they are about what is left to spend now.
- Holidays and weekends are read off the day's `status` and rendered
  distinctly: a holiday is hatched, a weekend washed, and a working day with
  nothing recorded still reads as empty — which is the one of the three that
  is actually a problem. Keywords are matched case-insensitively anywhere in
  the status ("Weekend/Holiday" counts as a holiday) and are editable on the
  options page, which now also lists the status strings your portal actually
  sends, with counts, so the lists can be matched to reality instead of to a
  guess in `policy.js`.

### 1.7.0 — 2026-09-10

- Attendance requests are traceable to a day: the calendar marks each day
  carrying a request with an amber corner dot, the quota row lists those dates
  under the checkboxes, and every request tooltip - on the calendar cell and on
  the checkbox slot - shows the raw `approvalInfo` verbatim, which is also how
  the last unverified payload assumption gets checked without the console.
- An empty `approvalInfo` (`{}`, `[]`, or a blank string) no longer counts as a
  used request. The plain truthiness test it replaces would have quietly
  inflated the count on every day Zoho attaches an empty field to.
- Calendar alignment, second half: the today cell's date sat 5px low because
  the unrelated `.today` panel rule also matched it and leaked its padding in.
  That rule is now element-qualified, so every date in the grid renders at the
  same pixel and colour is the only thing that distinguishes them.

### 1.6.2 — 2026-09-10

- Distribution: store submission kit (`store/listing.md`), bilingual install
  guide (`INSTALL.md`), privacy policy (`PRIVACY.md`), and a reproducible
  packaging script (`scripts/package.sh`). Renamed to "Attendance Tracker for
  Zoho People" to comply with store trademark rules; sharper description.

### 1.6.1 — 2026-09-10

- Zoho date parsing made strict: an unrecognised timestamp returns null and is
  skipped instead of being guessed into a wrong date, each unknown value warns
  once instead of once a second from the popup's timer loop, and the worker
  canonicalises all entry timestamps to ISO at ingest. Added 12-hour AM/PM and
  seconds variants.
- Calendar: today's cell no longer breaks the grid — the outline ring was
  replaced with an inset amber ring, so every date cell is identical in size
  and today differs by colour only.

### 1.6.0 — 2026-09-10

- English/Vietnamese language switcher in the popup header; all popup text,
  worker notifications, and badge tooltips are localised, and the choice is
  remembered.
- Colorscheme selector on the options page: ten built-in palettes (Gruvbox,
  Catppuccin, Nord, Dracula, Solarized, Tokyo Night, Everforest, Rosé Pine,
  One Dark, Kanagawa) plus a custom scheme defined by six colors per mode.
  The toolbar badge follows the scheme.
- Fixed the live Zoho entry format ("10-Sep-2026 - 09:29", open sessions as
  tdate "-") that flooded the console and broke worked-hours math — and in
  doing so confirmed entries are check-in/check-out pairs, validating the
  worked-hours model's premise.

### 1.5.0 — 2026-09-10

- Calendar tab: the whole payroll cycle as a grid built from already-cached
  data — worked days by bucket, leave, absences, future days, today. Active
  tab is remembered.

### 1.4.0 — 2026-09-10

- Worked-hours target model (opt-in via the options page): targets computed
  from hours actually worked rather than check-in plus a fixed offset, with a
  permanent side-by-side line that turns red when the two models disagree.

### 1.3.0 — 2026-09-10

- Options page for the whole attendance policy and portal id.
- Stale-while-revalidate: the popup paints from cache instantly and refreshes
  itself in the background; storage changes repaint it live.
- Past-midnight fallback: a late start whose target crosses 00:00 keeps
  yesterday's countdown alive instead of resetting at midnight.
- One-time "long day ahead" notification when check-in already implies a
  target past the late-evening threshold.
- Badge tooltip with the actual target time; badge turns red for late targets.

### 1.2.0 — 2026-09-10

- Notifications at the part-time and full-time marks via exact chrome.alarms,
  with snooze; a toolbar badge counts down to full-time and flips to OK.
- Freshness stamp ("updated 4m ago") and real error surfacing — an expired
  session shows a message instead of silently serving stale data.
- Degenerate Zoho payloads are rejected rather than cached; policy extracted
  into a shared module; 48px and 128px icons.
- Timecard UI redesign (printed-timesheet idiom), later set in the Gruvbox
  palette with light/dark modes, a theme toggle, and over-quota states
  (amber at the cap, red past it).

### 1.1.0 — 2026-09-10

- Correctness: local-time date keys (the popup showed "No record today" every
  morning until 07:00 at UTC+7), a single 13:15 late-start comparison (14:05
  check-ins got the wrong targets), explicit local-time Zoho date parsing,
  awaited token sync, reachable error paths, and de-duplicated month merging
  keyed by date.
- Structure: a 15-minute chrome.alarms refresh (the worker previously never
  refreshed on its own), one onInstalled listener, dropped forbidden headers
  and the per-tab-switch cookie read, portal id made overridable.
- Hygiene: README, .gitignore, version bump; removed a stray file copy and
  unused icon; stopped logging the CSRF token.

### 1.0 — 2025-04-01

- Original extension by TungHH: fetch Zoho People attendance for the current
  and previous month, cache it, and show check-in time, checkout targets, and
  monthly-cycle quota usage in a popup.
