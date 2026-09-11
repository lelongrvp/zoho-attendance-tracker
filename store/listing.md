# Chrome Web Store submission kit

Everything below is ready to paste into the developer dashboard
(https://chrome.google.com/webstore/devconsole, one-time $5 registration).
Recommended visibility: **Unlisted** — installable only via the direct link you
share; invisible in search.

## Name

Attendance Tracker for Zoho People

("for Zoho People", not "Zoho …", to stay on the right side of the store's
trademark rules — extensions may not lead with a brand they don't own.)

## Summary (132 chars max)

See today's checkout targets, live countdowns, and monthly quota usage from
Zoho People — with leave-on-time reminders.

## Description

Opens your own Zoho People attendance in one popup: check-in time, part-time
and full-time checkout targets with live countdowns, a progress bar for the
day, and your monthly-cycle quotas (short days, attendance requests, days
under 6 hours), plus a cycle calendar, daily-hours chart, and running balance.

- Reminds you when you hit your part-time and full-time marks — even with the
  popup closed — and warns in the morning when a late check-in already means a
  long day.
- Toolbar badge counts down the time left; hover it for the target time.
- English and Vietnamese. Light and dark mode, ten colorschemes, custom
  colors.
- Everything stays in your browser: the extension talks only to
  people.zoho.com using your existing session, stores data locally, and sends
  nothing anywhere else.

Requires an active Zoho People account. Sign in at people.zoho.com in the same
browser; the extension does the rest. Your org's portal id and attendance
policy are configurable on the options page.

## Category

Productivity / Tools

## Language

English (extension UI also ships Vietnamese)

## Single-purpose statement

Displays the signed-in user's own Zoho People attendance data and reminds them
when their daily working-time targets are reached.

## Permission justifications

- **host_permissions `https://people.zoho.com/*`** — fetches the user's own
  attendance records from Zoho People using their existing session; the only
  host contacted.
- **cookies** — reads the `CSRF_TOKEN` cookie for people.zoho.com, required by
  Zoho's endpoint to authorize the request. No other cookie is read.
- **storage** — caches attendance data and user settings locally so the popup
  opens instantly.
- **alarms** — schedules the 15-minute background refresh and the exact-time
  leave reminders (MV3 service workers cannot use timers).
- **notifications** — shows the part-time/full-time reminders and the
  long-day heads-up.

## Data usage disclosures (Privacy tab)

- Collects: no user data is collected or transmitted; attendance data is
  processed locally only. (Tick "Website content" as _accessed_, mark all
  transmission/sale/unrelated-use boxes **No**.)
- Privacy policy URL: host `PRIVACY.md` publicly (e.g. a GitHub repo) and
  paste its URL.

## Assets checklist

- Icon: `icon128.png` (already in repo).
- Screenshots, 1280x800 or 640x400: capture the popup on a real Zoho account —
  attendance tab (light + dark), calendar tab, options page. Crop tight, no
  personal data (blur names/times if needed).
- Zip: `scripts/package.sh` → `dist/attendance-tracker-v<version>.zip`.

## Review-risk notes (worth knowing before submitting)

- Cookie access + a single-host permission on a third-party site is legitimate
  but gets human review; the justifications above address it directly.
- The endpoint is Zoho's internal `AttendanceViewAction.zp`, not the public
  API. That is not a store violation (it acts on the user's own session), but
  if Zoho changes it the extension breaks until updated — auto-update via the
  store is what makes that survivable for non-tech users.
- Publishing "Unlisted" still requires the full privacy disclosures.
