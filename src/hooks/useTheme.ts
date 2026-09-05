import { useEffect } from 'react';
import type { ThemePreference } from '@/types';

export const THEME_STORAGE_KEY = 'fzt-theme';

export function resolveIsDark(preference: ThemePreference, systemPrefersDark: boolean): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return systemPrefersDark;
}

/** Keeps the <html> "dark" class in sync with the preference and the OS setting. */
export function useTheme(preference: ThemePreference): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = resolveIsDark(preference, media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* storage may be unavailable (private mode); the class toggle still works */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}
