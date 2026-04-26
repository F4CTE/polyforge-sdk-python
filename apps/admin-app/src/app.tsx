import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAdminAuthStore } from './stores/admin-auth-store';
import { useThemeStore } from './stores/theme-store';
import { ErrorBoundary } from './components/error-boundary';
import { capture } from './lib/analytics';

export function App() {
  const init = useAdminAuthStore((s) => s.init);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    init();

    const unsubRouter = router.subscribe((state) => {
      if (state.navigation.state === 'idle') {
        capture('page_viewed', { path: state.location.pathname, app: 'admin' });
      }
    });

    return () => {
      unsubRouter();
    };
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
          className: 'bg-elevated border border-default text-primary',
        }}
      />
    </>
  );
}
