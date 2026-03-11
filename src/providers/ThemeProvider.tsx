'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'dracula';

interface ThemeCtxValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

const THEMES: Theme[] = ['light', 'dark', 'dracula'];

const ThemeCtx = createContext<ThemeCtxValue>({
  theme: 'light',
  setTheme: () => {},
  cycle: () => {},
});

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove('dark', 'dracula');
  if (theme === 'dark') html.classList.add('dark');
  if (theme === 'dracula') html.classList.add('dracula');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const prefDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = saved ?? (prefDark ? 'dark' : 'light');
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    applyTheme(t);
  };

  const cycle = () => {
    const idx = THEMES.indexOf(theme);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  return <ThemeCtx.Provider value={{ theme, setTheme, cycle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
