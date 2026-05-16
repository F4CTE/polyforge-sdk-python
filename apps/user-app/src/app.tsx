import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./router";
import { useAuthStore } from "./stores/auth-store";
import { useThemeStore } from "./stores/theme-store";
import { ErrorBoundary } from "./components/error-boundary";
import { wsManager } from "./lib/websocket";
import { useNotificationStore } from "./stores/notification-store";
import { capture } from "./lib/analytics";

// Expose WebSocket manager for E2E state-transition tests on localhost
// (dev server and CI E2E both serve on localhost; production deployments
// use a real domain so the hook stays disabled in prod).
if (typeof window !== "undefined" && (import.meta.env.DEV || window.location.hostname === "localhost")) {
  (window as unknown as Record<string, unknown>).__wsManager = wsManager;
}

export function App() {
  const init = useAuthStore((s) => s.init);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    init();
    wsManager.connect();
    const unbind = useNotificationStore.getState().bindWebSocket(wsManager);

    const unsubRouter = router.subscribe((state) => {
      if (state.navigation.state === "idle") {
        capture("page_viewed", { path: state.location.pathname });
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
        theme={isDark ? "dark" : "light"}
        position="top-right"
        toastOptions={{
          className: "bg-elevated border border-default text-primary",
        }}
      />
    </>
  );
}
