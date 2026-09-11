import type {
  ComponentChildren,
  TargetedEvent,
  TargetedInputEvent,
  VNode,
} from "preact";

type FieldProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ComponentChildren;
};

/** One label/hint/control row. */
export function Field({ label, hint, htmlFor, children }: FieldProps): VNode {
  return (
    <div class="flex items-center justify-between gap-4 border-b border-rule py-[9px]">
      <label class="text-ink-2" for={htmlFor}>
        {label}
        {hint ? <span class="block text-[11px] text-ink-faint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

type FieldsetProps = {
  legend: string;
  children: ComponentChildren;
};

/** A titled group of rows. */
export function Fieldset({ legend, children }: FieldsetProps): VNode {
  return (
    <fieldset class="mt-[26px] border-none">
      <legend class="w-full border-b border-rule-strong pb-2 text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

const CONTROL: string =
  "rounded-[3px] border border-rule-strong bg-panel px-2 py-[5px] text-right font-num text-[13px] tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

type NumberInputProps = {
  id: string;
  value: string;
  step: string;
  min: string;
  max: string;
  onValue: (value: string) => void;
};

export function NumberInput({ id, value, step, min, max, onValue }: NumberInputProps): VNode {
  return (
    <input
      id={id}
      type="number"
      class={`${CONTROL} w-[110px]`}
      value={value}
      step={step}
      min={min}
      max={max}
      onInput={(event: TargetedInputEvent<HTMLInputElement>): void =>
        onValue(event.currentTarget.value)
      }
    />
  );
}

type TimeInputProps = {
  id: string;
  value: string;
  onValue: (value: string) => void;
};

export function TimeInput({ id, value, onValue }: TimeInputProps): VNode {
  return (
    <input
      id={id}
      type="time"
      class={`${CONTROL} w-[130px]`}
      value={value}
      onInput={(event: TargetedInputEvent<HTMLInputElement>): void =>
        onValue(event.currentTarget.value)
      }
    />
  );
}

type TextInputProps = {
  id: string;
  value: string;
  onValue: (value: string) => void;
};

export function TextInput({ id, value, onValue }: TextInputProps): VNode {
  return (
    <input
      id={id}
      type="text"
      spellcheck={false}
      class={`${CONTROL} w-[240px] text-left`}
      value={value}
      onInput={(event: TargetedInputEvent<HTMLInputElement>): void =>
        onValue(event.currentTarget.value)
      }
    />
  );
}

type SelectProps = {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onValue: (value: string) => void;
};

export function Select({ id, value, options, onValue }: SelectProps): VNode {
  return (
    <select
      id={id}
      class={CONTROL}
      value={value}
      onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void =>
        onValue(event.currentTarget.value)
      }
    >
      {options.map(
        (option: { value: string; label: string }): VNode => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  );
}
