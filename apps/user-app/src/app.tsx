import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAuthStore } from './stores/auth-store';

export function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
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
