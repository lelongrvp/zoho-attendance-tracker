// The shapes the worker, the popup and the options page all agree on.
//
// Two of these describe data this extension does not control. Zoho's endpoint
// is undocumented and its response was inferred from the original code and
// confirmed field by field against live sessions (see README, "Unverified
// assumptions"). Where a field is still a guess, the type says so rather than
// a comment: `approvalInfo` is `unknown`, which forces every use site to
// narrow it instead of trusting it.

export type Lang = "en" | "vi";
export type ThemeMode = "light" | "dark";
export type TargetMode = "offset" | "worked";

// ---------------------------------------------------------------- Zoho

/** One punch pair. An open session carries the literal placeholder `tdate: "-"`. */
export type ZohoEntry = {
  fdate?: string;
  tdate?: string;
};

/**
 * One day of the attendance response. Zoho sends numbers as strings often
 * enough that the numeric fields accept both; every read goes through
 * `Number(...)` already.
 */
export type ZohoDay = {
  orgdate: string;
  tsecs?: number | string;
  status?: string;
  leaveDaysTaken?: number | string;
  /** Unverified: present means an attendance request, but the shape is not confirmed. */
  approvalInfo?: unknown;
};

export type AttendanceData = {
  dayList: Record<string, ZohoDay>;
  entries?: Record<string, ZohoEntry[]>;
};

/** A month outside the rolling window, fetched on demand by the calendar. */
export type ArchivedMonth = {
  dayList: Record<string, ZohoDay>;
};

// ---------------------------------------------------------------- policy

export type Policy = {
  cycleStartDay: number;
  fullDaySeconds: number;
  shortDaySeconds: number;
  earlyPartTimeHours: number;
  earlyFullTimeHours: number;
  latePartTimeHours: number;
  lateFullTimeHours: number;
  /** Minutes past midnight after which a check-in counts as a late start. */
  lateStartAfterMinutes: number;
  /** Minutes past midnight after which a target is flagged as a long day. */
  lateThresholdMinutes: number;
  targetMode: TargetMode;
  shortDayQuota: number;
  requestQuota: number;
  violationQuota: number;
  /** Keywords matched case-insensitively anywhere in a day's `status`. */
  holidayStatuses: string[];
  weekendStatuses: string[];
  staleAfterMinutes: number;
};

export type Targets = {
  partTime: Date;
  fullTime: Date;
};

export type ActiveCheckin = {
  checkin: Date;
  /** A late start can push the full-time target past midnight. */
  isFromYesterday: boolean;
};

export type WorkedTime = {
  workedMs: number;
  isOpen: boolean;
};

export type Cycle = {
  start: Date;
  end: Date;
};

export type NonWorkingKind = "holiday" | "weekend" | "";

// ---------------------------------------------------------------- theming

/** The eleven neutrals and tints the resolver derives by blending. */
export type DerivedColors = {
  ink2: string;
  ink3: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  wash: string;
  stampTint: string;
  stampLine: string;
  stampText: string;
  onStamp: string;
  onAmber: string;
};

/**
 * Six base colours per mode. Any derived token may also be pinned - Gruvbox,
 * the default, pins its full canonical set rather than accepting blends.
 */
export type SchemeColors = {
  paper: string;
  panel: string;
  ink: string;
  stamp: string;
  moss: string;
  amber: string;
} & Partial<DerivedColors>;

export type Scheme = {
  name: string;
  light: SchemeColors;
  dark: SchemeColors;
};

/** Every CSS custom property the stylesheet reads. Naming them here is what
 * makes `tokens["--moss"]` a string rather than a maybe-string, and what makes
 * a typo in a token name a compile error instead of a transparent element. */
export type TokenName =
  | "--paper"
  | "--panel"
  | "--ink"
  | "--ink-2"
  | "--ink-3"
  | "--ink-faint"
  | "--rule"
  | "--rule-strong"
  | "--wash"
  | "--stamp"
  | "--stamp-tint"
  | "--stamp-line"
  | "--stamp-text"
  | "--on-stamp"
  | "--moss"
  | "--amber"
  | "--on-amber";

export type Tokens = Record<TokenName, string>;

export type BadgeColors = {
  ok: string;
  late: string;
  neutral: string;
};

// ---------------------------------------------------------------- storage

export type LastError = {
  message: string;
  at: number;
};

/**
 * Everything this extension keeps in `chrome.storage.local`. It is the only
 * store: the worker writes, both pages read, and `chrome.storage.onChanged`
 * is what keeps them in step.
 */
export type StorageShape = {
  attendanceData: AttendanceData;
  archivedMonths: Record<string, ArchivedMonth>;
  csrfToken: string;
  lastSuccessAt: number;
  lastError: LastError | null;
  policy: Partial<Policy>;
  portalId: string;
  theme: ThemeMode;
  lang: Lang;
  scheme: string;
  customScheme: Scheme;
  activeTab: "attendance" | "calendar";
  /** Which gates have already fired today, so a re-arm does not re-notify. */
  gateState: { date: string; fired: string[] };
};

export type StorageKey = keyof StorageShape;
