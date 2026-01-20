import { useState, useEffect, useCallback } from 'react';

export type Theme = 'default' | 'holiday' | 'valentines' | 'halloween';

const THEME_COOKIE_NAME = 'theme';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match?.[2] ?? null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function isValidTheme(value: string | null): value is Theme {
  return value === 'default' || value === 'holiday' || value === 'valentines' || value === 'halloween';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getCookie(THEME_COOKIE_NAME);
    return isValidTheme(stored) ? stored : 'default';
  });

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setCookie(THEME_COOKIE_NAME, newTheme, COOKIE_MAX_AGE);
    setThemeState(newTheme);
  }, []);

  return { theme, setTheme };
}

// Initialize theme immediately on script load (before React hydrates)
// This prevents flash of unstyled content
const initialTheme = getCookie(THEME_COOKIE_NAME);
if (isValidTheme(initialTheme)) {
  applyTheme(initialTheme);
} else {
  applyTheme('valentines');
}
