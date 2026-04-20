import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type LogTab = 'audit' | 'events' | 'logins';

interface LogEntry {
  id: string;
  createdAt: string;
  action?: string;
  target?: string;
  targetId?: string;
  ip?: string;
  type?: string;
  payload?: unknown;
  username?: string;
  success?: boolean;
  failReason?: string;
  [key: string]: unknown;
}

export function Component() {
  const [tab, setTab] = useState<LogTab>('audit');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res: { data?: unknown[]; totalPages?: number };
      if (tab === 'audit') res = await adminApi.auditLogs({ page, limit });
      else if (tab === 'events') res = await adminApi.eventLogs({ page, limit });
      else res = await adminApi.loginLogs({ page, limit });
      setLogs((res.data ?? []) as LogEntry[]);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  function changeTab(t: LogTab) {
    setTab(t);
    setPage(1);
  }

  const tabs: { key: LogTab; label: string }[] = [
    { key: 'audit', label: 'Audit' },
    { key: 'events', label: 'Events' },
    { key: 'logins', label: 'Logins' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-primary">Logs</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated border border-default rounded-pf p-1 w-fit" role="tablist" aria-label="Log type">
        {tabs.map((t) => (
          <Button type="button"
            key={t.key}
            id={`tab-${t.key}`}
            variant="ghost"
            onClick={() => changeTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            className={`px-4 py-2 text-body-sm rounded-sm transition-colors ${
              tab === t.key
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Log Table */}
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <caption className="sr-only">System logs</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Timestamp</th>
                {tab === 'audit' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Action</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Target</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">IP</th>
                  </>
                )}
                {tab === 'events' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Type</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Details</th>
                  </>
                )}
                {tab === 'logins' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">User</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">IP</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Status</th>
                    <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Reason</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: tab === 'audit' ? 4 : tab === 'logins' ? 5 : 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'audit' ? 4 : tab === 'logins' ? 5 : 3} className="text-center py-12">
                    <ScrollText className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-secondary font-medium">No logs found</p>
                    <p className="text-tertiary text-label mt-1">System logs will appear here</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-default last:border-0 hover:bg-app transition-colors">
                    <td className="px-4 py-3 text-tertiary whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    {tab === 'audit' && (
                      <>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-sm text-label font-medium bg-app text-accent border border-default">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {log.target && `${log.target}`}
                          {log.targetId && ` #${log.targetId.slice(0, 8)}`}
                        </td>
                        <td className="px-4 py-3 font-mono text-label text-tertiary">{log.ip ?? '-'}</td>
                      </>
                    )}
                    {tab === 'events' && (
                      <>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-sm text-label font-medium bg-accent-subtle text-accent">
                            {log.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary max-w-xs font-mono text-label">
                          <details className="cursor-pointer">
                            <summary className="truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{JSON.stringify(log.payload)}</summary>
                            <pre className="mt-2 p-2 bg-app rounded-sm text-caption whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{JSON.stringify(log.payload, null, 2)}</pre>
                          </details>
                        </td>
                      </>
                    )}
                    {tab === 'logins' && (
                      <>
                        <td className="px-4 py-3 text-primary">{(log as any).user?.username ?? log.username ?? ''}</td>
                        <td className="px-4 py-3 font-mono text-label text-tertiary">{log.ip}</td>
                        <td className="px-4 py-3">
                          {log.success ? (
                            <span className="text-label text-gain">Success</span>
                          ) : (
                            <span className="text-label text-loss">Failed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-label text-tertiary">{log.failReason ?? '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-caption text-tertiary">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={16} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
