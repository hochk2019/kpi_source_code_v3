import { useEffect, useState } from 'react';
import { getChartPalette as readPalette } from './themeTokens.js';
import { useTheme } from './useTheme.js';

export function useChartPalette() {
  const { resolvedTheme, getChartPalette } = useTheme();
  const reader = getChartPalette ?? readPalette;
  const [palette, setPalette] = useState(() => reader());

  useEffect(() => {
    setPalette(reader());
  }, [resolvedTheme]);

  return palette;
}

export function useDesignToken(tokenName, fallback = '') {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.getComputedStyle) {
      setValue(fallback);
      return;
    }
    const computed = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(`--ds-${tokenName}`)
      .trim();
    setValue(computed || fallback);
  }, [resolvedTheme, tokenName, fallback]);

  return value;
}
