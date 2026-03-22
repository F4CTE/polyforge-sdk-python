import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { usePollingStore } from '@/stores/polling-store';

export function Component() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { start, stop } = usePollingStore();

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-pf-bg)]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 ml-2 rounded-md text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-elevated)] transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <AdminTopbar />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
