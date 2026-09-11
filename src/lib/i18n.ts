import type { Lang } from "./types.ts";

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

// Popup and notification strings. English is the fallback for any key a
// language table is missing.
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    tabAttendance: "Attendance",
    tabCalendar: "Calendar",
    checkedIn: "Checked in",
    fullTime: "Full-time",
    partTime: "Part-time",
    cycleQuotas: "Cycle quotas",
    dailyHours: "Daily hours this cycle",
    cycleCalendar: "Cycle calendar",
    quota68: "Days 6–8 hours",
    quotaRequests: "Attendance requests",
    quotaUnder6: "Days under 6 hours",
    leaveDays: "Leave days",
    absent: "Absent",
    balance: "Balance",
    legFull: "Full day",
    legShort: "6–8h",
    legLow: "Under 6h",
    legLeave: "Leave",
    legAbsent: "Absent",
    legRequest: "Request",
    legHoliday: "Holiday",
    legWeekend: "Weekend",
    legNone: "No record",
    wdMon: "Mon",
    wdTue: "Tue",
    wdWed: "Wed",
    wdThu: "Thu",
    wdFri: "Fri",
    wdSat: "Sat",
    wdSun: "Sun",
    titleSettings: "Settings",
    titleTheme: "Switch between light and dark",
    titleRefresh: "Refresh attendance data",
    titleLang: "Chuyển sang tiếng Việt",
    titleBrand: "Open Zoho People",
    loading: "Loading...",
    noRecordToday: "No record today",
    noDataFound: "No data found",
    pending: "Pending",
    completed: "Completed",
    completedOver: "Completed (+{h}h {m}m)",
    timeLeft: "{t} left",
    yesterdayAt: "Yesterday · {t}",
    workedLine: "Worked {h}h {m}m",
    workedFullAt: " — full day at {t}",
    workedCheckedOut: " — checked out",
    divergeTooltip:
      "The worked-hours projection differs from the schedule target — check whether Zoho records your breaks before switching the target model.",
    updatedAgo: "updated {t}",
    justNow: "just now",
    neverUpdated: "never updated",
    agoMinutes: "{n}m ago",
    agoHours: "{n}h ago",
    agoDays: "{n}d ago",
    usedOf: "{n} of {m} used",
    noRecords: "No records",
    none: "None",
    refreshFailed: "Refresh failed: {msg}",
    loginPrompt: "Please log in to {link}",
    calNoData: "no data",
    calRequest: "attendance request",
    calPrev: "Previous cycle",
    calNext: "Next cycle",
    calFetching: "Loading that cycle from Zoho…",
    calFetchFailed: "Could not load that cycle",
    notifLongDayTitle: "Long day ahead",
    notifLongDayMsg: "Full-time lands at {t} — past {th}.",
    notifPartTitle: "Part-time reached",
    notifFullTitle: "Full day complete",
    notifTargetWas: "{gate} target was {t} — {ago} ago.",
    notifTargetReached: "{gate} target reached at {t}.",
    gateNamePart: "Part-time",
    gateNameFull: "Full-time",
    snooze: "Snooze 15 min",
    badgeNoCheckin: "Zoho Attendance — no check-in yet",
    badgeComplete: "Full day complete — target was {t}",
    badgeFullAt: "Full-time at {t}",
  },
  vi: {
    tabAttendance: "Chấm công",
    tabCalendar: "Lịch",
    checkedIn: "Giờ vào",
    fullTime: "Đủ công",
    partTime: "Nửa công",
    cycleQuotas: "Hạn mức chu kỳ",
    dailyHours: "Giờ làm trong chu kỳ",
    cycleCalendar: "Lịch chu kỳ",
    quota68: "Ngày 6–8 giờ",
    quotaRequests: "Yêu cầu chấm công",
    quotaUnder6: "Ngày dưới 6 giờ",
    leaveDays: "Ngày phép",
    absent: "Vắng mặt",
    balance: "Cân đối",
    legFull: "Đủ công",
    legShort: "6–8g",
    legLow: "Dưới 6g",
    legLeave: "Nghỉ phép",
    legAbsent: "Vắng",
    legRequest: "Đơn chấm công",
    legHoliday: "Ngày lễ",
    legWeekend: "Cuối tuần",
    legNone: "Trống",
    wdMon: "T2",
    wdTue: "T3",
    wdWed: "T4",
    wdThu: "T5",
    wdFri: "T6",
    wdSat: "T7",
    wdSun: "CN",
    titleSettings: "Cài đặt",
    titleTheme: "Đổi giao diện sáng/tối",
    titleRefresh: "Làm mới dữ liệu",
    titleLang: "Switch to English",
    titleBrand: "Mở Zoho People",
    loading: "Đang tải...",
    noRecordToday: "Chưa chấm công hôm nay",
    noDataFound: "Không có dữ liệu",
    pending: "Chờ",
    completed: "Hoàn thành",
    completedOver: "Hoàn thành (+{h}g {m}p)",
    timeLeft: "còn {t}",
    yesterdayAt: "Hôm qua · {t}",
    workedLine: "Đã làm {h}g {m}p",
    workedFullAt: " — đủ công lúc {t}",
    workedCheckedOut: " — đã check-out",
    divergeTooltip:
      "Dự báo theo giờ làm thực tế lệch với mốc theo lịch — kiểm tra xem Zoho có ghi giờ nghỉ không trước khi đổi mô hình.",
    updatedAgo: "cập nhật {t}",
    justNow: "vừa xong",
    neverUpdated: "chưa cập nhật",
    agoMinutes: "{n}p trước",
    agoHours: "{n}g trước",
    agoDays: "{n} ngày trước",
    usedOf: "Đã dùng {n}/{m}",
    noRecords: "Chưa có",
    none: "Không có",
    refreshFailed: "Làm mới thất bại: {msg}",
    loginPrompt: "Vui lòng đăng nhập {link}",
    calNoData: "không có dữ liệu",
    calRequest: "có đơn chấm công",
    calPrev: "Chu kỳ trước",
    calNext: "Chu kỳ sau",
    calFetching: "Đang tải chu kỳ từ Zoho…",
    calFetchFailed: "Không tải được chu kỳ này",
    notifLongDayTitle: "Hôm nay sẽ về muộn",
    notifLongDayMsg: "Đủ công lúc {t} — quá {th}.",
    notifPartTitle: "Đã đủ nửa công",
    notifFullTitle: "Đã đủ công",
    notifTargetWas: "Mốc {gate} là {t} — {ago}.",
    notifTargetReached: "Đạt mốc {gate} lúc {t}.",
    gateNamePart: "Nửa công",
    gateNameFull: "Đủ công",
    snooze: "Báo lại sau 15p",
    badgeNoCheckin: "Zoho Attendance — chưa chấm công",
    badgeComplete: "Đã đủ công — mốc là {t}",
    badgeFullAt: "Đủ công lúc {t}",
  },
};

