/* API docs navigation sidebar with search, keyboard shortcut, and download links. */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { X, Download, Key } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from './api-docs-primitives';
import { ENDPOINT_SECTIONS, NAV_GROUPS } from './api-docs-nav';
import { Button, Input } from '@polyforge/ui';

interface DocsSidebarProps {
  activeId: string;
  onNavigate: (id: string) => void;
}

export function DocsSidebar({ activeId, onNavigate }: DocsSidebarProps) {
  const user = useAuthStore(s => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  /* Cmd+K / Ctrl+K focuses the search input */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const q = searchQuery.toLowerCase().trim();

  /* Filter nav groups when query is non-empty */
  const filteredGroups = q
    ? NAV_GROUPS.map(g => ({
        ...g,
        items: g.items.filter(item => item.label.toLowerCase().includes(q)),
      })).filter(g => g.items.length > 0)
    : NAV_GROUPS;

  /* Find matching endpoints from ENDPOINT_SECTIONS */
  const matchingEndpoints = q
    ? ENDPOINT_SECTIONS.flatMap(section =>
        section.eps
          .filter(
            ep =>
              ep.summary.toLowerCase().includes(q) ||
              ep.path.toLowerCase().includes(q)
          )
          .map(ep => ({ sectionId: section.id, sectionTitle: section.title, ep }))
      )
    : [];

  return (
    <aside className="flex flex-col h-full w-full bg-pf-surface border-r border-pf-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-pf-border shrink-0 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-pf-text-secondary uppercase tracking-wider">
          API Reference
        </span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-pf-full bg-pf-success shrink-0" aria-hidden="true" />
          <Badge text="v1" cls="bg-pf-cyan-500/10 text-pf-cyan-400" />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0 relative">
        <Input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search docs..."
          className="w-full bg-pf-base border border-pf-border rounded-pf-sm px-3 py-2 text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500 focus:ring-1 focus:ring-pf-cyan-500/50 pr-8"
        />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-5 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text cursor-pointer"
          >
            <X size={13} />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav
        aria-label="API documentation sections"
        className="flex-1 px-2 py-2 space-y-3 overflow-y-auto"
      >
        {filteredGroups.map(g => (
          <div key={g.group ?? 'overview'}>
            {g.group && (
              <p className="text-pf-caption font-semibold text-pf-text-muted uppercase tracking-wider mb-1 px-2 pt-1">
                {g.group}
              </p>
            )}
            <div className="space-y-px">
              {g.items.map(item => (
                <Button
                  type="button"
                  variant="ghost"
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-pf-sm text-sm transition-colors duration-100 cursor-pointer ${
                    activeId === item.id
                      ? 'bg-pf-cyan-500/10 text-pf-cyan-400 font-medium'
                      : 'text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated'
                  }`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        ))}

        {/* Endpoint search results */}
        {matchingEndpoints.length > 0 && (
          <div>
            <p className="text-pf-caption font-semibold text-pf-text-muted uppercase tracking-wider mb-1 px-2 pt-1">
              Endpoints
            </p>
            <div className="space-y-px">
              {matchingEndpoints.map(({ sectionId, ep }) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={`${ep.method}-${ep.path}`}
                  onClick={() => onNavigate(sectionId)}
                  className="w-full text-left px-3 py-2 rounded-pf-sm text-xs transition-colors duration-100 cursor-pointer text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated"
                >
                  <span className="font-mono text-pf-cyan-400 mr-1">{ep.method}</span>
                  {ep.summary}
                </Button>
              ))}
            </div>
          </div>
        )}

        {q && filteredGroups.length === 0 && matchingEndpoints.length === 0 && (
          <p className="text-xs text-pf-text-muted px-3 py-2">No results for "{searchQuery}"</p>
        )}
      </nav>

      {/* Download + API Keys footer */}
      <div className="border-t border-pf-border px-3 py-3 shrink-0 space-y-2">
        <a
          href="/api/v1/openapi.json"
          download
          className="flex items-center gap-2 text-xs text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
        >
          <Download size={13} /> OpenAPI spec (JSON)
        </a>
        <a
          href="/api/v1/postman.json"
          download
          className="flex items-center gap-2 text-xs text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
        >
          <Download size={13} /> Postman collection
        </a>
        {user && (
          <Link
            to="/settings"
            className="flex items-center gap-2 text-xs text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
          >
            <Key size={13} /> API Keys
          </Link>
        )}
      </div>
    </aside>
  );
}
