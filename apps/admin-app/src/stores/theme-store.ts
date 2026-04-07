import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('pf-theme') : null;
  const isDark = saved === 'dark' || (saved === null && true); // Default to dark if not set

  applyTheme(isDark);

  return {
    isDark,
    toggle: () => {
      const next = !get().isDark;
      set({ isDark: next });
      applyTheme(next);
      localStorage.setItem('pf-theme', next ? 'dark' : 'light');
    },
  };
});
