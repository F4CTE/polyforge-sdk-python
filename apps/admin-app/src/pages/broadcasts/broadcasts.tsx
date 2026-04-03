import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Input, Textarea } from '@polyforge/ui';
import {
  Megaphone,
  Send,
  Users,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'PROMO';
  targetAudience: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'PREMIUM';
  sentAt: string;
  recipientCount: number;
  sentBy: string;
}

interface BroadcastDraft {
  title: string;
  message: string;
  type: Broadcast['type'];
  targetAudience: Broadcast['targetAudience'];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: Broadcast['type']; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PROMO', label: 'Promo' },
];

const AUDIENCE_OPTIONS: { value: Broadcast['targetAudience']; label: string; description: string }[] = [
  { value: 'ALL', label: 'All', description: 'All registered users' },
  { value: 'ACTIVE', label: 'Active', description: 'Users active in last 30 days' },
  { value: 'INACTIVE', label: 'Inactive', description: 'Users inactive 30+ days' },
  { value: 'PREMIUM', label: 'Premium', description: 'Users with premium subscription' },
];

// Estimated reach per audience (placeholder values)
const AUDIENCE_REACH: Record<Broadcast['targetAudience'], number> = {
  ALL: 2400,
  ACTIVE: 1800,
  INACTIVE: 600,
  PREMIUM: 320,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function typeBadgeClass(type: Broadcast['type']): string {
  switch (type) {
    case 'INFO':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'WARNING':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'SUCCESS':
      return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'PROMO':
      return 'bg-pf-cyan-500/10 text-pf-cyan-400 border border-pf-cyan-500/20';
  }
}

function typePillClass(type: Broadcast['type'], selected: boolean): string {
  if (!selected) {
    return 'border border-pf-border bg-pf-base text-pf-text-secondary hover:text-pf-text hover:border-pf-text-secondary transition-colors';
  }
  switch (type) {
    case 'INFO':
      return 'border border-blue-500/40 bg-blue-500/10 text-blue-400';
    case 'WARNING':
      return 'border border-amber-500/40 bg-amber-500/10 text-amber-400';
    case 'SUCCESS':
      return 'border border-green-500/40 bg-green-500/10 text-green-400';
    case 'PROMO':
      return 'border border-pf-cyan-500/40 bg-pf-cyan-500/10 text-pf-cyan-400';
  }
}

function TypeIcon({ type, size = 14 }: { type: Broadcast['type']; size?: number }) {
  switch (type) {
    case 'INFO':
      return <Info size={size} aria-hidden="true" />;
    case 'WARNING':
      return <AlertTriangle size={size} aria-hidden="true" />;
    case 'SUCCESS':
      return <CheckCircle2 size={size} aria-hidden="true" />;
    case 'PROMO':
      return <Megaphone size={size} aria-hidden="true" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Megaphone className="mx-auto mb-3 text-pf-text-tertiary opacity-30" size={44} aria-hidden="true" />
      <p className="text-pf-text-secondary font-medium">No broadcasts sent yet</p>
      <p className="text-pf-text-tertiary text-xs mt-1">Use the compose panel above to send your first broadcast</p>
    </div>
  );
}

// ─── Skeleton Row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-pf-border">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-pf-base rounded animate-pulse" style={{ width: `${60 + (i * 7) % 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_DRAFT: BroadcastDraft = {
  title: '',
  message: '',
  type: 'INFO',
  targetAudience: 'ALL',
};

