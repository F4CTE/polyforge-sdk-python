import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { usePollingStore } from '@/stores/polling-store';

export function Component() {
  const [collapsed, setCollapsed] = useState(false);
  const { start, stop } = usePollingStore();

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-pf-bg)]">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-col flex-1 min-w-0">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
