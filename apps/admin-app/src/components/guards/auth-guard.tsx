import { Navigate, Outlet } from 'react-router';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

export function AuthGuard() {
  const { isAuthenticated, loading } = useAdminAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-pf-base">
        <div className="text-center">
          <svg
            className="mx-auto animate-pulse"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
              stroke="var(--color-pf-cyan-500)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.4"
            />
            <path
              d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z"
              fill="var(--color-pf-cyan-500)"
            />
          </svg>
          <p className="mt-4 text-sm text-pf-text-secondary" role="status">
            Verifying admin session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
