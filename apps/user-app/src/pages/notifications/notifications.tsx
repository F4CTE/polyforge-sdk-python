import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  TrendingUp,
  Settings,
  Users,
  Info,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationStore } from '@/stores/notification-store';
import type { NotificationItem } from '@/stores/notification-store';
import { Button } from '@polyforge/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerNotification {
  id: string;
  title: string;
  body: string;
  category: 'trade' | 'system' | 'alert' | 'social' | 'general';
  severity: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface MergedNotification {
  id: string;
  title: string;
  body: string;
  category: 'trade' | 'system' | 'alert' | 'social' | 'general';
  severity: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: number;
  actionUrl?: string;
  source: 'server' | 'store';
}

type FilterTab = 'all' | 'unread' | 'trades' | 'system' | 'alerts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All',    value: 'all'    },
  { label: 'Unread', value: 'unread' },
  { label: 'Trades', value: 'trades' },
  { label: 'System', value: 'system' },
  { label: 'Alerts', value: 'alerts' },
];

const SEVERITY_DOT: Record<MergedNotification['severity'], string> = {
  info:    'bg-pf-cyan-400',
  success: 'bg-pf-success',
  warning: 'bg-pf-warning',
  error:   'bg-pf-danger',
};

const TRADE_KEYWORDS = ['trade', 'buy', 'sell', 'position', 'order', 'fill', 'market'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diffMs  = Date.now() - timestamp;
  const diffS   = Math.floor(diffMs / 1000);
  if (diffS < 60)          return 'Just now';
  const diffMin = Math.floor(diffS / 60);
  if (diffMin < 60)        return `${diffMin} min ago`;
  const diffHr  = Math.floor(diffMin / 60);
  if (diffHr < 24)         return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

function inferCategory(n: NotificationItem): MergedNotification['category'] {
  const lower = (n.title + ' ' + (n.body ?? '')).toLowerCase();
  if (TRADE_KEYWORDS.some((kw) => lower.includes(kw))) return 'trade';
  if (n.severity === 'warning' || n.severity === 'error') return 'alert';
  return 'general';
}

function serverToMerged(n: ServerNotification): MergedNotification {
  return {
    id:        n.id,
    title:     n.title,
    body:      n.body,
    category:  n.category,
    severity:  n.severity,
    read:      n.read,
    timestamp: new Date(n.createdAt).getTime(),
    actionUrl: n.actionUrl,
    source:    'server',
  };
}

function storeToMerged(n: NotificationItem): MergedNotification {
  return {
    id:       n.id,
    title:    n.title,
    body:     n.body ?? '',
    category: inferCategory(n),
    severity: n.severity,
    read:     n.read,
    timestamp: n.timestamp,
    source:   'store',
  };
}

function mergeNotifications(
  server: ServerNotification[],
  store: NotificationItem[],
): MergedNotification[] {
  const map = new Map<string, MergedNotification>();
  for (const n of server) map.set(n.id, serverToMerged(n));
  for (const n of store) {
    if (!map.has(n.id)) map.set(n.id, storeToMerged(n));
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function matchesTab(n: MergedNotification, tab: FilterTab): boolean {
  switch (tab) {
    case 'all':    return true;
    case 'unread': return !n.read;
    case 'trades': return n.category === 'trade';
    case 'system': return n.category === 'system';
    case 'alerts': return n.category === 'alert';
  }
}

// ---------------------------------------------------------------------------
// Category icon
// ---------------------------------------------------------------------------

function CategoryIcon({ category }: { category: MergedNotification['category'] }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (category) {
    case 'trade':
      return <TrendingUp className={`${cls} text-pf-cyan-400`} />;
    case 'system':
      return <Settings className={`${cls} text-pf-text-secondary`} />;
    case 'alert':
      return <Bell className={`${cls} text-pf-warning`} />;
    case 'social':
      return <Users className={`${cls} text-pf-info`} />;
    case 'general':
    default:
      return <Info className={`${cls} text-pf-text-muted`} />;
  }
}

// ---------------------------------------------------------------------------
// NotificationCard
// ---------------------------------------------------------------------------

interface NotificationCardProps {
  item: MergedNotification;
  onRead: (id: string, source: MergedNotification['source']) => void;
  onDelete: (id: string, source: MergedNotification['source']) => void;
}

function NotificationCard({ item, onRead, onDelete }: NotificationCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={[
        'relative w-full flex items-start gap-3 rounded-lg border border-pf-border px-4 py-3',
        'transition-colors group',
        item.read ? 'bg-pf-surface' : 'bg-pf-cyan-500/5',
      ].join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button — visible on hover */}
      {hovered && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete notification"
          onClick={() => onDelete(item.id, item.source)}
          className={[
            'absolute top-2 right-2 p-0.5 rounded text-pf-text-muted',
            'hover:text-pf-danger transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-400',
          ].join(' ')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Severity dot */}
      <span className="mt-1.5 shrink-0">
        <span className={`block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[item.severity]}`} />
      </span>

      {/* Main content — clickable for read */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => onRead(item.id, item.source)}
        className={[
          'min-w-0 flex-1 text-left',
          'focus-visible:outline-none',
        ].join(' ')}
      >
        {/* Title row with category icon */}
        <span className="flex items-center gap-1.5">
          <CategoryIcon category={item.category} />
          <span className="font-medium text-pf-text-primary leading-snug truncate">
            {item.title}
          </span>
        </span>

        <span className="block text-sm text-pf-text-muted mt-0.5 leading-relaxed">
          {item.body}
        </span>

        <span className="block text-xs text-pf-text-muted mt-1">
          {relativeTime(item.timestamp)}
        </span>
      </Button>

      {/* Right column: unread dot + action link */}
      <span className="flex flex-col items-end gap-2 shrink-0 mt-1">
        {!item.read && (
          <span className="block h-2 w-2 rounded-full bg-pf-cyan-400" />
        )}
        {item.actionUrl && (
          <Link
            to={item.actionUrl}
            onClick={(e) => e.stopPropagation()}
            className={[
              'text-xs font-medium text-pf-cyan-400 hover:text-pf-cyan-300',
              'transition-colors whitespace-nowrap',
            ].join(' ')}
          >
            View &rarr;
          </Link>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Component() {
  const storeItems   = useNotificationStore((s) => s.items);
  const markRead     = useNotificationStore((s) => s.markRead);
  const markAllRead  = useNotificationStore((s) => s.markAllRead);

  const [activeTab,      setActiveTab]      = useState<FilterTab>('all');
  const [serverItems,    setServerItems]    = useState<ServerNotification[]>([]);
  const [serverTotal,    setServerTotal]    = useState(0);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [deletedIds,     setDeletedIds]     = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Fetch notifications from server
  // -------------------------------------------------------------------------

  const fetchPage = useCallback(async (page: number, append = false) => {
    try {
      const res = await fetch(`/api/v1/notifications?page=${page}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as {
        data: ServerNotification[];
        total: number;
        unreadCount: number;
      };
      setServerItems((prev) => append ? [...prev, ...json.data] : json.data);
      setServerTotal(json.total);
      setCurrentPage(page);
    } catch {
      toast.error('Failed to load notifications from server');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPage(1).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1);
    setRefreshing(false);
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await fetchPage(currentPage + 1, true);
    setLoadingMore(false);
  }, [fetchPage, currentPage]);

  // -------------------------------------------------------------------------
  // Merge + filter
  // -------------------------------------------------------------------------

  const merged = mergeNotifications(serverItems, storeItems).filter(
    (n) => !deletedIds.has(n.id),
  );

  const unreadCount = merged.filter((n) => !n.read).length;
  const filtered    = merged.filter((n) => matchesTab(n, activeTab));

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRead = useCallback(async (id: string, source: MergedNotification['source']) => {
    // Always update store (no-op if not in store)
    markRead(id);

    if (source === 'server') {
      try {
        await fetch(`/api/v1/notifications/${id}/read`, { method: 'POST' });
        setServerItems((prev) =>
          prev.map((n) => n.id === id ? { ...n, read: true } : n),
        );
      } catch {
        toast.error('Could not mark notification as read');
      }
    }
  }, [markRead]);

  const handleMarkAllRead = useCallback(async () => {
    markAllRead();
    try {
      await fetch('/api/v1/notifications/read-all', { method: 'POST' });
      setServerItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      toast.error('Could not mark all notifications as read on the server');
    }
  }, [markAllRead]);

  const handleDelete = useCallback(async (id: string, source: MergedNotification['source']) => {
    setDeletedIds((prev) => new Set(prev).add(id));

    if (source === 'server') {
      try {
        await fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' });
        setServerItems((prev) => prev.filter((n) => n.id !== id));
        setServerTotal((prev) => Math.max(0, prev - 1));
      } catch {
        // Rollback optimistic delete
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error('Could not delete notification');
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="animate-fade-in flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pf-text-primary">Notifications</h1>
          <p className="text-sm text-pf-text-muted mt-0.5">
            Real-time alerts and system messages
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh notifications"
            className={[
              'p-1.5 rounded text-pf-text-muted hover:text-pf-text-primary',
              'transition-colors focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-pf-cyan-400 disabled:opacity-50',
            ].join(' ')}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          {/* Mark all read */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleMarkAllRead}
            className={[
              'text-sm font-medium text-pf-cyan-400 hover:text-pf-cyan-300',
              'transition-colors focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-pf-cyan-400 rounded px-2 py-1',
            ].join(' ')}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-pf-text-muted">
        <span>
          <span className="font-medium text-pf-text-primary">{unreadCount}</span> unread
        </span>
        <span className="text-pf-border">&middot;</span>
        <span>
          <span className="font-medium text-pf-text-primary">{merged.length}</span> total
        </span>
        {loading && (
          <>
            <span className="text-pf-border">&middot;</span>
            <span className="text-pf-text-muted italic">Loading…</span>
          </>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-pf-border">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant="ghost"
            onClick={() => setActiveTab(tab.value)}
            className={[
              'px-3 py-2 text-sm font-medium rounded-t transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-400',
              activeTab === tab.value
                ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400 -mb-px'
                : 'text-pf-text-muted hover:text-pf-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Notification list or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-pf-text-muted">
          <Bell className="h-10 w-10 opacity-40" />
          <p className="text-base font-medium">No notifications yet</p>
          <p className="text-sm">Real-time alerts will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onRead={handleRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination info + load more */}
      {merged.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-pf-border">
          <p className="text-xs text-pf-text-muted">
            Showing{' '}
            <span className="font-medium text-pf-text-primary">{merged.length}</span>
            {serverTotal > 0 && (
              <>
                {' '}of{' '}
                <span className="font-medium text-pf-text-primary">{serverTotal}</span>
              </>
            )}{' '}
            notifications
          </p>

          {serverTotal > merged.length && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={[
                'text-sm font-medium text-pf-cyan-400 hover:text-pf-cyan-300',
                'transition-colors focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-pf-cyan-400 rounded px-2 py-1',
                'disabled:opacity-50',
              ].join(' ')}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
