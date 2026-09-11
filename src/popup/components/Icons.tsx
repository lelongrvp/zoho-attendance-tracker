import type { VNode } from "preact";

type IconProps = { className?: string };

export function MarkIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="3.5" class="fill-ink" />
      <rect x="5.6" y="5.6" width="5" height="5" rx="1" class="fill-paper" />
      <rect
        x="13.4"
        y="5.6"
        width="5"
        height="5"
        rx="1"
        class="fill-paper opacity-[0.38]"
      />
      <rect
        x="5.6"
        y="13.4"
        width="5"
        height="5"
        rx="1"
        class="fill-paper opacity-[0.38]"
      />
      <rect x="13.4" y="13.4" width="5" height="5" rx="1" class="fill-paper" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.2.63.77 1.08 1.43 1.15H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.85z" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <polyline points="20.5 4 20.5 9.5 15 9.5" />
    </svg>
  );
}

export function WarningIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps): VNode {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export type ChevronDirection = "left" | "right";

export function ChevronIcon({
  className,
  direction,
}: IconProps & { direction: ChevronDirection }): VNode {
  const points: string =
    direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points={points} />
    </svg>
  );
}
