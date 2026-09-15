import type { VNode } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  AttendanceData,
  Lang,
  LastError,
  Policy,
  StorageKey,
  StorageShape,
} from "../lib/types.ts";
import type { Translator } from "../lib/i18n.ts";
import { normalizeLanguage } from "../lib/i18n.ts";
import { DEFAULT_POLICY, readPolicy } from "../lib/policy.ts";
import type { StorageChanges, StorageChangeListener } from "../lib/storage.ts";
import { onLocalChange, write } from "../lib/storage.ts";
import type { ActiveToday, AlertState, Freshness } from "./derive.ts";
import {
  deriveActiveToday,
  deriveAlert,
  deriveFreshness,
  shouldRequestBackgroundRefresh,
} from "./derive.ts";
import { useAppearance } from "./hooks/useAppearance.ts";
import { useNow } from "./hooks/useNow.ts";
import { useStorage } from "./hooks/useStorage.ts";
import { useTranslator } from "./hooks/useTranslator.ts";
import { AlertStrip } from "./components/AlertStrip.tsx";
import { CalendarView } from "./components/CalendarView.tsx";
import { CycleUsage } from "./components/CycleUsage.tsx";
import { Masthead } from "./components/Masthead.tsx";
import { Tabs } from "./components/Tabs.tsx";
import type { TabId } from "./components/Tabs.tsx";
import { TodayCard } from "./components/TodayCard.tsx";

type PopupKey = Extract<
  StorageKey,
  | "activeTab"
  | "theme"
  | "scheme"
  | "customScheme"
  | "lang"
  | "csrfToken"
  | "attendanceData"
  | "archivedMonths"
  | "lastSuccessAt"
  | "lastError"
>;

const POPUP_KEYS: readonly PopupKey[] = [
  "activeTab",
  "theme",
  "scheme",
  "customScheme",
  "lang",
  "csrfToken",
  "attendanceData",
  "archivedMonths",
  "lastSuccessAt",
  "lastError",
];

type PopupState = Partial<Pick<StorageShape, PopupKey>>;

function usePolicy(): Policy {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);

  useEffect((): (() => void) => {
    void readPolicy().then(setPolicy);
    const listener: StorageChangeListener = onLocalChange(
      (changes: StorageChanges): void => {
        if (changes.policy) {
          void readPolicy().then(setPolicy);
        }
      },
    );
    return (): void => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return policy;
}

export function App(): VNode {
  const stored: PopupState | null = useStorage(POPUP_KEYS);
  const policy: Policy = usePolicy();

  const lang: Lang = normalizeLanguage(stored?.lang);
  const translate: Translator = useTranslator(lang);
  const { mode, toggleTheme } = useAppearance(
    stored?.theme,
    stored?.scheme,
    stored?.customScheme,
  );

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);
  const autoRefreshRequested = useRef<boolean>(false);

  const attendanceData: AttendanceData | undefined = stored?.attendanceData;
  const csrfToken: string | undefined = stored?.csrfToken;
  const lastSuccessAt: number | undefined = stored?.lastSuccessAt;
  const lastError: LastError | null | undefined = stored?.lastError;

  // Only the countdowns tick; targets resolve once per data change, as before.
  const activeToday: ActiveToday | null = useMemo(
    (): ActiveToday | null =>
      deriveActiveToday(attendanceData, new Date(), policy),
    [attendanceData, policy],
  );
  const dataNow: Date = useMemo((): Date => new Date(), [attendanceData]);
  const now: number = useNow(1000, activeToday !== null);

  useEffect((): void => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect((): void => {
    if (
      shouldRequestBackgroundRefresh(
        csrfToken,
        lastSuccessAt,
        autoRefreshRequested.current,
        Date.now(),
      )
    ) {
      autoRefreshRequested.current = true;
      void chrome.runtime
        .sendMessage({ action: "updateAttendance" })
        .catch((): void => {});
    }
  }, [csrfToken, lastSuccessAt]);

  useEffect((): void => {
    setRefreshError(null);
  }, [csrfToken, lastError, lastSuccessAt]);

  // Before storage answers, show chrome only - never an alert a read would contradict.
  const alert: AlertState =
    refreshError !== null
      ? { kind: "error", message: refreshError }
      : stored
        ? deriveAlert(csrfToken, lastError, lastSuccessAt)
        : { kind: "hidden" };
  const freshness: Freshness = stored
    ? deriveFreshness(lastSuccessAt, policy.staleAfterMinutes, translate, now)
    : { text: "—", stale: false };
  const activeTab: TabId =
    stored?.activeTab === "calendar" ? "calendar" : "attendance";

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    setRefreshError(null);
    setRefreshNonce((previous: number): number => previous + 1);
    try {
      const response: { status: string; message: string } =
        await chrome.runtime.sendMessage({ action: "updateAttendance" });
      if (response.status !== "success") {
        setRefreshError(translate("refreshFailed", { msg: response.message }));
      }
    } catch (error) {
      setRefreshError(
        translate("refreshFailed", { msg: (error as Error).message }),
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Masthead
        freshness={freshness}
        lang={lang}
        mode={mode}
        onOpenOptions={(): void => {
          void chrome.runtime.openOptionsPage();
        }}
        onRefresh={(): void => void handleRefresh()}
        onToggleLang={(): void => {
          void write({ lang: lang === "en" ? "vi" : "en" });
        }}
        onToggleTheme={toggleTheme}
        refreshing={refreshing}
        translate={translate}
      />

      <AlertStrip state={alert} translate={translate} />

      <Tabs
        activeTab={activeTab}
        onSelect={(tab: TabId): void => {
          void write({ activeTab: tab });
        }}
        translate={translate}
      />

      {/* Both stay mounted so the calendar's archive-fetch bookkeeping survives a tab switch. */}
      <div hidden={activeTab !== "attendance"}>
        <TodayCard
          activeToday={activeToday}
          now={now}
          policy={policy}
          translate={translate}
        />
        <CycleUsage
          dayList={attendanceData?.dayList ?? {}}
          now={dataNow}
          policy={policy}
          lang={lang}
          translate={translate}
        />
      </div>

      <div hidden={activeTab !== "calendar"}>
        <CalendarView
          attendanceData={attendanceData}
          archivedMonths={stored?.archivedMonths}
          policy={policy}
          lang={lang}
          translate={translate}
          refreshNonce={refreshNonce}
        />
      </div>
    </>
  );
}
