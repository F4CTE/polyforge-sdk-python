import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';

export function VerifiedGuard() {
  const { user } = useAuthStore();

  if (!user?.emailVerified) return <Navigate to="/verify-email" replace />;
  return <Outlet />;
}
