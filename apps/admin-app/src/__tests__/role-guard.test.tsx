import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { RoleGuard } from '../components/guards/role-guard';

const adminState: {
  admin: { id: string; email: string; role: string; displayName: string } | null;
  loading: boolean;
} = {
  admin: null,
  loading: false,
};

vi.mock('../stores/admin-auth-store', () => ({
  useAdminAuthStore: () => adminState,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoleGuard allowed={['SUPER_ADMIN']} />}>
          <Route path="/admins" element={<div>admins-page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoleGuard', () => {
  beforeEach(() => {
    adminState.admin = null;
    adminState.loading = false;
  });

  it('redirects VIEWER away from a SUPER_ADMIN-only route', () => {
    adminState.admin = { id: '1', email: 'v@x', role: 'VIEWER', displayName: 'V' };
    const { queryByText } = renderAt('/admins');
    expect(queryByText('admins-page')).toBeNull();
    expect(queryByText('dashboard-page')).not.toBeNull();
  });

  it('redirects ADMIN away from a SUPER_ADMIN-only route', () => {
    adminState.admin = { id: '2', email: 'a@x', role: 'ADMIN', displayName: 'A' };
    const { queryByText } = renderAt('/admins');
    expect(queryByText('admins-page')).toBeNull();
    expect(queryByText('dashboard-page')).not.toBeNull();
  });

  it('renders the route for SUPER_ADMIN', () => {
    adminState.admin = { id: '3', email: 's@x', role: 'SUPER_ADMIN', displayName: 'S' };
    const { queryByText } = renderAt('/admins');
    expect(queryByText('admins-page')).not.toBeNull();
  });

  it('renders nothing while auth is still loading (avoids flash)', () => {
    adminState.loading = true;
    const { queryByText } = renderAt('/admins');
    expect(queryByText('admins-page')).toBeNull();
    expect(queryByText('dashboard-page')).toBeNull();
  });

  it('redirects unauthenticated users (admin === null)', () => {
    adminState.admin = null;
    const { queryByText } = renderAt('/admins');
    expect(queryByText('admins-page')).toBeNull();
    expect(queryByText('dashboard-page')).not.toBeNull();
  });
});
