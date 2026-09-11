import type { Policy, Scheme, TargetMode, ThemeMode } from "../lib/types.ts";
import { DEFAULT_POLICY, pad } from "../lib/policy.ts";
import { SCHEMES } from "../lib/themes.ts";

/** Policy keys edited as plain numbers. */
const PLAIN_FIELDS = {
  cycleStartDay: "cycleStartDay",
  earlyPartTimeHours: "earlyPartTimeHours",
  earlyFullTimeHours: "earlyFullTimeHours",
  latePartTimeHours: "latePartTimeHours",
  lateFullTimeHours: "lateFullTimeHours",
  shortDayQuota: "shortDayQuota",
  requestQuota: "requestQuota",
  violationQuota: "violationQuota",
  staleAfterMinutes: "staleAfterMinutes",
} satisfies Record<string, keyof Policy>;

/** Policy keys stored as seconds but edited as hours. */
const HOUR_FIELDS = {
  fullDaySeconds: "fullDaySeconds",
  shortDaySeconds: "shortDaySeconds",
} satisfies Record<string, keyof Policy>;

/** Policy keys stored as minutes past midnight but edited as "HH:MM". */
const TIME_FIELDS = {
  lateStartAfterMinutes: "lateStartAfterMinutes",
  lateThresholdMinutes: "lateThresholdMinutes",
} satisfies Record<string, keyof Policy>;

export type PlainField = keyof typeof PLAIN_FIELDS;
export type HourField = keyof typeof HOUR_FIELDS;
export type TimeField = keyof typeof TIME_FIELDS;

export const PLAIN_KEYS: PlainField[] = Object.keys(
  PLAIN_FIELDS,
) as PlainField[];
export const HOUR_KEYS: HourField[] = Object.keys(HOUR_FIELDS) as HourField[];
export const TIME_KEYS: TimeField[] = Object.keys(TIME_FIELDS) as TimeField[];

export const COLOR_KEYS: (keyof Scheme["light"])[] = [
  "paper",
  "panel",
  "ink",
  "stamp",
  "moss",
  "amber",
];

/** Every control's value, as the DOM holds it: strings. */
export type FormState = {
  portalId: string;
  scheme: string;
  customScheme: Scheme;
  targetMode: TargetMode;
  holidayStatuses: string;
  weekendStatuses: string;
  numbers: Record<PlainField | HourField, string>;
  times: Record<TimeField, string>;
};

export function minutesToTimeValue(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function timeValueToMinutes(value: string): number {
  const [hours = 0, minutes = 0]: number[] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function blankCustomScheme(): Scheme {
  return {
    name: "Custom",
    light: { ...SCHEMES.gruvbox.light },
    dark: { ...SCHEMES.gruvbox.dark },
  };
}

export function policyToForm(
  policy: Policy,
  portalId: string,
  scheme: string,
  customScheme: Scheme | undefined,
): FormState {
  const numbers: Record<string, string> = {};
  for (const key of PLAIN_KEYS) {
    numbers[key] = String(policy[key]);
  }
  for (const key of HOUR_KEYS) {
    numbers[key] = String(policy[key] / 3600);
  }
  const times: Record<string, string> = {};
  for (const key of TIME_KEYS) {
    times[key] = minutesToTimeValue(policy[key]);
  }
  return {
    portalId,
    scheme,
    customScheme: customScheme ?? blankCustomScheme(),
    targetMode: policy.targetMode,
    holidayStatuses: policy.holidayStatuses.join(", "),
    weekendStatuses: policy.weekendStatuses.join(", "),
    numbers: numbers as FormState["numbers"],
    times: times as FormState["times"],
  };
}

export type FormResult =
  | { ok: true; policy: Policy }
  | { ok: false; message: string };

/** Same rules and messages the vanilla page used; nothing here is new. */
export function formToPolicy(form: FormState): FormResult {
  const policy: Policy = { ...DEFAULT_POLICY };

  for (const key of PLAIN_KEYS) {
    const value: number = Number(form.numbers[key]);
    if (!Number.isFinite(value)) {
      return { ok: false, message: `Invalid value for ${key}` };
    }
    policy[key] = value;
  }

  for (const key of HOUR_KEYS) {
    const value: number = Number(form.numbers[key]);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, message: `Invalid value for ${key}` };
    }
    policy[key] = Math.round(value * 3600);
  }

  for (const key of TIME_KEYS) {
    const value: string = form.times[key];
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return { ok: false, message: `Invalid time for ${key}` };
    }
    policy[key] = timeValueToMinutes(value);
  }

  if (form.targetMode !== "offset" && form.targetMode !== "worked") {
    return { ok: false, message: "Invalid target model" };
  }
  policy.targetMode = form.targetMode;

  policy.holidayStatuses = splitKeywords(form.holidayStatuses);
  policy.weekendStatuses = splitKeywords(form.weekendStatuses);

  if (policy.shortDaySeconds >= policy.fullDaySeconds) {
    return { ok: false, message: "Short-day floor must be below the full day" };
  }

  return { ok: true, policy };
}

function splitKeywords(value: string): string[] {
  return value
    .split(",")
    .map((word: string): string => word.trim())
    .filter(Boolean);
}

/** The mode the page is being viewed in, for the live scheme preview. */
export function pageMode(): ThemeMode {
  const stamped: string | undefined = document.documentElement.dataset["theme"];
  if (stamped === "dark" || stamped === "light") {
    return stamped;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
