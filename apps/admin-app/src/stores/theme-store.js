import { create } from 'zustand';
export const useThemeStore = create((set, get) => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pf-theme') : null;
    const isDark = saved !== 'light';
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('light', !isDark);
    }
    return {
        isDark,
        toggle: () => {
            const next = !get().isDark;
            set({ isDark: next });
            document.documentElement.classList.toggle('dark', next);
            document.documentElement.classList.toggle('light', !next);
            localStorage.setItem('pf-theme', next ? 'dark' : 'light');
        },
    };
});
