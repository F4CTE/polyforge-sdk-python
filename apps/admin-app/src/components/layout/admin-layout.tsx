import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
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

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-pf-base text-pf-text">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Desktop sidebar */}
      <div className={`hidden md:block overflow-hidden transition-[width,min-width] duration-pf-normal ${collapsed ? 'w-16 min-w-16' : 'w-60 min-w-60'}`}>
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-pf-backdrop-light" role="button" tabIndex={0} aria-label="Close sidebar" onClick={() => setMobileOpen(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMobileOpen(false); }} />
          <div className="relative z-50 h-full w-60">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <AdminTopbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
