import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type {
  ArchivedMonth,
  Policy,
  Scheme,
  StatusCount,
  StorageShape,
  TargetMode,
  ZohoDay,
} from "../lib/types.ts";
import {
  DEFAULT_PORTAL_ID,
  collectStatuses,
  readPolicy,
} from "../lib/policy.ts";
import { applyTokens, listSchemes, resolveTokens } from "../lib/themes.ts";
import { read, remove, write } from "../lib/storage.ts";
import type { FormResult, FormState, HourField, PlainField, TimeField } from "./form.ts";
import { formToPolicy, pageMode, policyToForm } from "./form.ts";
import { Field, Fieldset, NumberInput, Select, TextInput, TimeInput } from "./components/Field.tsx";
import { CustomScheme } from "./components/CustomScheme.tsx";
import { StatusesSeen } from "./components/StatusesSeen.tsx";

type Status = { text: string; isError: boolean };

const SCHEME_OPTIONS: { value: string; label: string }[] = [
  ...listSchemes().map(
    (scheme: { id: string; name: string }): { value: string; label: string } => ({
      value: scheme.id,
      label: scheme.name,
    }),
  ),
  { value: "custom", label: "Custom" },
];

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: "offset", label: "Check-in + fixed offset" },
  { value: "worked", label: "Hours actually worked" },
];

