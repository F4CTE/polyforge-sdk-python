import { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { OnboardingChecklist } from '../onboarding/onboarding-checklist';
import { TooltipTour } from '../onboarding/tooltip-tour';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-pf-base text-pf-text overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 ml-2 rounded-pf-sm text-pf-text-muted hover:bg-pf-elevated hover:text-pf-text transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <Topbar />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Onboarding overlays — only render for authenticated users */}
      <OnboardingChecklist />
      <TooltipTour />
    </div>
  );
}
