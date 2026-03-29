import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAdminAuthStore } from './stores/admin-auth-store';
import { useThemeStore } from './stores/theme-store';
import { ErrorBoundary } from './components/error-boundary';

export function App() {
  const init = useAdminAuthStore((s) => s.init);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <ErrorBoundary>
        <RouterProvider
          router={router}
          fallbackElement={
            <div className="flex items-center justify-center h-screen bg-[var(--color-pf-bg)]">
              <svg className="animate-pulse" width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="var(--color-pf-cyan-500)" strokeWidth="1.2" fill="none" opacity="0.4" />
                <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="var(--color-pf-cyan-500)" />
              </svg>
            </div>
          }
        />
      </ErrorBoundary>
      <Toaster
        theme={isDark ? 'dark' : 'light'}
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--color-pf-elevated)',
            border: '1px solid var(--color-pf-border)',
            color: 'var(--color-pf-text)',
          },
        }}
      />
    </>
  );
}
