import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

const STORAGE_KEY = 'polyforge:theme';

function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light') return false;
  if (saved === 'dark') return true;
  // Fallback: check prefers-color-scheme
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const isDark = getInitialTheme();

  applyTheme(isDark);

  return {
    isDark,
    toggle: () => {
      const next = !get().isDark;
      set({ isDark: next });
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    },
  };
});
