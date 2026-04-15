/* API docs page — main layout + routing only. */

import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Sun, Moon, Menu, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { DocsSidebar } from './api-docs-sidebar';
import { Button } from '@polyforge/ui';
import { renderContent } from './api-docs-content';
import { NAV_GROUPS, ENDPOINT_SECTIONS } from './api-docs-nav';
import { Badge, METHOD_CLS, type Lang } from './api-docs-primitives';

/* ─── Public header (unauthenticated only) ───────────────────────── */

function PublicHeader() {
  const { isDark, toggle } = useThemeStore();
  return (
    <header className="shrink-0 flex items-center justify-between px-5 h-[57px] border-b border-default bg-surface">
      <Link to="/" className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-primary">
          <span className="text-accent-text">Poly</span>forge
        </span>
        <span className="text-strong text-sm font-light select-none">/</span>
        <span className="text-xs font-medium text-secondary">API Reference</span>
      </Link>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-pf text-tertiary hover:text-primary hover:bg-overlay transition-colors cursor-pointer"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
        <Link
          to="/login"
          className="text-sm font-medium text-secondary hover:text-primary transition-colors px-3 py-2"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="text-sm font-semibold px-4 py-2 rounded-pf bg-accent text-inverse hover:bg-accent-text transition-colors duration-micro"
        >
          Sign up free
        </Link>
      </div>
    </header>
  );
}

/* ─── On This Page TOC ───────────────────────────────────────────── */

interface TocProps {
  sectionId: string;
  onSelect: (key: string) => void;
}

function OnThisPage({ sectionId, onSelect }: TocProps) {
  const section = ENDPOINT_SECTIONS.find(s => s.id === sectionId);
  if (!section) return null;
  return (
    <div className="hidden xl:flex flex-col w-48 shrink-0 pl-6 pt-6 gap-1">
      <p className="text-caption font-semibold text-tertiary uppercase tracking-wider mb-2">
        On this page
      </p>
      {section.eps.map(ep => (
        <Button
          type="button"
          variant="ghost"
          key={`${ep.method}-${ep.path}`}
          onClick={() => onSelect(`${ep.method}-${ep.path}`)}
          className="text-xs text-tertiary hover:text-primary py-1 cursor-pointer text-left flex items-center gap-2 truncate"
        >
          <Badge text={ep.method} cls={`${METHOD_CLS[ep.method]} shrink-0`} />
          <span className="truncate">{ep.summary}</span>
        </Button>
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export function Component() {
  const user = useAuthStore(s => s.user);
  const [lang, setLang] = useState<Lang>('curl');
  const [activeId, setActiveId] = useState('getting-started');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openEndpointId, setOpenEndpointId] = useState<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(v => !v), []);

  function navigate(id: string) {
    setActiveId(id);
    setOpenEndpointId(undefined);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function handleTocSelect(key: string) {
    setOpenEndpointId(key);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activeId))?.group;
  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeId)?.label ?? '';
  const isEndpointSection = ENDPOINT_SECTIONS.some(s => s.id === activeId);

  /* ── Shared docs panel ── */
  const docsPanel = (
    <>
      {/* Mobile docs sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full w-72 bg-surface">
            <DocsSidebar
              activeId={activeId}
              onNavigate={id => { navigate(id); setMobileSidebarOpen(false); }}
            />
          </div>
        </div>
      )}

      {/* Desktop docs sidebar */}
      <div className="hidden lg:flex flex-col w-60 shrink-0">
        <DocsSidebar activeId={activeId} onNavigate={navigate} />
      </div>

      {/* Content area */}
      <div ref={contentRef} className="flex flex-1 min-w-0 overflow-y-auto bg-app flex-col">
        {/* Breadcrumb bar */}
        <nav
          aria-label="Breadcrumb"
          className="sticky top-0 z-10 flex items-center gap-2 px-6 h-11 bg-surface/80 backdrop-blur-sm border-b border-default text-xs text-tertiary shrink-0"
        >
          {/* Mobile docs menu button — visible only below lg */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 mr-2 text-tertiary hover:text-primary transition-colors cursor-pointer"
            aria-label="Open docs navigation"
          >
            <BookOpen size={16} />
            <span className="text-xs">Menu</span>
          </Button>
          <span>Docs</span>
          <ChevronRight className="size-3 shrink-0" />
          {currentGroup && (
            <>
              <span>{currentGroup}</span>
              <ChevronRight className="size-3 shrink-0" />
            </>
          )}
          <span className="text-secondary">{currentLabel}</span>
        </nav>

        {/* Main content + optional TOC */}
        <div className="flex flex-1 min-w-0">
          <div className="flex-1 min-w-0 px-6 py-6 max-w-4xl mx-auto">
            {renderContent({ activeId, lang, setLang, openEndpointId, navigate })}
          </div>
          {isEndpointSection && (
            <OnThisPage sectionId={activeId} onSelect={handleTocSelect} />
          )}
        </div>
      </div>
    </>
  );

  /* ── Authenticated layout ── */
  if (user) {
    return (
      <div className="flex h-screen bg-app text-primary overflow-hidden animate-fade-in">
        {/* App sidebar */}
        <div className={`hidden md:block overflow-hidden transition-[width,min-width] duration-panel ${sidebarCollapsed ? 'w-16 min-w-16' : 'w-60 min-w-60'}`}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>
        {/* Mobile app sidebar overlay */}
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center ml-2 rounded-sm text-tertiary hover:bg-elevated hover:text-primary transition-colors md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </Button>
            <div className="flex-1"><Topbar /></div>
          </div>
          <main className="flex-1 overflow-hidden flex" id="main-content">
            {docsPanel}
          </main>
        </div>
      </div>
    );
  }

  /* ── Public layout ── */
  return (
    <div className="flex flex-col h-screen bg-app text-primary overflow-hidden animate-fade-in">
      <PublicHeader />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {docsPanel}
      </div>
    </div>
  );
}