const MONTHS: Record<Lang, string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  vi: [
    "Thg 1",
    "Thg 2",
    "Thg 3",
    "Thg 4",
    "Thg 5",
    "Thg 6",
    "Thg 7",
    "Thg 8",
    "Thg 9",
    "Thg 10",
    "Thg 11",
    "Thg 12",
  ],
};
const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
};

export function normalizeLanguage(value: unknown): Lang {
  return value === "vi" ? "vi" : "en";
}

export function makeTranslator(lang: Lang): Translator {
  const table: Record<string, string> = STRINGS[normalizeLanguage(lang)];
  return (
    key: string,
    params: Record<string, string | number> = {},
  ): string => {
    let text: string = table[key] ?? STRINGS.en[key] ?? key;
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
    return text;
  };
}

export function monthNames(lang: Lang): string[] {
  return MONTHS[normalizeLanguage(lang)];
}

export function weekdayNames(lang: Lang): string[] {
  return WEEKDAYS[normalizeLanguage(lang)];
}

// Static labels carry data-i18n (textContent) or data-i18n-title (tooltip).
export function applyStaticTranslations(
  root: ParentNode,
  translate: Translator,
): void {
  root
    .querySelectorAll<HTMLElement>("[data-i18n]")
    .forEach((element: HTMLElement): void => {
      element.textContent = translate(element.dataset["i18n"] ?? "");
    });
  root
    .querySelectorAll<HTMLElement>("[data-i18n-title]")
    .forEach((element: HTMLElement): void => {
      const text: string = translate(element.dataset["i18nTitle"] ?? "");
      element.title = text;
      if (element.hasAttribute("aria-label")) {
        element.setAttribute("aria-label", text);
      }
    });
}
