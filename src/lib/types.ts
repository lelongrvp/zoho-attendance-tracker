export type Lang = "en" | "vi";
export type ThemeMode = "light" | "dark";
export type TargetMode = "offset" | "worked";

// Zoho
export type ZohoEntry = {
  fdate?: string;
  tdate?: string;
};

export type ZohoDay = {
  orgdate: string;
  tsecs?: number | string;
  status?: string;
  leaveDaysTaken?: number | string;
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

// Policy

export type Policy = {
  cycleStartDay: number;
  fullDaySeconds: number;
  shortDaySeconds: number;
  earlyPartTimeHours: number;
  earlyFullTimeHours: number;
  latePartTimeHours: number;
  lateFullTimeHours: number;
  lateStartAfterMinutes: number;
  lateThresholdMinutes: number;
  targetMode: TargetMode;
  shortDayQuota: number;
  requestQuota: number;
  violationQuota: number;
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
  isFromYesterday: boolean;
};

export type WorkedTime = {
  workedMs: number;
  isOpen: boolean;
};

/** Targets projected from hours actually worked, carrying the work they used. */
export type WorkedTargets = Targets & WorkedTime;

export type StatusCount = {
  status: string;
  count: number;
};

export type Cycle = {
  start: Date;
  end: Date;
};

export type NonWorkingKind = "holiday" | "weekend" | "";

// Theming

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

export type TokenName =
  | "--color-paper"
  | "--color-panel"
  | "--color-ink"
  | "--color-ink-2"
  | "--color-ink-3"
  | "--color-ink-faint"
  | "--color-rule"
  | "--color-rule-strong"
  | "--color-wash"
  | "--color-stamp"
  | "--color-stamp-tint"
  | "--color-stamp-line"
  | "--color-stamp-text"
  | "--color-on-stamp"
  | "--color-moss"
  | "--color-amber"
  | "--color-on-amber";

export type Tokens = Record<TokenName, string>;

export type BadgeColors = {
  ok: string;
  late: string;
  neutral: string;
};

// Storage

export type LastError = {
  message: string;
  at: number;
};

/** Which gates have already notified today, so a re-arm does not re-fire them. */
export type GateState = {
  date: string;
  fired: string[];
};

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
  gateState: GateState;
};

export type StorageKey = keyof StorageShape;
