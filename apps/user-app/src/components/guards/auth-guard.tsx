import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard() {
  const { user, loading } = useAuthStore();

  if (loading) return <div className="min-h-screen flex items-center justify-center" role="status"><span className="sr-only">Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
