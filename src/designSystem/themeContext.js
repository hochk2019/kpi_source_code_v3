import { createContext } from 'react';

import { DEFAULT_BRAND } from './brandTokens.js';



export const ThemeContext = createContext({

  theme: 'system',

  resolvedTheme: 'light',

  brand: DEFAULT_BRAND,

  setTheme: (_next) => {},

  setBrand: (_next) => {},

  brandOptions: [],

  getChartPalette: () => [],

});

