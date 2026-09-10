# Privacy policy — Attendance Tracker for Zoho People

Effective 2026-09-10.

This extension shows you your own attendance data from Zoho People. It is a
viewer, not a service.

**What it accesses.** With your permission it reads the `CSRF_TOKEN` cookie for
`people.zoho.com` and uses your existing Zoho People browser session to request
your own attendance records (current and previous month) from Zoho.

**Where data goes.** Nowhere. Attendance data, your settings (language, theme,
policy), and the token are stored only in your browser's local extension
storage (`chrome.storage.local`). The extension makes network requests to
`people.zoho.com` only — there is no other server, no analytics, no telemetry,
no error reporting, and nothing is ever transmitted to the developer or any
third party.

**Notifications.** Reminders ("time to leave") are generated locally from the
cached data and shown by your browser.

**Data removal.** Uninstalling the extension deletes everything it stored.

**Contact.** Open an issue on the project repository or contact the person who
shared the extension with you.
