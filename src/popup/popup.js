import {
  classifyNonWorkingDay,
  computeEffectiveTargets,
  computeWorkedTargets,
  describeAttendanceRequest,
  findActiveCheckin,
  hasAttendanceRequest,
  getCurrentCycle,
  getCycleAt,
  isPastLateThreshold,
  monthKey,
  monthKeysInRange,
  monthsAgoFor,
  pad,
  parseZohoTimestamp,
  readPolicy,
  toLocalDateKey,
  DEFAULT_POLICY,
} from "../lib/policy.ts";
import {
  applyStaticTranslations,
  makeTranslator,
  monthNames,
  normalizeLanguage,
  weekdayNames,
} from "../lib/i18n.ts";
import { applyTokens, resolveTokens } from "../lib/themes.ts";

const AUTO_REFRESH_AFTER_MS = 5 * 60 * 1000;

// Appearance = mode (light/dark) + scheme (palette). The stylesheet paints
// the Gruvbox default before JS runs; applyAppearance stamps the mode and
// overrides the tokens for whichever scheme is active.
let activeLang = "en";
let translate = makeTranslator("en");
let activeSchemeId = "gruvbox";
let activeCustomScheme = null;

function resolveSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyAppearance(mode) {
  document.documentElement.dataset.theme = mode;
  applyTokens(
    document.documentElement,
    resolveTokens(activeSchemeId, mode, activeCustomScheme),
  );
}

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyAppearance(next);
  chrome.storage.local.set({ theme: next });
}

function applyLanguage(lang) {
  activeLang = normalizeLanguage(lang);
  translate = makeTranslator(activeLang);
  document.documentElement.lang = activeLang;
  applyStaticTranslations(document, translate);
  const langLabel = document.getElementById("lang-label");
  if (langLabel) {
    // The button names the destination, like the theme glyphs do.
    langLabel.textContent = activeLang === "en" ? "VI" : "EN";
  }
}

function formatDayLabel(date) {
  return `${weekdayNames(activeLang)[date.getDay()]} ${date.getDate()} ${monthNames(activeLang)[date.getMonth()]}`;
}

