import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';
import { MobileBottomNav } from './mobile-bottom-nav';
import { BetaBanner } from '../beta-banner';
import { OnboardingChecklist } from '../onboarding/onboarding-checklist';
import { TooltipTour } from '../onboarding/tooltip-tour';
import { ShortcutsModal } from '../shortcuts/shortcuts-modal';
import { OnboardingModal } from '../onboarding/onboarding-modal';

const ONBOARDING_KEY = 'pf-onboarding-complete';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    const t = setTimeout(() => setShowOnboarding(true), 500);
    return () => clearTimeout(t);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close mobile nav on route change
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile nav on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMobile();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  // ⌘K / Ctrl+K opens command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ? key opens shortcuts modal (skip when typing in inputs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // open-shortcuts custom event (fired by Topbar button)
  useEffect(() => {
    function onOpenShortcuts() {
      setShowShortcuts(true);
    }
    window.addEventListener('open-shortcuts', onOpenShortcuts);
    return () => window.removeEventListener('open-shortcuts', onOpenShortcuts);
  }, []);

  return (
    <div className="flex h-screen bg-app text-primary overflow-hidden">
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:z-[100] focus-visible:top-2 focus-visible:left-2 focus-visible:px-4 focus-visible:py-2 focus-visible:bg-accent focus-visible:text-inverse focus-visible:rounded-pf focus-visible:text-body-md focus-visible:font-medium">
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <div className={`hidden md:block overflow-hidden transition-[width,min-width] duration-panel ${collapsed ? 'w-16 min-w-16' : 'w-60 min-w-60'}`}>
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center ml-2 rounded-sm text-tertiary hover:bg-elevated hover:text-primary active:bg-surface transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <Topbar />
          </div>
        </div>
        <BetaBanner />
        <main className="flex-1 overflow-y-auto pb-16 sm:pb-0" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Onboarding overlays — only render for authenticated users */}
      <OnboardingChecklist />
      <TooltipTour />

      {/* Global command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Keyboard shortcuts reference modal */}
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Welcome onboarding modal — shown once to new users */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
