import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { OnboardingChecklist } from '../onboarding/onboarding-checklist';
import { TooltipTour } from '../onboarding/tooltip-tour';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close mobile nav on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMobile();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <div className="flex h-screen bg-pf-base text-pf-text overflow-hidden">
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-pf-cyan-500 focus:text-black focus:rounded-pf focus:text-sm focus:font-medium">
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <div className={`hidden md:block overflow-hidden transition-[width,min-width] duration-200 ${collapsed ? 'w-16 min-w-16' : 'w-60 min-w-60'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative z-50 h-full w-60">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center ml-2 rounded-pf-sm text-pf-text-muted hover:bg-pf-elevated hover:text-pf-text active:bg-pf-surface transition-colors md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <Topbar />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Onboarding overlays — only render for authenticated users */}
      <OnboardingChecklist />
      <TooltipTour />
    </div>
  );
}
