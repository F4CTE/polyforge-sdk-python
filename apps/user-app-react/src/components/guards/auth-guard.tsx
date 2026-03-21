import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard() {
  const { user, loading } = useAuthStore();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