export function App(): JSX.Element {
  const [form, setForm] = useState<FormState | null>(null);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect((): void => {
    void load();
  }, []);

  async function load(): Promise<void> {
    const policy: Policy = await readPolicy();
    const stored: Partial<StorageShape> = await read([
      "portalId",
      "scheme",
      "customScheme",
      "attendanceData",
      "archivedMonths",
    ]);
    const next: FormState = policyToForm(
      policy,
      stored.portalId ?? DEFAULT_PORTAL_ID,
      stored.scheme ?? "gruvbox",
      stored.customScheme,
    );
    setForm(next);
    preview(next.scheme, next.customScheme);

    const days: ZohoDay[] = [
      ...Object.values(stored.attendanceData?.dayList ?? {}),
      ...Object.values(stored.archivedMonths ?? {}).flatMap(
        (month: ArchivedMonth): ZohoDay[] => Object.values(month.dayList ?? {}),
      ),
    ];
    setStatuses(collectStatuses(days));
  }

  function preview(scheme: string, customScheme: Scheme): void {
    applyTokens(
      document.documentElement,
      resolveTokens(scheme, pageMode(), customScheme),
    );
  }

  function update(patch: Partial<FormState>): void {
    setForm((current: FormState | null): FormState | null =>
      current ? { ...current, ...patch } : current,
    );
  }

  function setNumber(key: PlainField | HourField, value: string): void {
    setForm((current: FormState | null): FormState | null =>
      current
        ? { ...current, numbers: { ...current.numbers, [key]: value } }
        : current,
    );
  }

  function setTime(key: TimeField, value: string): void {
    setForm((current: FormState | null): FormState | null =>
      current ? { ...current, times: { ...current.times, [key]: value } } : current,
    );
  }

  function changeScheme(scheme: string): void {
    if (!form) return;
    update({ scheme });
    preview(scheme, form.customScheme);
  }

  function changeCustomScheme(customScheme: Scheme): void {
    if (!form) return;
    update({ customScheme });
    if (form.scheme === "custom") {
      preview("custom", customScheme);
    }
  }

  async function save(): Promise<void> {
    if (!form) return;
    const result: FormResult = formToPolicy(form);
    if (!result.ok) {
      setStatus({ text: result.message, isError: true });
      return;
    }

    const portalId: string = form.portalId.trim();
    await write({
      policy: result.policy,
      scheme: form.scheme,
      customScheme: form.customScheme,
    });
    if (portalId && portalId !== DEFAULT_PORTAL_ID) {
      await write({ portalId });
    } else {
      await remove("portalId");
    }
    preview(form.scheme, form.customScheme);
    setStatus({ text: "Saved", isError: false });
  }

  async function reset(): Promise<void> {
    await remove(["policy", "portalId", "scheme", "customScheme"]);
    await load();
    setStatus({ text: "Defaults restored", isError: false });
  }

  if (!form) {
    return <main class="mx-auto max-w-[560px]" />;
  }

  return (
    <main class="mx-auto max-w-[560px]">
      <h1 class="border-b border-ink pb-3 text-[18px] font-semibold tracking-[-0.01em]">
        Attendance Tracker settings
      </h1>
      <p class="mt-[10px] text-[12.5px] text-ink-3">
        Everything here also works as a console override — these fields read and
        write the same <code class="font-num">policy</code> and{" "}
        <code class="font-num">portalId</code> keys in extension storage. Blank
        the portal field or press Reset to fall back to the built-in defaults.
      </p>

      <Fieldset legend="Appearance">
        <Field
          label="Colorscheme"
          hint="applies to both light and dark mode; the popup's moon/sun button still picks which side you see"
          htmlFor="scheme-select"
        >
          <Select
            id="scheme-select"
            value={form.scheme}
            options={SCHEME_OPTIONS}
            onValue={changeScheme}
          />
        </Field>
        {form.scheme === "custom" ? (
          <CustomScheme scheme={form.customScheme} onChange={changeCustomScheme} />
        ) : null}
      </Fieldset>

      <Fieldset legend="Zoho portal">
        <Field
          label="Portal id"
          hint="the hrportal… segment of your Zoho People URL"
          htmlFor="portal-id"
        >
          <TextInput
            id="portal-id"
            value={form.portalId}
            onValue={(portalId: string): void => update({ portalId })}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Day statuses">
        <Field
          label="Holiday keywords"
          hint="comma-separated, matched anywhere in the day's status, case insensitive"
          htmlFor="holiday-statuses"
        >
          <TextInput
            id="holiday-statuses"
            value={form.holidayStatuses}
            onValue={(holidayStatuses: string): void => update({ holidayStatuses })}
          />
        </Field>
        <Field
          label="Weekend keywords"
          hint="days off that need no explanation, kept apart from a working day with nothing recorded"
          htmlFor="weekend-statuses"
        >
          <TextInput
            id="weekend-statuses"
            value={form.weekendStatuses}
            onValue={(weekendStatuses: string): void => update({ weekendStatuses })}
          />
        </Field>
        <Field
          label="Statuses in your cached data"
          hint="what this portal actually sends - match the keywords above to these"
        >
          <StatusesSeen statuses={statuses} />
        </Field>
      </Fieldset>

      <Fieldset legend="Day targets">
        <Field label="Part-time target, normal start" hint="hours after check-in" htmlFor="earlyPartTimeHours">
          <NumberInput
            id="earlyPartTimeHours"
            value={form.numbers.earlyPartTimeHours}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("earlyPartTimeHours", value)}
          />
        </Field>
        <Field label="Full-time target, normal start" hint="hours after check-in" htmlFor="earlyFullTimeHours">
          <NumberInput
            id="earlyFullTimeHours"
            value={form.numbers.earlyFullTimeHours}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("earlyFullTimeHours", value)}
          />
        </Field>
        <Field label="Part-time target, late start" htmlFor="latePartTimeHours">
          <NumberInput
            id="latePartTimeHours"
            value={form.numbers.latePartTimeHours}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("latePartTimeHours", value)}
          />
        </Field>
        <Field label="Full-time target, late start" htmlFor="lateFullTimeHours">
          <NumberInput
            id="lateFullTimeHours"
            value={form.numbers.lateFullTimeHours}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("lateFullTimeHours", value)}
          />
        </Field>
        <Field
          label="Target model"
          hint='switch to worked hours only once the popup&apos;s "Worked …" line has matched reality for a week'
          htmlFor="target-mode"
        >
          <Select
            id="target-mode"
            value={form.targetMode}
            options={TARGET_OPTIONS}
            onValue={(value: string): void =>
              update({ targetMode: value as TargetMode })
            }
          />
        </Field>
        <Field
          label="Late start begins at"
          hint="check-ins from this time use the late targets"
          htmlFor="lateStartAfterMinutes"
        >
          <TimeInput
            id="lateStartAfterMinutes"
            value={form.times.lateStartAfterMinutes}
            onValue={(value: string): void => setTime("lateStartAfterMinutes", value)}
          />
        </Field>
        <Field
          label="Late-evening threshold"
          hint="targets past this time are flagged red"
          htmlFor="lateThresholdMinutes"
        >
          <TimeInput
            id="lateThresholdMinutes"
            value={form.times.lateThresholdMinutes}
            onValue={(value: string): void => setTime("lateThresholdMinutes", value)}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Cycle & quotas">
        <Field label="Cycle starts on day" htmlFor="cycleStartDay">
          <NumberInput
            id="cycleStartDay"
            value={form.numbers.cycleStartDay}
            step="1"
            min="1"
            max="28"
            onValue={(value: string): void => setNumber("cycleStartDay", value)}
          />
        </Field>
        <Field label="Full day" hint="hours worked" htmlFor="fullDaySeconds">
          <NumberInput
            id="fullDaySeconds"
            value={form.numbers.fullDaySeconds}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("fullDaySeconds", value)}
          />
        </Field>
        <Field label="Short-day floor" hint="hours worked" htmlFor="shortDaySeconds">
          <NumberInput
            id="shortDaySeconds"
            value={form.numbers.shortDaySeconds}
            step="0.25"
            min="1"
            max="16"
            onValue={(value: string): void => setNumber("shortDaySeconds", value)}
          />
        </Field>
        <Field label="Short days allowed per cycle" htmlFor="shortDayQuota">
          <NumberInput
            id="shortDayQuota"
            value={form.numbers.shortDayQuota}
            step="1"
            min="0"
            max="31"
            onValue={(value: string): void => setNumber("shortDayQuota", value)}
          />
        </Field>
        <Field label="Attendance requests allowed" htmlFor="requestQuota">
          <NumberInput
            id="requestQuota"
            value={form.numbers.requestQuota}
            step="1"
            min="0"
            max="31"
            onValue={(value: string): void => setNumber("requestQuota", value)}
          />
        </Field>
        <Field label="Sub-floor days shown as quota" htmlFor="violationQuota">
          <NumberInput
            id="violationQuota"
            value={form.numbers.violationQuota}
            step="1"
            min="0"
            max="31"
            onValue={(value: string): void => setNumber("violationQuota", value)}
          />
        </Field>
        <Field label="Data counts as stale after" hint="minutes" htmlFor="staleAfterMinutes">
          <NumberInput
            id="staleAfterMinutes"
            value={form.numbers.staleAfterMinutes}
            step="5"
            min="5"
            max="720"
            onValue={(value: string): void => setNumber("staleAfterMinutes", value)}
          />
        </Field>
      </Fieldset>

      <div class="mt-7 flex items-center gap-[10px]">
        <button
          id="save"
          type="button"
          class="cursor-pointer rounded-[3px] border border-ink bg-ink px-[18px] py-2 text-[12.5px] font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={(): void => void save()}
        >
          Save
        </button>
        <button
          id="reset"
          type="button"
          class="cursor-pointer rounded-[3px] border border-rule-strong bg-transparent px-[18px] py-2 text-[12.5px] font-semibold text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={(): void => void reset()}
        >
          Reset to defaults
        </button>
        <span
          id="status"
          class={`font-num text-[11px] ${status?.isError ? "text-stamp-text" : "text-moss"}`}
        >
          {status?.text ?? ""}
        </span>
      </div>
    </main>
  );
}
