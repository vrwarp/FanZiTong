import { renderHook } from '@testing-library/react';
import { resolveIsDark, THEME_STORAGE_KEY, useTheme } from './useTheme';

describe('theme', () => {
  it('resolves the preference against the OS setting', () => {
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });

  it('applies the dark class and persists the preference', () => {
    const { rerender } = renderHook(({ pref }) => useTheme(pref), {
      initialProps: { pref: 'dark' as const },
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    rerender({ pref: 'light' as never });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
