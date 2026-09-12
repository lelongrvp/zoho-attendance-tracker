import type { Lang } from "../lib/types.ts";
import type { Translator } from "../lib/i18n.ts";
import { monthNames, weekdayNames } from "../lib/i18n.ts";
import { pad } from "../lib/policy.ts";

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(diffMs: number): string {
  if (diffMs <= 0) {
    return "00:00:00";
  }
  const totalSecs: number = Math.floor(diffMs / 1000);
  const hours: number = Math.floor(totalSecs / 3600);
  const minutes: number = Math.floor((totalSecs % 3600) / 60);
  const seconds: number = totalSecs % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDayLabel(date: Date, lang: Lang): string {
  return `${weekdayNames(lang)[date.getDay()]} ${date.getDate()} ${monthNames(lang)[date.getMonth()]}`;
}

export function formatAgo(minutes: number, translate: Translator): string {
  if (minutes < 1) {
    return translate("justNow");
  }
  if (minutes < 60) {
    return translate("agoMinutes", { n: minutes });
  }
  const hours: number = Math.floor(minutes / 60);
  if (hours < 24) {
    return translate("agoHours", { n: hours });
  }
  return translate("agoDays", { n: Math.floor(hours / 24) });
}

export function formatSignedHours(seconds: number): string {
  const sign: string = seconds < 0 ? "−" : "+";
  const total: number = Math.round(Math.abs(seconds) / 60);
  const hours: number = Math.floor(total / 60);
  const minutes: number = total % 60;
  return hours === 0
    ? `${sign}${minutes}m`
    : `${sign}${hours}h ${pad(minutes)}m`;
}
