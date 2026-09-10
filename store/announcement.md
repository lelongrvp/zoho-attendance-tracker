# Introduction post

Copy-paste material for announcing the extension internally. Three lengths;
pick one. Replace `<LINK>` with the Chrome Web Store link (or the zip location
plus a pointer to INSTALL.md while the store listing is pending).

---

## Short — chat message (English)

I built a small Chrome extension for our Zoho People attendance, and it is
ready if anyone wants it.

It puts the answer to "when can I leave?" in the toolbar. The icon counts down
to your full-day mark, and the popup shows your check-in, both checkout targets
(part-time and full-time), and how much of the monthly quota you have spent —
short days, attendance requests, days under 6 hours — for the 21st-to-20th
payroll cycle. It notifies you when you hit each mark, even with the popup
closed, and warns you in the morning if a late check-in already means you are
leaving after 19:30.

It only reads your own data, through your own Zoho session. Nothing is sent
anywhere: no server, no account, no tracking. English and Vietnamese, light and
dark, ten colorschemes.

Install: <LINK> — sign in to people.zoho.com once and it takes care of itself.

---

## Short — chat message (Tiếng Việt)

Mình có làm một extension Chrome nhỏ cho phần chấm công Zoho People, ai cần thì
lấy dùng nhé.

Nó trả lời giúp câu "mấy giờ mình được về?" ngay trên thanh công cụ. Icon đếm
ngược tới mốc đủ công, còn popup hiện giờ check-in, hai mốc check-out (nửa công
và đủ công), và đã dùng bao nhiêu trong hạn mức tháng — ngày 6-8 tiếng, đơn xin
chấm công, ngày dưới 6 tiếng — theo chu kỳ lương 21 đến 20. Tới mốc là có thông
báo, kể cả khi không mở popup; và nếu sáng check-in muộn tới mức phải về sau
19:30 thì nó báo trước ngay từ sáng.

Extension chỉ đọc dữ liệu của chính bạn, qua phiên đăng nhập Zoho của bạn.
Không gửi dữ liệu đi đâu cả: không server, không tài khoản, không theo dõi. Có
tiếng Việt và tiếng Anh, sáng/tối, mười bộ màu.

Cài đặt: <LINK> — đăng nhập people.zoho.com một lần là xong.

---

## Long — announcement channel or wiki page

**Attendance Tracker for Zoho People**

Zoho tells you when you checked in. It does not tell you when you can leave.
Working that out means opening the attendance page, reading the check-in time,
adding 7h15 or 9h15, remembering that a check-in after 13:15 changes those to
6h and 8h, and then keeping the number in your head all day. This extension
does that part.

**In the popup**

- Today: check-in, part-time and full-time checkout targets, a live countdown
  to each, and a progress bar for the day.
- Cycle usage: your quotas for the 21st-to-20th payroll cycle — days worked 6-8
  hours (5 allowed), attendance requests (3 allowed), days under 6 hours — with
  the count turning amber when you land exactly on the limit and red when you
  go past it. Each used slot's tooltip names the day it came from.
- Daily hours: one bar per day of the cycle, plus a running balance against 8h
  per recorded day, so a pattern of short days is visible as a pattern.
- Calendar tab: the whole cycle as a grid — full days, short days, leave,
  absences, today.

**Outside the popup**

- The toolbar badge counts down to your full-time target and turns red if that
  target lands after 19:30. Hover it for the exact time.
- Chrome notifies you at the part-time and full-time marks whether or not the
  popup is open, and each notification names the target time and how long ago
  it passed — so an alarm delivered late because your laptop was asleep is not
  mistaken for an on-time one.
- If a late check-in already puts your full day past 19:30, you get one
  heads-up in the morning, while something can still be done about it.

**Privacy**

It talks to people.zoho.com and nowhere else, using the session you are already
signed in with. Everything it fetches stays in your browser's local storage.
There is no account, no server, no analytics, and it never writes anything back
to Zoho — it cannot check you in or out.

**Notes**

- Unofficial, not affiliated with Zoho. It reads the same attendance data the
  Zoho web page reads.
- Targets, the late-start threshold, the cycle start day and the quota numbers
  are all editable on the options page, so it survives a policy change.
- It also switches between English and Vietnamese, follows your system light or
  dark setting, and ships ten colorschemes plus custom colors.

**Install:** <LINK> (step-by-step, both languages, in INSTALL.md)

Bugs and suggestions welcome — tell me what is wrong and I will fix it.
