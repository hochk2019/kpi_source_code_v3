import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyBaseTokens,
  applyThemePalette,
  getChartPalette,
  loadStoredTheme,
  sanitizeThemeName,
  THEME_STORAGE_KEY,
} from './themeTokens.js';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  getChartPalette: () => [],
});

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children, defaultTheme = 'system' }) {
  const storedTheme = typeof window !== 'undefined' ? loadStoredTheme() : null;
  const [theme, setThemeState] = useState(() => storedTheme ?? sanitizeThemeName(defaultTheme));
  const [systemTheme, setSystemTheme] = useState(() => getSystemPreference());

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    applyBaseTokens();
  }, []);

  useEffect(() => {
    applyThemePalette(resolvedTheme);
    const root = document.documentElement;
    if (!root) return;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Không thể lưu lựa chọn theme vào localStorage', error);
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => setThemeState(sanitizeThemeName(next, 'system')),
      getChartPalette,
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
