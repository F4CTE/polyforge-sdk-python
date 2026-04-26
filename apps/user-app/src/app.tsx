import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAuthStore } from './stores/auth-store';
import { useThemeStore } from './stores/theme-store';
import { ErrorBoundary } from './components/error-boundary';
import { wsManager } from './lib/websocket';
import { useNotificationStore } from './stores/notification-store';
import { capture } from './lib/analytics';

export function App() {
  const init = useAuthStore((s) => s.init);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    init();
    wsManager.connect();
    const unbind = useNotificationStore.getState().bindWebSocket(wsManager);

    const unsubRouter = router.subscribe((state) => {
      if (state.navigation.state === 'idle') {
        capture('page_viewed', { path: state.location.pathname });
      }
    });

    return () => {
      unbind();
      wsManager.destroy();
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
