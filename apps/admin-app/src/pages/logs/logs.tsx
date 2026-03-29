import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type LogTab = 'audit' | 'events' | 'logins';

export function Component() {
  const [tab, setTab] = useState<LogTab>('audit');
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res: any;
      if (tab === 'audit') res = await adminApi.auditLogs({ page, limit });
      else if (tab === 'events') res = await adminApi.eventLogs({ page, limit });
      else res = await adminApi.loginLogs({ page, limit });
      setLogs(res.data ?? []);
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
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">Logs</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-1 w-fit" role="tablist" aria-label="Log type">
        {tabs.map((t) => (
          <button type="button"
            key={t.key}
            id={`tab-${t.key}`}
            onClick={() => changeTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            className={`px-4 py-1.5 text-sm rounded-pf-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)] ${
              tab === t.key
                ? 'bg-[var(--color-pf-cyan-500)]/10 text-[var(--color-pf-cyan-500)] font-medium'
                : 'text-[var(--color-pf-text-secondary)] hover:text-[var(--color-pf-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Log Table */}
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">System logs</caption>
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Timestamp</th>
                {tab === 'audit' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Action</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Target</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">IP</th>
                  </>
                )}
                {tab === 'events' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Type</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Details</th>
                  </>
                )}
                {tab === 'logins' && (
                  <>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">User</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">IP</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                    <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Reason</th>
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
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'audit' ? 4 : tab === 'logins' ? 5 : 3} className="text-center py-12">
                    <ScrollText className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} aria-hidden="true" />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No logs found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">System logs will appear here</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)] whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    {tab === 'audit' && (
                      <>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-pf-bg)] text-[var(--color-pf-cyan-500)] border border-[var(--color-pf-border)]">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">
                          {log.target && `${log.target}`}
                          {log.targetId && ` #${log.targetId.slice(0, 8)}`}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-pf-text-tertiary)]">{log.ip ?? '-'}</td>
                      </>
                    )}
                    {tab === 'events' && (
                      <>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-pf-purple-500)]/10 text-[var(--color-pf-purple-500)]">
                            {log.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-pf-text-secondary)] max-w-[300px] font-mono text-xs">
                          <details className="cursor-pointer">
                            <summary className="truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">{JSON.stringify(log.payload)}</summary>
                            <pre className="mt-2 p-2 bg-[var(--color-pf-bg)] rounded text-[10px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{JSON.stringify(log.payload, null, 2)}</pre>
                          </details>
                        </td>
                      </>
                    )}
                    {tab === 'logins' && (
                      <>
                        <td className="px-4 py-3 text-[var(--color-pf-text)]">{log.username}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-pf-text-tertiary)]">{log.ip}</td>
                        <td className="px-4 py-3">
                          {log.success ? (
                            <span className="text-xs text-pf-success">Success</span>
                          ) : (
                            <span className="text-xs text-pf-danger">Failed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-pf-text-tertiary)]">{log.failReason ?? '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]">
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
