import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app" role="status">
        <div className="flex flex-col items-center gap-3">
          <svg className="size-10 animate-pulse text-accent" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="2.5" />
            <path d="M10 22V10h5a4 4 0 010 8h-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sr-only">Authenticating</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
