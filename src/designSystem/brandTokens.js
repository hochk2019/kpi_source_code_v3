export const BRAND_STORAGE_KEY = 'kpi_brand_preference_v1';

export const DEFAULT_BRAND = 'golden';



const BRAND_PRESETS = {

  golden: {

    label: 'Golden Logistics',

    description: 'Tông vàng cam theo nhận diện hiện tại',

    palette: {

      50: '#fffbeb',

      100: '#fef3c7',

      200: '#fde68a',

      300: '#fcd34d',

      400: '#fbbf24',

      500: '#f59e0b',

      600: '#d97706',

      700: '#b45309',

      800: '#92400e',

      900: '#78350f',

    },

    onAccent: '#ffffff',

    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 52%, #d97706 100%)',

  },

  ocean: {

    label: 'OCEAN BLUE',

    description: 'Tông xanh biển cho các chiến dịch đặc biệt',

    palette: {

      50: '#eff6ff',

      100: '#dbeafe',

      200: '#bfdbfe',

      300: '#93c5fd',

      400: '#60a5fa',

      500: '#3b82f6',

      600: '#2563eb',

      700: '#1d4ed8',

      800: '#1e40af',

      900: '#1e3a8a',

    },

    onAccent: '#f8fafc',

    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #0ea5e9 100%)',

  },

  forest: {

    label: 'Forest Emerald',

    description: 'Tông xanh ngọc nhấn mạnh thông điệp “xanh hoá logistics”',

    palette: {

      50: '#ecfdf5',

      100: '#d1fae5',

      200: '#a7f3d0',

      300: '#6ee7b7',

      400: '#34d399',

      500: '#10b981',

      600: '#059669',

      700: '#047857',

      800: '#065f46',

      900: '#064e3b',

    },

    onAccent: '#f0fdf4',

    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 48%, #34d399 100%)',

  },

};



export function getBrandOptions() {

  return Object.entries(BRAND_PRESETS).map(([value, preset]) => ({

    value,

    label: preset.label,

    description: preset.description,

    preview: preset.palette[500],

    gradient: preset.gradient,

  }));

}



export function sanitizeBrandName(value, fallback = DEFAULT_BRAND) {

  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();

  if (BRAND_PRESETS[normalized]) {

    return normalized;

  }

  return fallback;

}



export function loadStoredBrand() {

  if (typeof window === 'undefined') return null;

  try {

    const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);

    if (!raw) return null;

    return sanitizeBrandName(raw, null);

  } catch {

    return null;

  }

}



function setCssVariables(target, entries) {

  if (!target || !entries) return;

  for (const [key, value] of Object.entries(entries)) {

    if (value === undefined || value === null) continue;

    target.style.setProperty(key.startsWith('--') ? key : `--${key}`, value);

  }

}



function createBrandTokens(preset) {

  const { palette, onAccent, gradient } = preset;

  const ring = `color-mix(in srgb, ${palette[500]} 45%, white)`;

  return {

    '--brand-50': palette[50],

    '--brand-100': palette[100],

    '--brand-200': palette[200],

    '--brand-300': palette[300],

    '--brand-400': palette[400],

    '--brand-500': palette[500],

    '--brand-600': palette[600],

    '--brand-700': palette[700],

    '--brand-800': palette[800],

    '--brand-900': palette[900],

    '--brand-on-500': onAccent,

    '--brand-ring': ring,

    '--brand-gradient': gradient,

  };

}



function createThemeOverrides(preset) {

  const { palette } = preset;

  return {

    light: {

      '--ds-accent': `var(--brand-500)`,

      '--ds-accent-strong': `var(--brand-600)`,

      '--ds-accent-soft': `var(--brand-100)`,

      '--ds-accent-muted': `var(--brand-200)`,

      '--ds-accent-ring': `var(--brand-ring)`,

    },

    dark: {

      '--ds-accent': `color-mix(in srgb, ${palette[400]} 92%, white)`,

      '--ds-accent-strong': palette[300],

      '--ds-accent-soft': `color-mix(in srgb, ${palette[500]} 18%, transparent)`,

      '--ds-accent-muted': `color-mix(in srgb, ${palette[400]} 26%, transparent)`,

      '--ds-accent-ring': `color-mix(in srgb, ${palette[500]} 70%, white)`,

    },

    'high-contrast': {

      '--ds-accent': palette[200],

      '--ds-accent-strong': palette[100],

      '--ds-accent-soft': `color-mix(in srgb, ${palette[100]} 35%, white)`,

      '--ds-accent-muted': `color-mix(in srgb, ${palette[200]} 45%, white)`,

      '--ds-accent-ring': palette[50],

    },

  };

}



const BRAND_OVERRIDE_CACHE = new Map();



function getOverridesForBrand(brand) {

  if (BRAND_OVERRIDE_CACHE.has(brand)) {

    return BRAND_OVERRIDE_CACHE.get(brand);

  }

  const preset = BRAND_PRESETS[brand];

  if (!preset) return null;

  const overrides = createThemeOverrides(preset);

  BRAND_OVERRIDE_CACHE.set(brand, overrides);

  return overrides;

}



export function applyBrandTokens(brandName, theme, root = typeof document !== 'undefined' ? document.documentElement : null) {

  if (!root) return;

  const brand = BRAND_PRESETS[brandName] ? brandName : DEFAULT_BRAND;

  const preset = BRAND_PRESETS[brand];

  setCssVariables(root, createBrandTokens(preset));

  const overrides = getOverridesForBrand(brand);

  const themeOverrides = overrides?.[theme] ?? overrides?.light;

  if (themeOverrides) {

    setCssVariables(root, themeOverrides);

  }

  root.dataset.brand = brand;

}



export function getBrandPreview(brandName = DEFAULT_BRAND) {

  const preset = BRAND_PRESETS[brandName];

  if (!preset) return null;

  return {

    accent: preset.palette[500],

    gradient: preset.gradient,

  };

}

