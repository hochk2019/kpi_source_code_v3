/**
 * TypeScript token constants matching CSS --ds-* variables.
 * Use these for type-safe token access in code (e.g., dynamic styles, JS-based theming).
 *
 * For CSS usage, prefer the CSS variables directly: var(--ds-surface-base)
 */

export const surface = {
  base: 'var(--ds-surface-base)',
  muted: 'var(--ds-surface-muted)',
  card: 'var(--ds-surface-card)',
  raised: 'var(--ds-surface-raised)',
  overlay: 'var(--ds-surface-overlay)',
} as const;

export const text = {
  primary: 'var(--ds-text-primary)',
  secondary: 'var(--ds-text-secondary)',
  muted: 'var(--ds-text-muted)',
  mutedSoft: 'var(--ds-text-muted-soft)',
  inverse: 'var(--ds-text-inverse)',
} as const;

export const border = {
  subtle: 'var(--ds-border-subtle)',
  strong: 'var(--ds-border-strong)',
} as const;

export const accent = {
  DEFAULT: 'var(--ds-accent)',
  strong: 'var(--ds-accent-strong)',
  soft: 'var(--ds-accent-soft)',
  muted: 'var(--ds-accent-muted)',
  ring: 'var(--ds-accent-ring)',
} as const;

export const semantic = {
  destructive: 'var(--ds-destructive)',
  success: 'var(--ds-success)',
  warning: 'var(--ds-warning)',
  info: 'var(--ds-info)',
} as const;

export const chart = {
  1: 'var(--ds-chart-1)',
  2: 'var(--ds-chart-2)',
  3: 'var(--ds-chart-3)',
  4: 'var(--ds-chart-4)',
  5: 'var(--ds-chart-5)',
} as const;

export const radius = {
  xs: 'var(--ds-radius-xs)',
  sm: 'var(--ds-radius-sm)',
  md: 'var(--ds-radius-md)',
  lg: 'var(--ds-radius-lg)',
  pill: 'var(--ds-radius-pill)',
} as const;

export const shadow = {
  soft: 'var(--ds-shadow-soft)',
  strong: 'var(--ds-shadow-strong)',
} as const;

export const font = {
  sans: 'var(--ds-font-sans)',
  mono: 'var(--ds-font-mono)',
} as const;

/** Brand tokens — controlled by ThemeProvider brand preset */
export const brand = {
  50: 'var(--brand-50)',
  100: 'var(--brand-100)',
  200: 'var(--brand-200)',
  300: 'var(--brand-300)',
  400: 'var(--brand-400)',
  500: 'var(--brand-500)',
  600: 'var(--brand-600)',
  700: 'var(--brand-700)',
  800: 'var(--brand-800)',
  900: 'var(--brand-900)',
  on500: 'var(--brand-on-500)',
  ring: 'var(--brand-ring)',
  gradient: 'var(--brand-gradient)',
} as const;
