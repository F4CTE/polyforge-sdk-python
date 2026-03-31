import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/stores/notification-store';
import type { NotificationItem } from '@/stores/notification-store';

type FilterTab = 'all' | 'unread' | 'info' | 'success' | 'warning' | 'error';

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All',     value: 'all'     },
  { label: 'Unread',  value: 'unread'  },
  { label: 'Info',    value: 'info'    },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error',   value: 'error'   },
];

const SEVERITY_DOT: Record<NotificationItem['severity'], string> = {
  info:    'bg-pf-cyan-400',
  success: 'bg-pf-success',
  warning: 'bg-pf-warning',
  error:   'bg-pf-danger',
};

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffS  = Math.floor(diffMs / 1000);
  if (diffS < 60)           return 'Just now';
  const diffMin = Math.floor(diffS / 60);
  if (diffMin < 60)         return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)          return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} days ago`;
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const markRead = useNotificationStore((s) => s.markRead);

  return (
    <button
      type="button"
      onClick={() => markRead(item.id)}
      className={[
        'w-full text-left flex items-start gap-3 rounded-lg border border-pf-border px-4 py-3',
        'transition-colors hover:bg-pf-surface-hover focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-pf-cyan-400',
        item.read ? 'bg-pf-surface' : 'bg-pf-cyan-500/5',
      ].join(' ')}
    >
      {/* Severity dot */}
      <span className="mt-1.5 shrink-0">
        <span className={`block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[item.severity]}`} />
      </span>

      {/* Content */}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-pf-text-primary leading-snug">
          {item.title}
        </span>
        <span className="block text-sm text-pf-text-muted mt-0.5 leading-relaxed">
          {item.body}
        </span>
        <span className="block text-xs text-pf-text-muted mt-1">
          {relativeTime(item.timestamp)}
        </span>
      </span>

      {/* Unread indicator */}
      {!item.read && (
        <span className="mt-1.5 shrink-0">
          <span className="block h-2 w-2 rounded-full bg-pf-cyan-400" />
        </span>
      )}
    </button>
  );
}

export function Component() {
  const items      = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = items.filter((n) => {
    if (activeTab === 'all')    return true;
    if (activeTab === 'unread') return !n.read;
    return n.severity === activeTab;
  });

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
        <button
          type="button"
          onClick={markAllRead}
          className="text-sm font-medium text-pf-cyan-400 hover:text-pf-cyan-300
                     transition-colors focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-pf-cyan-400 rounded px-2 py-1"
        >
          Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-pf-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
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
          </button>
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
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