export function Component() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState<BroadcastDraft>(EMPTY_DRAFT);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function loadBroadcasts() {
    setLoading(true);
    try {
      const res = await adminApi.broadcasts({ page: 1, limit: 20 });
      setBroadcasts(res.data);
    } catch {
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }

  function openCompose() {
    setDraft(EMPTY_DRAFT);
    setConfirmSend(false);
    setComposeOpen(true);
  }

  function closeCompose() {
    setComposeOpen(false);
    setConfirmSend(false);
  }

  function handleDraftChange(field: keyof BroadcastDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function handleSendClick() {
    if (!draft.title.trim() || !draft.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setConfirmSend(true);
  }

  async function handleConfirmSend() {
    setSending(true);
    try {
      const created = await adminApi.sendBroadcast(draft);
      setBroadcasts((prev) => [created, ...prev]);
      toast.success('Broadcast sent successfully');
      closeCompose();
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
      setConfirmSend(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(null);
    try {
      await adminApi.deleteBroadcast(id);
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      toast.success('Broadcast record deleted');
    } catch {
      toast.error('Failed to delete broadcast');
    }
  }

  const estimatedReach = AUDIENCE_REACH[draft.targetAudience];
  const selectedAudience = AUDIENCE_OPTIONS.find((a) => a.value === draft.targetAudience);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pf-text">Broadcasts</h2>
        {!composeOpen && (
          <Button
            type="button"
            variant="default"
            onClick={openCompose}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-pf-sm bg-pf-cyan-500 text-pf-text-contrast hover:bg-pf-cyan-400 transition-colors"
          >
            <Megaphone size={15} aria-hidden="true" />
            New Broadcast
          </Button>
        )}
      </div>

      {/* Compose Panel */}
      {composeOpen && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send size={15} className="text-pf-cyan-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-pf-text">Compose Broadcast</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={closeCompose}
              className="p-1 rounded hover:bg-pf-base text-pf-text-tertiary hover:text-pf-text transition-colors"
              aria-label="Close compose panel"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="bc-title" className="block text-xs text-pf-text-tertiary mb-1">
              Title
            </label>
            <Input
              id="bc-title"
              type="text"
              value={draft.title}
              onChange={(e) => handleDraftChange('title', e.target.value)}
              placeholder="e.g. Scheduled maintenance this Sunday"
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text placeholder:text-pf-text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="bc-message" className="block text-xs text-pf-text-tertiary mb-1">
              Message
            </label>
            <Textarea
              id="bc-message"
              rows={3}
              value={draft.message}
              onChange={(e) => handleDraftChange('message', e.target.value)}
              placeholder="Write your broadcast message here..."
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text placeholder:text-pf-text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500 resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <div className="text-xs text-pf-text-tertiary mb-2">Type</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Broadcast type">
              {TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => handleDraftChange('type', opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-pf-full transition-colors ${typePillClass(opt.value, draft.type === opt.value)}`}
                  aria-pressed={draft.type === opt.value}
                >
                  <TypeIcon type={opt.value} size={12} />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <div className="text-xs text-pf-text-tertiary mb-2">Target Audience</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Target audience">
              {AUDIENCE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => handleDraftChange('targetAudience', opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-pf-full transition-colors ${
                    draft.targetAudience === opt.value
                      ? 'border border-pf-cyan-500/40 bg-pf-cyan-500/10 text-pf-cyan-400'
                      : 'border border-pf-border bg-pf-base text-pf-text-secondary hover:text-pf-text hover:border-pf-text-secondary'
                  }`}
                  aria-pressed={draft.targetAudience === opt.value}
                >
                  <Users size={12} aria-hidden="true" />
                  {opt.label}
                </Button>
              ))}
            </div>
            {selectedAudience && (
              <p className="mt-2 text-pf-label text-pf-text-tertiary">{selectedAudience.description}</p>
            )}
          </div>

          {/* Reach estimate */}
          <div className="flex items-center gap-2 text-xs text-pf-text-secondary">
            <Users size={12} className="text-pf-cyan-500" aria-hidden="true" />
            Estimated reach: <span className="font-semibold text-pf-text">~{estimatedReach.toLocaleString()} users</span>
          </div>

          {/* Confirmation warning */}
          {confirmSend && (
            <div className="rounded-pf-sm border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Confirm broadcast</p>
                  <p className="text-xs text-pf-text-secondary mt-1">
                    You are about to send to <span className="font-semibold text-pf-text">~{estimatedReach.toLocaleString()} users</span>. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleConfirmSend}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-pf-sm bg-pf-cyan-500 text-pf-text-contrast hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors"
                >
                  <Send size={12} aria-hidden="true" />
                  {sending ? 'Sending...' : 'Confirm Send'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmSend(false)}
                  disabled={sending}
                  className="px-4 py-2 text-xs font-medium rounded-pf-sm border border-pf-border bg-pf-base text-pf-text-secondary hover:text-pf-text hover:border-pf-text-secondary transition-colors"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!confirmSend && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                onClick={handleSendClick}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-pf-sm bg-pf-cyan-500 text-pf-text-contrast hover:bg-pf-cyan-400 transition-colors"
              >
                <Send size={14} aria-hidden="true" />
                Send Broadcast
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={closeCompose}
                className="px-4 py-2 text-sm font-medium rounded-pf-sm border border-pf-border bg-pf-base text-pf-text-secondary hover:text-pf-text hover:border-pf-text-secondary transition-colors"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Broadcast History */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={15} className="text-pf-cyan-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-pf-text">Broadcast History</h3>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Loading broadcasts">
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : broadcasts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Sent broadcasts</caption>
              <thead>
                <tr className="border-b border-pf-border">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Title</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Type</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Audience</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Recipients</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Sent By</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase whitespace-nowrap">Date</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((b) => (
                  <tr key={b.id} className="border-b border-pf-border last:border-0 hover:bg-pf-base/40 transition-colors">
                    <td className="px-3 py-3 text-pf-text font-medium max-w-[200px]">
                      <span className="truncate block" title={b.title}>{b.title}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-pf-label font-semibold ${typeBadgeClass(b.type)}`}>
                        <TypeIcon type={b.type} size={10} />
                        {b.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-pf-text-secondary text-xs whitespace-nowrap">{b.targetAudience}</td>
                    <td className="px-3 py-3 text-right text-pf-text-secondary tabular-nums">
                      {b.recipientCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-pf-text-secondary text-xs whitespace-nowrap">{b.sentBy}</td>
                    <td className="px-3 py-3 text-pf-text-tertiary text-xs whitespace-nowrap">{formatDate(b.sentAt)}</td>
                    <td className="px-3 py-3 text-right">
                      {deleteId === b.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => handleDelete(b.id)}
                            className="px-2 py-1 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors"
                          >
                            Delete
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setDeleteId(null)}
                            className="px-2 py-1 rounded bg-pf-elevated text-pf-text-secondary hover:bg-pf-base transition-colors"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteId(b.id)}
                          className="p-1 rounded hover:bg-pf-danger/10 text-pf-text-tertiary hover:text-pf-danger transition-colors"
                          aria-label={`Delete broadcast: ${b.title}`}
                          title="Delete broadcast record"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
