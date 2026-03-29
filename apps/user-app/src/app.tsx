import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAuthStore } from './stores/auth-store';
import { useThemeStore } from './stores/theme-store';
import { ErrorBoundary } from './components/error-boundary';
import { wsManager } from './lib/websocket';

export function App() {
  const init = useAuthStore((s) => s.init);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    init();
    wsManager.connect();
    return () => { wsManager.destroy(); };
  }, [init]);

  return (
    <>
      <ErrorBoundary>
        <RouterProvider
          router={router}
          fallbackElement={
            <div className="flex min-h-screen items-center justify-center bg-pf-base">
              <svg className="size-10 animate-pulse text-pf-cyan-500" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="2.5" />
                <path d="M10 22V10h5a4 4 0 010 8h-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