function formatAgo(minutes) {
  if (minutes < 1) return translate("justNow");
  if (minutes < 60) return translate("agoMinutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("agoHours", { n: hours });
  return translate("agoDays", { n: Math.floor(hours / 24) });
}

function formatSignedHours(seconds) {
  const sign = seconds < 0 ? "−" : "+";
  const total = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours === 0
    ? `${sign}${minutes}m`
    : `${sign}${hours}h ${pad(minutes)}m`;
}

document.addEventListener("DOMContentLoaded", function () {
  const checkinTimeElem = document.getElementById("checkin-time");
  const checkout1TargetElem = document.getElementById("checkout1-target");
  const checkout1StatusElem = document.getElementById("checkout1-status");
  const checkout1WrapElem = document.getElementById("checkout1-countdown-wrap");

  const fulltimeTargetElem = document.getElementById("fulltime-target");
  const fulltimeStatusElem = document.getElementById("fulltime-status");
  const fulltimeWrapElem = document.getElementById("fulltime-countdown-wrap");

  const todayProgressElem = document.getElementById("today-progress");
  const ptMarkerElem = document.getElementById("pt-marker");
  const workedInfoElem = document.getElementById("worked-info");
  const cycleLabelElem = document.getElementById("cycle-label");
  const freshnessElem = document.getElementById("freshness");
  const cycleBalanceElem = document.getElementById("cycle-balance");
  const historyElem = document.getElementById("history-strip");

  const tabAttendanceBtn = document.getElementById("tab-attendance");
  const tabCalendarBtn = document.getElementById("tab-calendar");
  const viewAttendanceElem = document.getElementById("view-attendance");
  const viewCalendarElem = document.getElementById("view-calendar");
  const calendarGridElem = document.getElementById("calendar-grid");
  const calendarLabelElem = document.getElementById("calendar-label");
  const calendarNoteElem = document.getElementById("calendar-note");
  const calendarPrevBtn = document.getElementById("cal-prev");
  const calendarNextBtn = document.getElementById("cal-next");

  const refreshBtn = document.getElementById("refreshBtn");
  const themeBtn = document.getElementById("themeBtn");
  const optionsBtn = document.getElementById("optionsBtn");
  const loginAlertElem = document.getElementById("login-alert");
  const alertTextElem = document.getElementById("alert-text");
  const langBtn = document.getElementById("langBtn");

  function loginAlertMarkup() {
    const link =
      '<a class="alert-link" href="https://people.zoho.com/" target="_blank" rel="noreferrer">Zoho People</a>';
    return translate("loginPrompt", { link });
  }

  let policy = DEFAULT_POLICY;
  // A year back is as far as the arrows go: further than that the cycle has
  // long been closed, and every unseen month costs a request to Zoho.
  const MIN_CALENDAR_OFFSET = -12;
  let calendarOffset = 0;
  let calendarDays = [];
  let knownMonths = new Set();
  const archiveRequests = new Set();
  const archiveFailures = new Map();
  let timerInterval = null;
  let activeDayEntries = null;
  let activeCheckinDate = null;
  let activeCheckout1Date = null;
  let activeFulltimeDate = null;

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(diffMs) {
    if (diffMs <= 0) return "00:00:00";
    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function getTimerState(targetDate) {
    if (!targetDate) {
      return { text: "--:--:--", stateClass: "time-active" };
    }

    const diffMs = targetDate.getTime() - Date.now();
    const isLate = isPastLateThreshold(targetDate, activeCheckinDate, policy);

    if (diffMs <= 0) {
      const overSecs = Math.floor(Math.abs(diffMs) / 1000);
      const overHours = Math.floor(overSecs / 3600);
      const overMins = Math.floor((overSecs % 3600) / 60);

      const overText =
        overHours > 0 || overMins > 0
          ? translate("completedOver", { h: overHours, m: overMins })
          : translate("completed");

      return {
        text: overText,
        stateClass: isLate ? "time-late" : "time-completed",
      };
    }

    return {
      text: translate("timeLeft", { t: formatDuration(diffMs) }),
      stateClass: isLate ? "time-late" : "time-active",
    };
  }

  function renderCheckboxes(containerId, count, totalSlots, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const { isWarning = false, records = [] } = options;
    const slotsToShow = Math.max(totalSlots, count);

    for (let i = 0; i < slotsToShow; i++) {
      const slot = document.createElement("div");
      slot.className = "cb-slot";

      if (i < count) {
        if (i >= totalSlots) {
          slot.classList.add("over");
        } else {
          slot.classList.add(isWarning ? "warning" : "checked");
        }
        slot.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
        if (records[i]) {
          const { label, hours, note } = records[i];
          slot.title = [label, hours === undefined ? null : `${hours}h`, note]
            .filter(Boolean)
            .join(" · ");
        }
      }
      container.appendChild(slot);
    }

    // Over the quota reads as an error, exactly at it as a caution, and the
    // violation rows are already an error at any non-zero count.
    const pill = document.createElement("span");
    pill.className = "count-pill";
    if (count > totalSlots || (isWarning && count > 0)) {
      pill.classList.add("alert");
    } else if (count > 0) {
      pill.classList.add(count === totalSlots ? "warn" : "active");
    }
    pill.textContent = `${count}/${totalSlots}`;
    container.appendChild(pill);
  }

  // The side-by-side the worked-hours model has to earn its trust with: while
  // targetMode is "offset" this line is purely informational, and turning red
  // is the signal that Zoho's entries do not mean what the offset model
  // assumes (usually: breaks are not recorded as separate sessions).
  function renderWorkedInfo() {
    if (!activeDayEntries) {
      workedInfoElem.textContent = "";
      workedInfoElem.className = "worked-info";
      workedInfoElem.title = "";
      return;
    }

    const workedTargets = computeWorkedTargets(
      activeDayEntries,
      new Date(),
      policy,
    );
    if (!workedTargets) {
      workedInfoElem.textContent = "";
      workedInfoElem.className = "worked-info";
      return;
    }

    const workedMinutes = Math.floor(workedTargets.workedMs / 60000);
    let text = translate("workedLine", {
      h: Math.floor(workedMinutes / 60),
      m: pad(workedMinutes % 60),
    });
    text += workedTargets.isOpen
      ? translate("workedFullAt", { t: formatTime(workedTargets.fullTime) })
      : translate("workedCheckedOut");

    const divergesFromSchedule =
      policy.targetMode === "offset" &&
      workedTargets.isOpen &&
      activeFulltimeDate &&
      Math.abs(
        workedTargets.fullTime.getTime() - activeFulltimeDate.getTime(),
      ) >
        10 * 60 * 1000;

    workedInfoElem.textContent = text;
    workedInfoElem.className = divergesFromSchedule
      ? "worked-info diverges"
      : "worked-info";
    workedInfoElem.title = divergesFromSchedule
      ? translate("divergeTooltip")
      : "";
  }

  function updateLiveTimers() {
    renderWorkedInfo();

    const co1State = getTimerState(activeCheckout1Date);
    checkout1StatusElem.textContent = co1State.text;
    checkout1WrapElem.className = `live-countdown ${co1State.stateClass}`;

    const ftState = getTimerState(activeFulltimeDate);
    fulltimeStatusElem.textContent = ftState.text;
    fulltimeWrapElem.className = `live-countdown ${ftState.stateClass}`;

    const totalDuration =
      activeFulltimeDate.getTime() - activeCheckinDate.getTime();
    if (totalDuration > 0) {
      const elapsed = Date.now() - activeCheckinDate.getTime();
      const progressPercent = Math.min(
        Math.max((elapsed / totalDuration) * 100, 0),
        100,
      );
      todayProgressElem.style.width = `${progressPercent.toFixed(1)}%`;
    }
  }

  function startLiveTimerLoop() {
    stopLiveTimerLoop();
    updateLiveTimers();
    timerInterval = setInterval(updateLiveTimers, 1000);
  }

  function stopLiveTimerLoop() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function showLoginAlert() {
    alertTextElem.innerHTML = loginAlertMarkup();
    loginAlertElem.style.display = "flex";
  }

  function showErrorAlert(message) {
    alertTextElem.textContent = message;
    loginAlertElem.style.display = "flex";
  }

  function hideAlert() {
    loginAlertElem.style.display = "none";
  }

  // "No record today" is ambiguous on its own — it can mean Zoho has not seen
  // the check-in yet, or that we have not reached Zoho for hours. The
  // freshness stamp is what separates the two.
  function renderFreshness(lastSuccessAt) {
    if (!lastSuccessAt) {
      freshnessElem.textContent = translate("neverUpdated");
      freshnessElem.className = "freshness stale";
      return;
    }

    const minutes = Math.floor((Date.now() - lastSuccessAt) / 60000);
    freshnessElem.textContent = translate("updatedAgo", {
      t: formatAgo(minutes),
    });
    freshnessElem.className =
      minutes >= policy.staleAfterMinutes ? "freshness stale" : "freshness";
  }

  function renderHistory(cycleDays) {
    historyElem.innerHTML = "";
    if (cycleDays.length === 0) {
      return;
    }

    const scaleSeconds = Math.max(
      policy.fullDaySeconds,
      ...cycleDays.map((day) => day.tsecs),
    );

    // Ruled like the paper it imitates: dashed lines at the short-day floor
    // and the full day, so every bar reads against the thresholds directly.
    for (const thresholdSeconds of [
      policy.shortDaySeconds,
      policy.fullDaySeconds,
    ]) {
      const bottomPercent = (thresholdSeconds / scaleSeconds) * 100;
      if (bottomPercent >= 98) {
        continue;
      }
      const line = document.createElement("div");
      line.className = "history-refline";
      line.style.bottom = `${bottomPercent.toFixed(1)}%`;
      historyElem.appendChild(line);
    }

    for (const day of cycleDays) {
      const bar = document.createElement("div");
      bar.className = "hbar";
      if (day.tsecs === 0) {
        bar.classList.add("empty");
      } else if (day.tsecs < policy.shortDaySeconds) {
        bar.classList.add("low");
      } else if (day.tsecs < policy.fullDaySeconds) {
        bar.classList.add("short");
      }
      bar.style.height = `${Math.max((day.tsecs / scaleSeconds) * 100, day.tsecs > 0 ? 4 : 2)}%`;
      bar.title = `${day.label} · ${(day.tsecs / 3600).toFixed(1)}h`;
      historyElem.appendChild(bar);
    }
  }

  function setActiveTab(tab) {
    const isCalendar = tab === "calendar";
    viewAttendanceElem.hidden = isCalendar;
    viewCalendarElem.hidden = !isCalendar;
    tabAttendanceBtn.classList.toggle("active", !isCalendar);
    tabCalendarBtn.classList.toggle("active", isCalendar);
  }

  // One request per missing month, ever: the worker caches what it fetches,
  // and a month that fails is not retried on every repaint of the same grid.
  // Why the failure is remembered rather than written straight to the note:
  // any storage change repaints the grid, and a note set here would be
  // overwritten by that repaint with "loading" for a month no longer being
  // fetched — leaving a spinner that never resolves and never explains.
  function requestArchiveMonth(key) {
    if (archiveRequests.has(key)) {
      return;
    }
    const monthsAgo = monthsAgoFor(key, new Date());
    if (monthsAgo < 1) {
      return;
    }
    archiveRequests.add(key);
    chrome.runtime
      .sendMessage({ action: "fetchArchiveMonth", monthsAgo })
      .then((response) => {
        if (response?.status !== "success") {
          archiveFailures.set(
            key,
            response?.message || translate("calFetchFailed"),
          );
          renderCalendar();
        }
      })
      .catch(() => {
        archiveFailures.set(key, translate("calFetchFailed"));
        renderCalendar();
      });
  }

  // Clears the "asked once" bookkeeping so the visible cycle is tried again.
  function retryArchive() {
    archiveRequests.clear();
    archiveFailures.clear();
  }

  // The whole cycle as a grid, straight from the cached dayList — future days
  // of the current month are already in the payload. Statuses beyond the ones
  // the quota logic understands are surfaced verbatim in the tooltip rather
  // than guessed at.
  function renderCalendar() {
    const { start, end } = getCycleAt(new Date(), policy, calendarOffset);
    calendarLabelElem.textContent = `${start.getDate()} ${monthNames(activeLang)[start.getMonth()]} - ${end.getDate()} ${monthNames(activeLang)[end.getMonth()]}`;
    calendarPrevBtn.disabled = calendarOffset <= MIN_CALENDAR_OFFSET;
    calendarNextBtn.disabled = calendarOffset >= 0;

    // A cycle the rolling two-month window never covered has to be fetched
    // before it can be drawn. The grid renders empty meanwhile and repaints
    // itself when the worker lands the month. A month in the future is not
    // missing — nothing has happened in it yet — and asking Zoho for one is
    // meaningless, so it must not read as perpetually loading either: from
    // the 21st onward the current cycle always reaches into next month.
    const today = new Date();
    const cycleMonths = monthKeysInRange(start, end);
    const fetchable = cycleMonths.filter(
      (key) => !knownMonths.has(key) && monthsAgoFor(key, today) >= 1,
    );
    fetchable.forEach(requestArchiveMonth);
    const failedMonth = cycleMonths.find((key) => archiveFailures.has(key));
    calendarNoteElem.textContent = failedMonth
      ? archiveFailures.get(failedMonth)
      : fetchable.length > 0
        ? translate("calFetching")
        : "";

    const dayByKey = new Map();
    calendarDays.forEach((day) => {
      const date = parseZohoTimestamp(day.orgdate);
      if (date && date >= start && date <= end) {
        dayByKey.set(toLocalDateKey(date), day);
      }
    });

    calendarGridElem.innerHTML = "";
    const todayKey = toLocalDateKey(new Date());

    const mondayFirstOffset = (start.getDay() + 6) % 7;
    for (let blank = 0; blank < mondayFirstOffset; blank++) {
      const spacer = document.createElement("div");
      spacer.className = "cal-cell spacer";
      calendarGridElem.appendChild(spacer);
    }

    for (
      const cursor = new Date(start);
      cursor <= end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const key = toLocalDateKey(cursor);
      const day = dayByKey.get(key);
      const isFuture = key > todayKey;

      const cell = document.createElement("div");
      cell.className = "cal-cell";
      cell.textContent = cursor.getDate();
      let title = formatDayLabel(cursor);

      if (day) {
        const tsecs = Number(day.tsecs) || 0;
        if (Number(day.leaveDaysTaken) > 0) {
          cell.classList.add("leave");
        } else if ((day.status || "").trim() === "Absent") {
          cell.classList.add("absent");
        } else if (tsecs >= policy.fullDaySeconds) {
          cell.classList.add("full");
        } else if (tsecs >= policy.shortDaySeconds) {
          cell.classList.add("short");
        } else if (tsecs > 0) {
          cell.classList.add("low");
        } else {
          // A labelled day off is not the same thing as a working day with
          // nothing recorded against it, and only one of the two is a
          // problem. An unrecognised status leaves the cell exactly as it
          // rendered before this existed.
          cell.classList.add(
            classifyNonWorkingDay(day, policy) ||
              (isFuture ? "future" : "off"),
          );
        }
        if (tsecs > 0) {
          title += ` · ${(tsecs / 3600).toFixed(1)}h`;
        }
        const statusText = (day.status || "").trim();
        if (statusText) {
          title += ` · ${statusText}`;
        }
        // A request takes the whole cell: it outranks the hours bucket,
        // because a day that needed one is the thing worth spotting in the
        // grid. The hours are still in the tooltip, with whatever the request
        // itself says.
        if (hasAttendanceRequest(day)) {
          cell.classList.add("request");
          title += ` · ${translate("calRequest")}`;
          const detail = describeAttendanceRequest(day);
          if (detail) {
            title += ` (${detail})`;
          }
        }
      } else {
        cell.classList.add(isFuture ? "future" : "off");
        title += ` · ${translate("calNoData")}`;
      }

      if (key === todayKey) {
        cell.classList.add("today");
      }
      cell.title = title;
      calendarGridElem.appendChild(cell);
    }
  }

  function renderCycleUsage(dayList) {
    const { start, end } = getCurrentCycle(new Date(), policy);
    cycleLabelElem.textContent = `${start.getDate()} ${monthNames(activeLang)[start.getMonth()]} - ${end.getDate()} ${monthNames(activeLang)[end.getMonth()]}`;

    const days6To8Hours = [];
    const daysBelow6Hours = [];
    const requestDays = [];
    const cycleDays = [];
    let leaveUsed = 0;
    let absentCount = 0;
    let workedSeconds = 0;
    let workedDays = 0;

    Object.values(dayList).forEach((day) => {
      const dayDate = parseZohoTimestamp(day.orgdate);
      if (!dayDate || dayDate < start || dayDate > end) {
        return;
      }

      const tsecs = Number(day.tsecs) || 0;
      const label = formatDayLabel(dayDate);
      const record = { label, hours: (tsecs / 3600).toFixed(1) };

      cycleDays.push({ label, tsecs });

      if (tsecs > 0) {
        workedSeconds += tsecs;
        workedDays++;
        if (tsecs < policy.shortDaySeconds) {
          daysBelow6Hours.push(record);
        } else if (tsecs < policy.fullDaySeconds) {
          days6To8Hours.push(record);
        }
      }

      if (hasAttendanceRequest(day)) {
        requestDays.push({ label, note: describeAttendanceRequest(day) });
      }
      leaveUsed += Number(day.leaveDaysTaken) || 0;
      if ((day.status || "").trim() === "Absent") {
        absentCount++;
      }
    });

    renderCheckboxes(
      "cb-6-8-hours",
      days6To8Hours.length,
      policy.shortDayQuota,
      {
        records: days6To8Hours,
      },
    );
    document.getElementById("below-8-hours-details").textContent =
      days6To8Hours.length > 0
        ? days6To8Hours.map((r) => `${r.hours}h`).join(", ")
        : translate("noRecords");

    renderCheckboxes("cb-requests", requestDays.length, policy.requestQuota, {
      records: requestDays,
    });
    document.getElementById("no-attendance-details").textContent =
      requestDays.length > 0
        ? requestDays.map((request) => request.label).join(", ")
        : translate("none");

    renderCheckboxes(
      "cb-below-6-hours",
      daysBelow6Hours.length,
      policy.violationQuota,
      {
        isWarning: true,
        records: daysBelow6Hours,
      },
    );
    document.getElementById("below-6-hours-details").textContent =
      daysBelow6Hours.length > 0
        ? daysBelow6Hours.map((r) => `${r.hours}h`).join(", ")
        : translate("none");

    document.getElementById("leave-used").textContent = `${leaveUsed}d`;
    document.getElementById("absent-count").textContent = `${absentCount}d`;

    // Measured only against days that actually have a record, so days off and
    // not-yet-worked days never count as a deficit.
    const balanceSeconds = workedSeconds - workedDays * policy.fullDaySeconds;
    cycleBalanceElem.textContent =
      workedDays === 0 ? "—" : formatSignedHours(balanceSeconds);
    cycleBalanceElem.className = `stat-val${workedDays > 0 && balanceSeconds < 0 ? " stat-negative" : ""}`;
    cycleBalanceElem.title =
      workedDays === 0
        ? ""
        : `${(workedSeconds / 3600).toFixed(1)}h across ${workedDays} recorded days`;

    renderHistory(cycleDays);
  }

  function clearTodayTimeline(checkinLabel) {
    stopLiveTimerLoop();
    activeDayEntries = null;
    renderWorkedInfo();
    activeCheckinDate = null;
    activeCheckout1Date = null;
    activeFulltimeDate = null;

    checkinTimeElem.textContent = checkinLabel;
    checkout1TargetElem.textContent = "--:--";
    fulltimeTargetElem.textContent = "--:--";
    checkout1StatusElem.textContent = translate("pending");
    fulltimeStatusElem.textContent = translate("pending");
    checkout1WrapElem.className = "live-countdown time-active";
    fulltimeWrapElem.className = "live-countdown time-active";
    todayProgressElem.style.width = "0%";
    ptMarkerElem.style.display = "none";
  }

  function renderTodayTimeline(attendanceData) {
    const active = findActiveCheckin(attendanceData, new Date(), policy);
    if (!active) {
      clearTodayTimeline(translate("noRecordToday"));
      return;
    }

    const targets = computeEffectiveTargets(
      attendanceData,
      active,
      new Date(),
      policy,
    );
    activeDayEntries =
      attendanceData.entries?.[toLocalDateKey(active.checkin)] || null;
    activeCheckinDate = active.checkin;
    activeCheckout1Date = targets.partTime;
    activeFulltimeDate = targets.fullTime;

    checkinTimeElem.textContent = active.isFromYesterday
      ? translate("yesterdayAt", { t: formatTime(activeCheckinDate) })
      : formatTime(activeCheckinDate);
    checkout1TargetElem.textContent = formatTime(activeCheckout1Date);
    fulltimeTargetElem.textContent = formatTime(activeFulltimeDate);

    const spanMs = activeFulltimeDate.getTime() - activeCheckinDate.getTime();
    const partFraction =
      (activeCheckout1Date.getTime() - activeCheckinDate.getTime()) / spanMs;
    ptMarkerElem.style.left = `${(partFraction * 100).toFixed(1)}%`;
    ptMarkerElem.style.display = "block";

    startLiveTimerLoop();
  }

  let autoRefreshRequested = false;

  // Stale-while-revalidate: the popup paints from cache instantly, then asks
  // the worker for fresh data once per open; the storage listener repaints
  // when the answer lands, success or failure.
  function requestBackgroundRefresh(csrfToken, lastSuccessAt) {
    if (autoRefreshRequested || !csrfToken) {
      return;
    }
    if (lastSuccessAt && Date.now() - lastSuccessAt < AUTO_REFRESH_AFTER_MS) {
      return;
    }
    autoRefreshRequested = true;
    chrome.runtime.sendMessage({ action: "updateAttendance" }).catch(() => {});
  }

  async function updateAttendanceDisplay() {
    const {
      csrfToken,
      attendanceData,
      archivedMonths,
      lastSuccessAt,
      lastError,
    } = await chrome.storage.local.get([
      "csrfToken",
      "attendanceData",
      "archivedMonths",
      "lastSuccessAt",
      "lastError",
    ]);

    renderFreshness(lastSuccessAt);
    requestBackgroundRefresh(csrfToken, lastSuccessAt);

    if (!csrfToken) {
      showLoginAlert();
    } else if (lastError && (!lastSuccessAt || lastError.at > lastSuccessAt)) {
      showErrorAlert(lastError.message);
    } else {
      hideAlert();
    }

    if (!attendanceData) {
      clearTodayTimeline(translate("noDataFound"));
      return;
    }

    if (attendanceData.dayList) {
      renderCycleUsage(attendanceData.dayList);
      // Quotas stay on the current cycle - they are about what is left to
      // spend now - while the calendar can be walked back through archived
      // months, so the two read from different day sets on purpose.
      calendarDays = [
        ...Object.values(archivedMonths || {}).flatMap((month) =>
          Object.values(month.dayList || {}),
        ),
        ...Object.values(attendanceData.dayList),
      ];
      // Which months are covered is known exactly, not inferred from which
      // days happen to be present: the worker's rolling window is always this
      // month and last month, and anything else was archived whole. Inferring
      // it from the data would read a month that merely overlaps the cycle as
      // a month already fetched, and quietly draw the missing half empty.
      const today = new Date();
      knownMonths = new Set([
        monthKey(today),
        monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        ...Object.keys(archivedMonths || {}),
      ]);
      renderCalendar();
    }
    renderTodayTimeline(attendanceData);
  }

  async function init() {
    policy = await readPolicy();
    const { activeTab, theme, scheme, customScheme, lang } =
      await chrome.storage.local.get([
        "activeTab",
        "theme",
        "scheme",
        "customScheme",
        "lang",
      ]);
    setActiveTab(activeTab === "calendar" ? "calendar" : "attendance");
    activeSchemeId = scheme || "gruvbox";
    activeCustomScheme = customScheme || null;
    applyAppearance(
      theme === "dark" || theme === "light" ? theme : resolveSystemTheme(),
    );
    applyLanguage(lang);
    await updateAttendanceDisplay();
  }

  init();

  // Repaints when the worker lands fresh data (or a policy/theme change from
  // the options page) while the popup is open, so the refresh button is never
  // required for the display to catch up.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    if (changes.theme?.newValue) {
      applyAppearance(changes.theme.newValue);
    }
    if (changes.scheme || changes.customScheme) {
      activeSchemeId = changes.scheme?.newValue ?? activeSchemeId;
      activeCustomScheme = changes.customScheme?.newValue ?? activeCustomScheme;
      applyAppearance(document.documentElement.dataset.theme);
    }
    if (changes.lang) {
      applyLanguage(changes.lang.newValue);
      updateAttendanceDisplay();
      return;
    }
    if (changes.policy) {
      readPolicy().then((freshPolicy) => {
        policy = freshPolicy;
        updateAttendanceDisplay();
      });
      return;
    }
    if (
      changes.attendanceData ||
      changes.archivedMonths ||
      changes.lastSuccessAt ||
      changes.lastError
    ) {
      updateAttendanceDisplay();
    }
  });

  function stepCalendar(step) {
    const next = Math.min(0, Math.max(MIN_CALENDAR_OFFSET, calendarOffset + step));
    if (next === calendarOffset) {
      return;
    }
    calendarOffset = next;
    renderCalendar();
  }

  calendarPrevBtn.addEventListener("click", () => stepCalendar(-1));
  calendarNextBtn.addEventListener("click", () => stepCalendar(1));

  tabAttendanceBtn.addEventListener("click", () => {
    setActiveTab("attendance");
    chrome.storage.local.set({ activeTab: "attendance" });
  });
  tabCalendarBtn.addEventListener("click", () => {
    setActiveTab("calendar");
    chrome.storage.local.set({ activeTab: "calendar" });
  });

  themeBtn.addEventListener("click", toggleTheme);

  langBtn.addEventListener("click", () => {
    const next = activeLang === "en" ? "vi" : "en";
    applyLanguage(next);
    chrome.storage.local.set({ lang: next });
    updateAttendanceDisplay();
  });

  optionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  refreshBtn.addEventListener("click", async function () {
    refreshBtn.classList.add("spinning");
    // Refresh means "try again" for whatever the calendar is showing too, or
    // a month that failed once would stay failed for the life of the popup.
    retryArchive();

    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateAttendance",
      });
      if (response.status === "success") {
        await updateAttendanceDisplay();
      } else {
        showErrorAlert(translate("refreshFailed", { msg: response.message }));
      }
    } catch (error) {
      showErrorAlert(translate("refreshFailed", { msg: error.message }));
    } finally {
      refreshBtn.classList.remove("spinning");
    }
  });
});
