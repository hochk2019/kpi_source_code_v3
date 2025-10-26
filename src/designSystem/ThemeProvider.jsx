import React, { useEffect, useMemo, useState } from 'react';

import {

  applyBaseTokens,

  applyThemePalette,

  getChartPalette,

  loadStoredTheme,

  sanitizeThemeName,

  THEME_STORAGE_KEY,

} from './themeTokens.js';

import {

  applyBrandTokens,

  DEFAULT_BRAND,

  getBrandOptions,

  loadStoredBrand,

  sanitizeBrandName,

  BRAND_STORAGE_KEY,

} from './brandTokens.js';

import { ThemeContext } from './themeContext.js';



function getSystemPreference() {

  if (typeof window === 'undefined' || !window.matchMedia) {

    return 'light';

  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

}



export function ThemeProvider({ children, defaultTheme = 'system' }) {

  const storedTheme = typeof window !== 'undefined' ? loadStoredTheme() : null;

  const storedBrand = typeof window !== 'undefined' ? loadStoredBrand() : null;

  const [theme, setThemeState] = useState(() => storedTheme ?? sanitizeThemeName(defaultTheme));

  const [systemTheme, setSystemTheme] = useState(() => getSystemPreference());

  const [brand, setBrandState] = useState(() => storedBrand ?? DEFAULT_BRAND);

  const brandOptions = useMemo(() => getBrandOptions(), []);



  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const isDarkLike = resolvedTheme === 'dark' || resolvedTheme === 'high-contrast';



  useEffect(() => {

    applyBaseTokens();

  }, []);



  useEffect(() => {

    applyThemePalette(resolvedTheme);

    const root = document.documentElement;

    if (!root) return;

    if (isDarkLike) {

      root.classList.add('dark');

    } else {

      root.classList.remove('dark');

    }

    root.dataset.theme = resolvedTheme;

    root.style.colorScheme = isDarkLike ? 'dark' : 'light';

  }, [resolvedTheme, isDarkLike]);



  useEffect(() => {

    const root = document.documentElement;

    if (!root) return;

    applyBrandTokens(brand, resolvedTheme, root);

  }, [brand, resolvedTheme]);



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



  useEffect(() => {

    if (typeof window === 'undefined') return;

    try {

      window.localStorage.setItem(BRAND_STORAGE_KEY, brand);

    } catch (error) {

      console.warn('Không thể lưu lựa chọn màu thương hiệu vào localStorage', error);

    }

  }, [brand]);



  const value = useMemo(

    () => ({

      theme,

      resolvedTheme,

      brand,

      brandOptions,

      setTheme: (next) => setThemeState(sanitizeThemeName(next, 'system')),

      setBrand: (next) => setBrandState(sanitizeBrandName(next, DEFAULT_BRAND)),

      getChartPalette,

    }),

    [theme, resolvedTheme, brand, brandOptions],

  );



  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;

}



