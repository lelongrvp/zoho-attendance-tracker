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
  tooltip names the day it came from.
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
  tinted, future days dashed, today ringed. Statuses the quota logic does not
  understand are shown verbatim in each cell's tooltip rather than interpreted.
  The active tab is remembered.
- **Stale-while-revalidate** — the popup always paints instantly from cache,
  then quietly asks the worker for fresh data if the cache is older than five
  minutes; the display repaints on its own when the answer lands. The header
  brand is also a link straight to Zoho People.

The popup follows your system light/dark setting on first open. The toggle in the
header overrides that, and the choice is remembered in `chrome.storage.local`.

## Install

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

## Known limitations

- Only the current and previous month are fetched, which is exactly enough for
  the 21st-to-20th cycle and nothing more.
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

- `approvalInfo` being truthy means an attendance request. If Zoho attaches an
  empty object to every day, every day gets counted.
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

## Release notes

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
