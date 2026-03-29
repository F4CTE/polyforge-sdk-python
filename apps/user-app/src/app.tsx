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
        <RouterProvider router={router} />
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
