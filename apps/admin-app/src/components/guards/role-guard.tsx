import { Navigate, Outlet } from 'react-router';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

interface RoleGuardProps {
  allowed: ReadonlyArray<string>;
  fallback?: string;
}

/**
 * Gate a route subtree to a set of admin roles.
 *
 * Note: this is a UX guard to prevent privileged UI from flashing for
 * non-privileged admins. The authoritative check lives on the server —
 * the API will return 403 regardless.
 */
export function RoleGuard({ allowed, fallback = '/dashboard' }: RoleGuardProps) {
  const { admin, loading } = useAdminAuthStore();

  if (loading) return null;
  if (!admin || !allowed.includes(admin.role)) {
    return <Navigate to={fallback} replace />;
  }
  return <Outlet />;
}
