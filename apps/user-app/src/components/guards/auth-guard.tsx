import { Navigate, Outlet } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-10 animate-spin text-accent" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Authenticating</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
