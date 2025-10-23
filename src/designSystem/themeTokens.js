export const THEME_STORAGE_KEY = "kpi_theme_preference_v1";

const BASE_TOKENS = {
  font: {
    sans: '"Be Vietnam Pro", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

    mono: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  radius: {
    xs: "0.5rem",

    sm: "0.75rem",

    md: "1rem",

    lg: "1.25rem",

    pill: "999px",
  },

  shadow: {
    soft: "0 20px 60px rgba(15, 23, 42, 0.08)",

    strong: "0 32px 120px rgba(15, 23, 42, 0.14)",
  },
};

const THEME_PALETTES = {
  light: {
    "surface-base": "oklch(0.985 0.01 250)",

    "surface-muted": "oklch(0.965 0.014 250)",

    "surface-card": "oklch(1 0 0)",

    "surface-raised": "oklch(0.99 0.008 250)",

    "surface-overlay": "oklch(0.95 0.015 250 / 0.85)",

    "border-subtle": "color-mix(in srgb, oklch(0.82 0.01 250) 35%, transparent)",

    "border-strong": "color-mix(in srgb, oklch(0.6 0.02 250) 45%, transparent)",

    "text-primary": "oklch(0.21 0.02 250)",

    "text-secondary": "oklch(0.35 0.018 250)",

    "text-muted": "oklch(0.55 0.015 250)",

    "text-muted-soft": "oklch(0.68 0.012 250)",

    "text-inverse": "oklch(0.98 0.005 250)",

    accent: "oklch(0.64 0.18 257)",

    "accent-strong": "oklch(0.56 0.23 257)",

    "accent-soft": "oklch(0.9 0.07 257)",

    "accent-muted": "oklch(0.92 0.05 257)",

    "accent-ring": "oklch(0.7 0.18 257)",

    "chart-1": "#2563eb",

    "chart-2": "#22c55e",

    "chart-3": "#f97316",

    "chart-4": "#a855f7",

    "chart-5": "#14b8a6",
  },

  dark: {
    "surface-base": "oklch(0.16 0.008 250)",

    "surface-muted": "oklch(0.2 0.01 250)",

    "surface-card": "oklch(0.23 0.008 250)",

    "surface-raised": "oklch(0.28 0.008 250)",

    "surface-overlay": "oklch(0.18 0.01 250 / 0.85)",

    "border-subtle": "color-mix(in srgb, oklch(0.46 0.02 250) 35%, transparent)",

    "border-strong": "color-mix(in srgb, oklch(0.58 0.015 250) 55%, transparent)",

    "text-primary": "oklch(0.93 0.01 250)",

    "text-secondary": "oklch(0.78 0.01 250)",

    "text-muted": "oklch(0.66 0.008 250)",

    "text-muted-soft": "oklch(0.55 0.008 250)",

    "text-inverse": "oklch(0.14 0.01 250)",

    accent: "oklch(0.72 0.18 257)",

    "accent-strong": "oklch(0.64 0.18 257)",

    "accent-soft": "oklch(0.28 0.02 257)",

    "accent-muted": "oklch(0.32 0.02 257)",

    "accent-ring": "oklch(0.62 0.16 257)",

    "chart-1": "#60a5fa",

    "chart-2": "#34d399",

    "chart-3": "#fb923c",

    "chart-4": "#c084fc",

    "chart-5": "#2dd4bf",
  },

  "high-contrast": {
    "surface-base": "oklch(0.12 0.03 255)",

    "surface-muted": "oklch(0.18 0.04 255)",

    "surface-card": "oklch(0.15 0.03 255)",

    "surface-raised": "oklch(0.2 0.04 255)",

    "surface-overlay": "oklch(0.1 0.04 255 / 0.85)",

    "border-subtle": "color-mix(in srgb, oklch(0.62 0.05 255) 45%, transparent)",

    "border-strong": "color-mix(in srgb, oklch(0.82 0.06 255) 65%, transparent)",

    "text-primary": "oklch(0.98 0.02 255)",

    "text-secondary": "oklch(0.9 0.015 255)",

    "text-muted": "oklch(0.8 0.012 255)",

    "text-muted-soft": "oklch(0.7 0.01 255)",

    "text-inverse": "oklch(0.08 0.02 255)",

    accent: "oklch(0.72 0.23 20)",

    "accent-strong": "oklch(0.82 0.24 20)",

    "accent-soft": "oklch(0.4 0.1 20)",

    "accent-muted": "oklch(0.32 0.08 20)",

    "accent-ring": "oklch(0.85 0.24 20)",

    "chart-1": "#facc15",

    "chart-2": "#38bdf8",

    "chart-3": "#fb7185",

    "chart-4": "#a78bfa",

    "chart-5": "#34d399",
  },
};

export const DEFAULT_CHART_COLORS = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#14b8a6"];

function setCssVariables(target, entries) {
  if (!target || !entries) return;

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;

    target.style.setProperty(`--ds-${key}`, value);
  }
}

export function applyBaseTokens(
  root = typeof document !== "undefined" ? document.documentElement : null,
) {
  if (!root) return;

  const baseEntries = {};

  for (const [group, values] of Object.entries(BASE_TOKENS)) {
    for (const [token, value] of Object.entries(values)) {
      baseEntries[`${group}-${token}`] = value;
    }
  }

  setCssVariables(root, baseEntries);
}

export function applyThemePalette(
  theme,

  root = typeof document !== "undefined" ? document.documentElement : null,
) {
  if (!root) return;

  const palette = THEME_PALETTES[theme] || THEME_PALETTES.light;

  setCssVariables(root, palette);
}

export function getCssDesignToken(name, fallback = "") {
  if (typeof window === "undefined" || !window.getComputedStyle) {
    return fallback;
  }

  const value = window

    .getComputedStyle(document.documentElement)

    .getPropertyValue(`--ds-${name}`)

    .trim();

  return value || fallback;
}

export function getChartPalette() {
  return DEFAULT_CHART_COLORS.map((fallback, idx) =>
    getCssDesignToken(`chart-${idx + 1}`, fallback),
  );
}

export function sanitizeThemeName(value, fallback = "system") {
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();

  if (["light", "dark", "system", "high-contrast"].includes(normalized)) {
    return normalized;
  }

  return fallback;
}

export function loadStoredTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (!raw) return null;

    return sanitizeThemeName(raw, null);
  } catch {
    return null;
  }
}
