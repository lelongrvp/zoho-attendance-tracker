import type {
  BadgeColors,
  DerivedColors,
  Scheme,
  SchemeColors,
  ThemeMode,
  Tokens,
} from "./types.ts";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value: string = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex([red, green, blue]: Rgb): string {
  const channel = (component: number): string =>
    Math.round(Math.min(255, Math.max(0, component)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function blend(fromHex: string, toHex: string, amount: number): string {
  const [fromRed, fromGreen, fromBlue] = hexToRgb(fromHex);
  const [toRed, toGreen, toBlue] = hexToRgb(toHex);
  const mix = (from: number, to: number): number => from + (to - from) * amount;
  return rgbToHex([
    mix(fromRed, toRed),
    mix(fromGreen, toGreen),
    mix(fromBlue, toBlue),
  ]);
}

export const SCHEMES = {
  gruvbox: {
    name: "Gruvbox",
    light: {
      paper: "#fbf1c7",
      panel: "#f9f5d7",
      ink: "#3c3836",
      stamp: "#cc241d",
      moss: "#79740e",
      amber: "#d79921",
      ink2: "#504945",
      ink3: "#665c54",
      inkFaint: "#a89984",
      rule: "#ebdbb2",
      ruleStrong: "#d5c4a1",
      wash: "#f2e5bc",
      stampTint: "#f1d9b4",
      stampLine: "#e3b597",
      stampText: "#9d0006",
    },
    dark: {
      paper: "#282828",
      panel: "#32302f",
      ink: "#ebdbb2",
      stamp: "#fb4934",
      moss: "#b8bb26",
      amber: "#fabd2f",
      ink2: "#d5c4a1",
      ink3: "#bdae93",
      inkFaint: "#928374",
      rule: "#3c3836",
      ruleStrong: "#504945",
      wash: "#3c3836",
      stampTint: "#412c29",
      stampLine: "#67322c",
      stampText: "#fb4934",
      onStamp: "#1d2021",
    },
  },
  catppuccin: {
    name: "Catppuccin",
    light: {
      paper: "#e6e9ef",
      panel: "#eff1f5",
      ink: "#4c4f69",
      stamp: "#d20f39",
      moss: "#40a02b",
      amber: "#df8e1d",
    },
    dark: {
      paper: "#181825",
      panel: "#1e1e2e",
      ink: "#cdd6f4",
      stamp: "#f38ba8",
      moss: "#a6e3a1",
      amber: "#f9e2af",
    },
  },
  nord: {
    name: "Nord",
    light: {
      paper: "#e5e9f0",
      panel: "#eceff4",
      ink: "#2e3440",
      stamp: "#bf616a",
      moss: "#687966",
      amber: "#ebcb8b",
    },
    dark: {
      paper: "#2e3440",
      panel: "#3b4252",
      ink: "#eceff4",
      stamp: "#bf616a",
      moss: "#a3be8c",
      amber: "#ebcb8b",
    },
  },
  dracula: {
    name: "Dracula",
    light: {
      paper: "#f8f8f2",
      panel: "#ffffff",
      ink: "#282a36",
      stamp: "#cb3a2a",
      moss: "#237a34",
      amber: "#ffb86c",
    },
    dark: {
      paper: "#282a36",
      panel: "#333549",
      ink: "#f8f8f2",
      stamp: "#ff5555",
      moss: "#50fa7b",
      amber: "#f1fa8c",
    },
  },
  solarized: {
    name: "Solarized",
    light: {
      paper: "#fdf6e3",
      panel: "#eee8d5",
      ink: "#073642",
      stamp: "#dc322f",
      moss: "#667500",
      amber: "#b58900",
    },
    dark: {
      paper: "#002b36",
      panel: "#073642",
      ink: "#eee8d5",
      stamp: "#dc322f",
      moss: "#859900",
      amber: "#b58900",
    },
  },
  "tokyo-night": {
    name: "Tokyo Night",
    light: {
      paper: "#e1e2e7",
      panel: "#e9e9ec",
      ink: "#343b58",
      stamp: "#f52a65",
      moss: "#587539",
      amber: "#8c6c3e",
    },
    dark: {
      paper: "#1a1b26",
      panel: "#24283b",
      ink: "#c0caf5",
      stamp: "#f7768e",
      moss: "#9ece6a",
      amber: "#e0af68",
    },
  },
  everforest: {
    name: "Everforest",
    light: {
      paper: "#f3ead3",
      panel: "#fdf6e3",
      ink: "#5c6a72",
      stamp: "#f85552",
      moss: "#8da101",
      amber: "#dfa000",
    },
    dark: {
      paper: "#2d353b",
      panel: "#343f44",
      ink: "#d3c6aa",
      stamp: "#e67e80",
      moss: "#a7c080",
      amber: "#dbbc7f",
    },
  },
  "rose-pine": {
    name: "Rosé Pine",
    light: {
      paper: "#faf4ed",
      panel: "#fffaf3",
      ink: "#575279",
      stamp: "#b4637a",
      moss: "#286983",
      amber: "#ea9d34",
    },
    dark: {
      paper: "#191724",
      panel: "#1f1d2e",
      ink: "#e0def4",
      stamp: "#eb6f92",
      moss: "#9ccfd8",
      amber: "#f6c177",
    },
  },
  "one-dark": {
    name: "One Dark",
    light: {
      paper: "#fafafa",
      panel: "#ffffff",
      ink: "#383a42",
      stamp: "#ca1243",
      moss: "#50a14f",
      amber: "#c18401",
    },
    dark: {
      paper: "#282c34",
      panel: "#2c313a",
      ink: "#abb2bf",
      stamp: "#e06c75",
      moss: "#98c379",
      amber: "#e5c07b",
    },
  },
  kanagawa: {
    name: "Kanagawa",
    light: {
      paper: "#f2ecbc",
      panel: "#f7f4d7",
      ink: "#545464",
      stamp: "#c84053",
      moss: "#6f894e",
      amber: "#cc6d00",
    },
    dark: {
      paper: "#1f1f28",
      panel: "#2a2a37",
      ink: "#dcd7ba",
      stamp: "#e46876",
      moss: "#98bb6c",
      amber: "#e6c384",
    },
  },
} satisfies Record<string, Scheme>;

export function listSchemes(): { id: string; name: string }[] {
  return Object.entries(SCHEMES).map(
    ([id, scheme]: [string, Scheme]): { id: string; name: string } => ({
      id,
      name: scheme.name,
    }),
  );
}

const REQUIRED: readonly (keyof SchemeColors)[] = [
  "paper",
  "panel",
  "ink",
  "stamp",
  "moss",
  "amber",
] as const;

function isValidBase(base: SchemeColors | undefined): base is SchemeColors {
  return (
    Boolean(base) &&
    REQUIRED.every((key: keyof SchemeColors): boolean =>
      /^#[0-9a-fA-F]{6}$/.test(String(base?.[key] ?? "")),
    )
  );
}

export function resolveTokens(
  schemeId: string | undefined,
  mode: ThemeMode,
  customScheme?: Scheme | null,
): Tokens {
  const scheme: Scheme | null | undefined =
    schemeId === "custom"
      ? customScheme
      : (SCHEMES as Record<string, Scheme>)[schemeId ?? ""];
  const candidate: SchemeColors | undefined = scheme?.[mode];
  const base: SchemeColors = isValidBase(candidate)
    ? candidate
    : SCHEMES.gruvbox[mode];

  const { paper, ink, stamp } = base;
  const derived: DerivedColors = {
    ink2: blend(ink, paper, 0.18),
    ink3: blend(ink, paper, 0.35),
    inkFaint: blend(ink, paper, 0.58),
    rule: blend(paper, ink, 0.1),
    ruleStrong: blend(paper, ink, 0.22),
    wash: blend(paper, ink, 0.05),
    stampTint: blend(paper, stamp, 0.12),
    stampLine: blend(paper, stamp, 0.3),
    stampText: mode === "light" ? blend(stamp, ink, 0.2) : stamp,
    onStamp: paper,
    onAmber: mode === "light" ? ink : paper,
  };

  const tokens: DerivedColors & SchemeColors = { ...derived, ...base };

  return {
    "--color-paper": tokens.paper,
    "--color-panel": tokens.panel,
    "--color-ink": tokens.ink,
    "--color-ink-2": tokens.ink2,
    "--color-ink-3": tokens.ink3,
    "--color-ink-faint": tokens.inkFaint,
    "--color-rule": tokens.rule,
    "--color-rule-strong": tokens.ruleStrong,
    "--color-wash": tokens.wash,
    "--color-stamp": tokens.stamp,
    "--color-stamp-tint": tokens.stampTint,
    "--color-stamp-line": tokens.stampLine,
    "--color-stamp-text": tokens.stampText,
    "--color-on-stamp": tokens.onStamp,
    "--color-moss": tokens.moss,
    "--color-amber": tokens.amber,
    "--color-on-amber": tokens.onAmber,
  };
}

export function applyTokens(rootElement: HTMLElement, tokens: Tokens): void {
  for (const [name, value] of Object.entries(tokens) as [string, string][]) {
    rootElement.style.setProperty(name, value);
  }
}

export function badgeColors(
  schemeId: string | undefined,
  customScheme?: Scheme | null,
): BadgeColors {
  const tokens: Tokens = resolveTokens(schemeId, "light", customScheme);
  return {
    ok: tokens["--color-moss"],
    late: tokens["--color-stamp"],
    neutral: tokens["--color-ink-3"],
  };
}
