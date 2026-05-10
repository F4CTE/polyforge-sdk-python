import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { notifyApiError } from '@/lib/api-error';
import { Button, Input, Select, Textarea } from '@polyforge/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  clearPendingIdempotencyKey,
  getOrCreatePendingIdempotencyKey,
  idempotencyHeaders,
} from '@/lib/idempotency';
import {
  ChevronLeft, ChevronRight, ClipboardList, X, Plus, Trash2, Download, Loader2,
  BookOpen, Tag, Edit2, Search,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
type FilterStatus = 'ALL' | OrderStatus;

interface Order {
  id: string;
  side: string;
  outcome: string;
  size: string;
  price: string;
  fillSize?: string;
  fillPrice?: string;
  orderType: string;
  status: OrderStatus;
  createdAt: string;
  placedAt?: string;
  filledAt?: string;
  marketQuestion?: string;
  marketId?: string;
  marketCategory?: string | null;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ConditionalOrderType = 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED';
type ConditionalOrderStatus = 'PENDING' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

interface ConditionalOrder {
  id: string;
  marketId: string;
  tokenId: string;
  type: ConditionalOrderType;
  side: string;
  outcome: string;
  size: string;
  triggerPrice: string;
  limitPrice: string | null;
  trailingPct: string | null;
  status: ConditionalOrderStatus;
  expiresAt: string | null;
  createdAt: string;
}

interface ConditionalOrdersResponse {
  data: ConditionalOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ViewTab = 'orders' | 'conditional' | 'journal';

/* ─── Journal Types ──────────────────────────────────────────────────── */

type JournalMood = 'confident' | 'uncertain' | 'fomo' | 'disciplined' | 'neutral';

interface JournalEntry {
  id: string;
  orderId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  pnl?: number;
  note: string;
  tags: string[];
  mood: JournalMood;
  createdAt: string;
  updatedAt: string;
}

interface JournalResponse {
  data: JournalEntry[];
  total: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Failed', value: 'FAILED' },
];

const STATUS_STYLES: Record<OrderStatus, { text: string; bg: string }> = {
  PENDING:   { text: 'text-warning', bg: 'bg-warning/10' },
  SUBMITTED: { text: 'text-accent-text', bg: 'bg-accent/10' },
  LIVE:      { text: 'text-accent-text', bg: 'bg-accent/10' },
  MATCHED:   { text: 'text-accent-text', bg: 'bg-accent-subtle' },
  CONFIRMED: { text: 'text-gain', bg: 'bg-gain/10' },
  CANCELLED: { text: 'text-secondary', bg: 'bg-overlay' },
  FAILED:    { text: 'text-loss', bg: 'bg-loss/10' },
};

const CONDITIONAL_TYPE_STYLES: Record<ConditionalOrderType, { text: string; bg: string; label: string }> = {
  TAKE_PROFIT:   { text: 'text-gain', bg: 'bg-gain/10', label: 'TP' },
  STOP_LOSS:     { text: 'text-loss', bg: 'bg-loss/10', label: 'SL' },
  TRAILING_STOP: { text: 'text-warning', bg: 'bg-warning/10', label: 'TRAILING' },
  LIMIT:         { text: 'text-info', bg: 'bg-info/10', label: 'LIMIT' },
  PEGGED:        { text: 'text-variable', bg: 'bg-variable-subtle', label: 'PEGGED' },
};

const CONDITIONAL_STATUS_STYLES: Record<ConditionalOrderStatus, { text: string; bg: string }> = {
  PENDING:   { text: 'text-warning', bg: 'bg-warning/10' },
  TRIGGERED: { text: 'text-gain', bg: 'bg-gain/10' },
  CANCELLED: { text: 'text-secondary', bg: 'bg-overlay' },
  EXPIRED:   { text: 'text-tertiary', bg: 'bg-overlay' },
  FAILED:    { text: 'text-loss', bg: 'bg-loss/10' },
};

/* ─── Journal Constants ──────────────────────────────────────────────── */

const MOOD_CONFIG: Record<JournalMood, { emoji: string; label: string }> = {
  confident:   { emoji: '😊', label: 'Confident' },
  uncertain:   { emoji: '🤔', label: 'Uncertain' },
  fomo:        { emoji: '😰', label: 'FOMO' },
  disciplined: { emoji: '🎯', label: 'Disciplined' },
  neutral:     { emoji: '😐', label: 'Neutral' },
};

const MOOD_KEYS = Object.keys(MOOD_CONFIG) as JournalMood[];

/* ─── Inline Journal Panel ───────────────────────────────────────────── */

interface InlineJournalPanelProps {
  order: Order;
  entry: JournalEntry | null;
  onClose: () => void;
  onSaved: (entry: JournalEntry) => void;
  onDeleted: (orderId: string) => void;
}

function InlineJournalPanel({ order, entry, onClose, onSaved, onDeleted }: InlineJournalPanelProps) {
  const [note, setNote] = useState(entry?.note ?? '');
  const [mood, setMood] = useState<JournalMood>(entry?.mood ?? 'neutral');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags(prev => prev.filter(x => x !== t));
  }

  async function handleSave() {
    if (!note.trim()) { toast.error('Note cannot be empty'); return; }
    setSaving(true);
    try {
      const isNew = !entry;
      const url = isNew ? '/api/v1/journal' : `/api/v1/journal/${entry.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const body = isNew
        ? { orderId: order.id, note, tags, mood }
        : { note, tags, mood };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved: JournalEntry = await res.json();
        toast.success(isNew ? 'Journal note saved' : 'Journal note updated');
        onSaved(saved);
        onClose();
      } else {
        toast.error('Failed to save journal note');
      }
    } catch {
      toast.error('Failed to save journal note');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!entry) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/journal/${entry.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Journal note deleted');
        onDeleted(order.id);
        onClose();
      } else {
        toast.error('Failed to delete journal note');
      }
    } catch {
      toast.error('Failed to delete journal note');
    }
    setDeleting(false);
  }

  return (
    <tr>
      <td colSpan={12} className="px-0 py-0">
        <div className="mx-4 my-1 rounded-pf border border-accent/30 bg-surface p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent-text" />
              <span className="text-body-md font-medium text-primary">Journal Note</span>
              {entry && <span className="text-caption text-tertiary">Last updated {formatDate(entry.updatedAt)}</span>}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close journal panel">
              <X className="size-4" />
            </Button>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-label text-secondary mb-1">How did this trade go?</label>
            <Textarea
              ref={textareaRef}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Record your reasoning, what you observed, or what you'd do differently..."
              className="w-full px-3 py-2 rounded-pf bg-elevated border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 resize-none"
            />
          </div>

          {/* Mood selector */}
          <div>
            <span className="block text-label text-secondary mb-2">Mood</span>
            <div className="flex flex-wrap gap-2">
              {MOOD_KEYS.map(m => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  onClick={() => setMood(m)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label font-medium border transition-colors ${
                    mood === m
                      ? 'bg-accent-subtle text-accent-text border-accent/40'
                      : 'bg-elevated text-secondary border-default hover:border-strong'
                  }`}
                >
                  <span>{MOOD_CONFIG[m].emoji}</span>
                  {MOOD_CONFIG[m].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className="block text-label text-secondary mb-2">Tags</span>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-label bg-variable-subtle text-variable-text border border-variable/30">
                  <Tag className="size-3" />
                  {t}
                  <Button type="button" variant="ghost" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} className="hover:text-loss transition-colors ml-1">
                    <X className="size-3" />
                  </Button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="+ add tag"
                  className="h-6 px-2 rounded-full bg-elevated border border-default text-label text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 w-24"
                />
                <Button type="button" variant="ghost" onClick={addTag} className="text-label text-accent-text hover:text-accent-text transition-colors">Add</Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-subtle">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 rounded-pf bg-accent text-inverse text-label font-medium hover:bg-accent-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : null}
              Save Note
            </Button>
            {entry && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 rounded-pf bg-loss/10 text-loss text-label font-medium border border-loss/20 hover:bg-loss/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Delete
              </Button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─── Journal Tab Content ────────────────────────────────────────────── */

interface JournalTabProps {
  entries: JournalEntry[];
  loading: boolean;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

function JournalEntryCard({ entry, onEdit, onDelete }: { entry: JournalEntry; onEdit: () => void; onDelete: () => void }) {
  const mood = MOOD_CONFIG[entry.mood];
  return (
    <div className="bg-elevated border border-default rounded-pf p-4 space-y-3 hover:border-default transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-medium text-primary line-clamp-1">{entry.marketTitle || `Order ${entry.orderId.slice(0, 8)}`}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-2 py-1 rounded-sm text-caption font-medium ${entry.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
              {entry.side}
            </span>
            <span className={`inline-flex px-2 py-1 rounded-sm text-caption font-medium ${entry.outcome === 'YES' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
              {entry.outcome}
            </span>
            <span className="font-mono text-caption text-tertiary">{entry.size} @ {entry.price}</span>
            {entry.pnl !== undefined && (
              <span className={`font-mono text-caption font-medium ${entry.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)} PnL
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit journal note">
            <Edit2 className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete journal note">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Mood + note */}
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0" title={mood.label}>{mood.emoji}</span>
        <p className="text-label text-secondary line-clamp-2 leading-relaxed">{entry.note}</p>
      </div>

      {/* Tags + date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {entry.tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-caption bg-variable-subtle text-variable-text border border-variable/20">
              <Tag className="size-2" />{t}
            </span>
          ))}
        </div>
        <span className="font-mono text-caption text-tertiary shrink-0">{formatDate(entry.createdAt)}</span>
      </div>
    </div>
  );
}

function JournalTab({ entries, loading, onEdit, onDelete }: JournalTabProps) {
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<JournalMood | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState('');

  const allTags = Array.from(new Set(entries.flatMap(e => e.tags))).sort();

  const filtered = entries.filter(e => {
    if (moodFilter !== 'ALL' && e.mood !== moodFilter) return false;
    if (tagFilter && !e.tags.includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.note.toLowerCase().includes(q) || e.marketTitle.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes or markets..."
            className="w-full h-9 pl-8 pr-3 rounded-pf bg-elevated border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50"
          />
        </div>
        {allTags.length > 0 && (
          <Select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="h-9 px-2 rounded-pf bg-elevated border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50"
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {/* Mood filter pills */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMoodFilter('ALL')}
          className={`px-3 py-1 rounded-full text-label font-medium border transition-colors ${
            moodFilter === 'ALL'
              ? 'bg-accent-subtle text-accent-text border-accent/30'
              : 'bg-elevated text-secondary border-default hover:border-strong'
          }`}
        >
          All moods
        </Button>
        {MOOD_KEYS.map(m => (
          <Button
            key={m}
            type="button"
            variant="ghost"
            onClick={() => setMoodFilter(moodFilter === m ? 'ALL' : m)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label font-medium border transition-colors ${
              moodFilter === m
                ? 'bg-accent-subtle text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
            }`}
          >
            {MOOD_CONFIG[m].emoji} {MOOD_CONFIG[m].label}
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-elevated border border-default rounded-pf p-4 space-y-3 animate-pulse">
              <div className="h-3 bg-overlay rounded-sm w-3/4" />
              <div className="h-3 bg-overlay rounded-sm w-1/2" />
              <div className="h-8 bg-overlay rounded-sm" />
              <div className="h-3 bg-overlay rounded-sm w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="size-10 text-tertiary mb-3" />
          <p className="text-body-md font-medium text-primary">
            {entries.length === 0 ? 'No journal entries yet' : 'No entries match your filters'}
          </p>
          <p className="text-label text-tertiary mt-1">
            {entries.length === 0
              ? 'Click the journal icon on any order to add your first note.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(entry => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Category Badge ─────────────────────────────────────────────────── */

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    crypto: 'bg-gold-500/15 text-gold-500 border-gold-500/30',
    politics: 'bg-info-subtle text-info border-info/30',
    sports: 'bg-gain-subtle text-gain border-gain/30',
    entertainment: 'bg-variable-subtle text-variable-text border-variable/30',
    science: 'bg-accent-subtle text-accent-text border-accent/30',
  };
  const key = category.toLowerCase();
  const cls = colors[key] ?? 'bg-surface text-tertiary border-default';
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-sm text-caption font-medium border ${cls}`}>
      {category}
    </span>
  );
}

function fillRatio(order: Order): string {
  const total = parseFloat(order.size);
  if (!total) return '\u2014';
  return `${order.fillSize ?? '0'} / ${order.size}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/* ─── Create Conditional Order Dialog ────────────────────────────────── */

function CreateConditionalDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    marketId: '',
    tokenId: '',
    type: 'TAKE_PROFIT' as ConditionalOrderType,
    side: 'BUY',
    outcome: 'YES',
    size: '',
    triggerPrice: '',
    limitPrice: '',
    trailingPct: '',
    expiresAt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [positions, setPositions] = useState<Array<{ id: string; marketId: string; tokenId: string; marketTitle: string; outcome: string; size: string }>>([]);

  useEffect(() => {
    fetch('/api/v1/portfolio', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.positions) setPositions(data.positions); })
      .catch(err => { notifyApiError(err, 'load positions'); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        marketId: form.marketId,
        tokenId: form.tokenId,
        type: form.type,
        side: form.side,
        outcome: form.outcome,
        size: form.size,
        triggerPrice: form.triggerPrice,
      };
      if (form.limitPrice) body.limitPrice = form.limitPrice;
      if (form.trailingPct) body.trailingPct = form.trailingPct;
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();

      const idempotencyKey = getOrCreatePendingIdempotencyKey(idempotencyKeyRef, 'orders-conditional-order');
      const res = await fetch('/api/v1/orders/conditional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idempotencyHeaders(idempotencyKey) },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Conditional order created');
        onCreated();
        onClose();
      } else {
        toast.error('Failed to create conditional order');
      }
    } catch {
      toast.error('Failed to create conditional order');
    } finally {
      clearPendingIdempotencyKey(idempotencyKeyRef);
      setSubmitting(false);
    }
  }

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create Conditional Order">
      <div className="animate-scale-in bg-elevated border border-default rounded-pf w-full max-w-lg p-6 shadow-elevation-3">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-primary">Create Conditional Order</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="size-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="cond-market-select" className="block text-label font-medium text-secondary mb-1">Market</label>
              <Select id="cond-market-select" value={form.marketId} onChange={e => {
                const mkt = positions.find(p => p.marketId === e.target.value);
                updateField('marketId', e.target.value);
                if (mkt) updateField('tokenId', mkt.tokenId);
              }} required className="w-full h-9 px-2 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50">
                <option value="">Select from your positions...</option>
                {positions.map(p => (
                  <option key={p.id} value={p.marketId}>
                    {p.marketTitle || p.marketId.slice(0, 12)} — {p.outcome} ({p.size})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="cond-token-id" className="block text-label font-medium text-secondary mb-1">Token</label>
              <Input id="cond-token-id" value={form.tokenId} readOnly
                className="w-full h-9 px-3 rounded-pf bg-overlay border border-default text-body-sm text-secondary cursor-not-allowed font-mono text-label" />
              <p className="text-caption text-tertiary mt-1">Auto-filled from selected position</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-type" className="block text-label font-medium text-secondary mb-1">Type</label>
              <Select id="cond-type" value={form.type} onChange={e => updateField('type', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50">
                <option value="TAKE_PROFIT">Take Profit</option>
                <option value="STOP_LOSS">Stop Loss</option>
                <option value="TRAILING_STOP">Trailing Stop</option>
                <option value="LIMIT">Limit</option>
                <option value="PEGGED">Pegged</option>
              </Select>
            </div>
            <div>
              <label htmlFor="cond-side" className="block text-label font-medium text-secondary mb-1">Side</label>
              <Select id="cond-side" value={form.side} onChange={e => updateField('side', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50">
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </Select>
            </div>
            <div>
              <label htmlFor="cond-outcome" className="block text-label font-medium text-secondary mb-1">Outcome</label>
              <Select id="cond-outcome" value={form.outcome} onChange={e => updateField('outcome', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50">
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cond-size" className="block text-label font-medium text-secondary mb-1">Size</label>
              <Input id="cond-size" type="number" step="any" value={form.size} onChange={e => updateField('size', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50" />
            </div>
            <div>
              <label htmlFor="cond-trigger-price" className="block text-label font-medium text-secondary mb-1">Trigger Price</label>
              <Input id="cond-trigger-price" type="number" step="any" value={form.triggerPrice} onChange={e => updateField('triggerPrice', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-limit-price" className="block text-label font-medium text-secondary mb-1">Limit Price</label>
              <Input id="cond-limit-price" type="number" step="any" value={form.limitPrice} onChange={e => updateField('limitPrice', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50" />
            </div>
            <div>
              <label htmlFor="cond-trailing-pct" className="block text-label font-medium text-secondary mb-1">Trailing %</label>
              <Input id="cond-trailing-pct" type="number" step="any" value={form.trailingPct} onChange={e => updateField('trailingPct', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50" />
            </div>
            <div>
              <label htmlFor="cond-expires-at" className="block text-caption font-medium text-secondary mb-1">Expires At</label>
              <input id="cond-expires-at" type="datetime-local" lang="en" value={form.expiresAt} onChange={e => updateField('expiresAt', e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-subtle">
            <Button type="button" variant="secondary" onClick={onClose} className="px-4 py-2 text-body-sm text-secondary hover:text-primary transition-colors">Cancel</Button>
            <Button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-accent text-inverse text-body-md font-medium hover:bg-accent-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus className="size-4" /> Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [viewTab, setViewTab] = useState<ViewTab>('orders');

  // ── Regular orders state ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // ── Conditional orders state ──
  const [condOrders, setCondOrders] = useState<ConditionalOrder[]>([]);
  const [condLoading, setCondLoading] = useState(true);
  const [condTotal, setCondTotal] = useState(0);
  const [condTotalPages, setCondTotalPages] = useState(0);
  const [condPage, setCondPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [pendingCancelConditionalId, setPendingCancelConditionalId] = useState<string | null>(null);
  const [cancellingConditionalId, setCancellingConditionalId] = useState<string | null>(null);

  // ── Journal state ──
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalLoaded, setJournalLoaded] = useState(false);
  // Map orderId -> JournalEntry for per-row lookup
  const [journalByOrder, setJournalByOrder] = useState<Record<string, JournalEntry>>({});
  // Which order row has its inline panel open (orderId)
  const [openJournalOrderId, setOpenJournalOrderId] = useState<string | null>(null);

  // ── Load regular orders ──
  const load = useCallback(async (p: number, f: FilterStatus) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (f !== 'ALL') params.set('status', f);
      const res = await fetch(`/api/v1/orders?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: OrdersResponse = await res.json();
        setOrders(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load orders'); }
    setLoading(false);
  }, []);

  // ── Load conditional orders ──
  const loadConditional = useCallback(async (p: number) => {
    setCondLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      const res = await fetch(`/api/v1/orders/conditional?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: ConditionalOrdersResponse = await res.json();
        setCondOrders(data.data);
        setCondTotal(data.total);
        setCondTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load conditional orders'); }
    setCondLoading(false);
  }, []);

  // ── Load journal entries ──
  const loadJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const res = await fetch('/api/v1/journal?page=1&limit=200', { credentials: 'include' });
      if (res.ok) {
        const data: JournalResponse = await res.json();
        setJournalEntries(data.data);
        const byOrder: Record<string, JournalEntry> = {};
        data.data.forEach(e => { byOrder[e.orderId] = e; });
        setJournalByOrder(byOrder);
        setJournalLoaded(true);
      }
    } catch { toast.error('Failed to load journal'); }
    setJournalLoading(false);
  }, []);

  useEffect(() => {
    if (viewTab === 'orders') load(page, filter);
  }, [page, filter, load, viewTab]);

  useEffect(() => {
    if (viewTab === 'conditional') loadConditional(condPage);
  }, [condPage, loadConditional, viewTab]);

  useEffect(() => {
    if (viewTab === 'journal' && !journalLoaded) loadJournal();
  }, [viewTab, journalLoaded, loadJournal]);

  // Pre-load journal map whenever orders tab is active (for per-row icon state)
  useEffect(() => {
    if (viewTab === 'orders' && !journalLoaded) loadJournal();
  }, [viewTab, journalLoaded, loadJournal]);

  function handleJournalSaved(entry: JournalEntry) {
    setJournalByOrder(prev => ({ ...prev, [entry.orderId]: entry }));
    setJournalEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [entry, ...prev];
    });
  }

  function handleJournalDeleted(orderId: string) {
    setJournalByOrder(prev => { const next = { ...prev }; delete next[orderId]; return next; });
    setJournalEntries(prev => prev.filter(e => e.orderId !== orderId));
  }

  async function deleteJournalEntry(entry: JournalEntry) {
    try {
      const res = await fetch(`/api/v1/journal/${entry.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Journal note deleted');
        handleJournalDeleted(entry.orderId);
      } else {
        toast.error('Failed to delete journal note');
      }
    } catch { toast.error('Failed to delete journal note'); }
  }

  function downloadCsv(rows: Order[], filename: string) {
    const headers = ['Date', 'Market', 'Side', 'Outcome', 'Size', 'Price', 'Fill Price', 'Status', 'P&L', 'Strategy'];
    const lines = rows.map(o => [
      new Date(o.createdAt).toISOString(),
      o.marketQuestion ?? o.marketId ?? '',
      o.side,
      o.outcome,
      o.size,
      o.price ?? '',
      o.fillPrice ?? '',
      o.status,
      '',
      '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const exportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      const params = new URLSearchParams({ limit: '1000' });
      if (filter !== 'ALL') params.set('status', filter);
      const res = await fetch(`/api/v1/orders?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch orders for export');
      const data: OrdersResponse = await res.json();
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(data.data, `polyforge-trades-${date}.csv`);
      toast.success(`Downloaded ${data.data.length} trades`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      toast.error(msg);
    } finally {
      setExportingCsv(false);
    }
  }, [filter]);

  function changeFilter(f: FilterStatus) {
    setFilter(f);
    setPage(1);
  }

  async function cancelOrder(id: string) {
    setCancellingOrderId(id);
    try {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Order cancelled');
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o));
        setPendingCancelOrderId(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { message?: string }).message ?? 'Failed to cancel order');
      }
    } catch { toast.error('Failed to cancel order'); }
    finally { setCancellingOrderId(null); }
  }

  async function cancelConditional(id: string) {
    setCancellingConditionalId(id);
    try {
      const res = await fetch(`/api/v1/orders/conditional/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Conditional order cancelled');
        setPendingCancelConditionalId(null);
        loadConditional(condPage);
      } else {
        toast.error('Failed to cancel order');
      }
    } catch { toast.error('Failed to cancel order'); }
    finally { setCancellingConditionalId(null); }
  }

  function openCancelOrderConfirmation(id: string) {
    setPendingCancelOrderId(id);
  }

  function openCancelConditionalConfirmation(id: string) {
    setPendingCancelConditionalId(id);
  }

  async function confirmCancelOrder() {
    if (!pendingCancelOrderId) return;
    await cancelOrder(pendingCancelOrderId);
  }

  async function confirmCancelConditional() {
    if (!pendingCancelConditionalId) return;
    await cancelConditional(pendingCancelConditionalId);
  }

  const pendingCancelOrder = orders.find(order => order.id === pendingCancelOrderId) ?? null;
  const pendingCancelConditionalOrder = condOrders.find(order => order.id === pendingCancelConditionalId) ?? null;

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Orders</h1>
        <div className="flex items-center gap-3">
          {viewTab === 'conditional' && (
            <Button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-pf bg-accent-subtle text-accent-text text-label font-medium border border-accent/30 hover:bg-accent/25 transition-colors"
            >
              <Plus className="size-3" /> New Conditional
            </Button>
          )}
          {!loading && viewTab === 'orders' && (
            <>
              <span className="text-body-sm text-tertiary">{total} orders</span>
              <Button
                type="button"
                variant="secondary"
                onClick={exportCsv}
                disabled={exportingCsv}
                className="flex items-center gap-2 px-3 py-2 rounded-pf bg-surface border border-default text-label text-secondary hover:text-primary hover:border-default transition-colors disabled:opacity-50"
              >
                {exportingCsv
                  ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  : <Download className="size-3" aria-hidden="true" />}
                Export CSV
              </Button>
            </>
          )}
          {!condLoading && viewTab === 'conditional' && <span className="text-body-sm text-tertiary">{condTotal} conditional</span>}
          {viewTab === 'journal' && !journalLoading && (
            <span className="text-body-sm text-tertiary">{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</span>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 border-b border-subtle pb-2" role="tablist" aria-label="Order type">
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={viewTab === 'orders'}
          onClick={() => setViewTab('orders')}
          className={`px-3 py-2 rounded-t text-body-md font-medium transition-colors ${
            viewTab === 'orders' ? 'text-accent-text border-b-2 border-accent-text' : 'text-secondary hover:text-primary'
          }`}
        >
          Orders
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={viewTab === 'conditional'}
          onClick={() => setViewTab('conditional')}
          className={`px-3 py-2 rounded-t text-body-md font-medium transition-colors ${
            viewTab === 'conditional' ? 'text-accent-text border-b-2 border-accent-text' : 'text-secondary hover:text-primary'
          }`}
        >
          Conditional
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={viewTab === 'journal'}
          onClick={() => setViewTab('journal')}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-t text-body-md font-medium transition-colors ${
            viewTab === 'journal' ? 'text-accent-text border-b-2 border-accent-text' : 'text-secondary hover:text-primary'
          }`}
        >
          <BookOpen className="size-4" />
          Journal
          {Object.keys(journalByOrder).length > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-accent/20 text-accent-text text-caption font-medium">
              {Object.keys(journalByOrder).length}
            </span>
          )}
        </Button>
      </div>

      {/* ─── Regular Orders Tab ──────────────────────────────── */}
      {viewTab === 'orders' && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map(f => (
              <Button
                type="button"
                variant="ghost"
                key={f.value}
                aria-pressed={filter === f.value}
                onClick={() => changeFilter(f.value)}
                className={`px-3 py-2 rounded-full text-label font-medium whitespace-nowrap border transition-colors ${
                  filter === f.value
                    ? 'bg-accent-subtle text-accent-text border-accent/30'
                    : 'bg-elevated text-secondary border-default hover:border-strong'
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-elevated border border-default rounded-pf overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-body-sm" aria-label="Orders">
                <caption className="sr-only">Orders</caption>
                <thead>
                  <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3 font-medium w-10">#</th>
                    <th scope="col" className="px-4 py-3 font-medium">Market</th>
                    <th scope="col" className="px-4 py-3 font-medium">Side</th>
                    <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Price</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right hidden md:table-cell">Filled / Total</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right hidden md:table-cell">Avg Fill</th>
                    <th scope="col" className="px-4 py-3 font-medium hidden md:table-cell">Type</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Date</th>
                    <th scope="col" className="px-4 py-3 font-medium w-20"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {loading ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 12 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-overlay rounded-sm animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ClipboardList className="size-10 text-tertiary mb-3" />
                          <p className="text-body-md font-medium text-primary">No orders found</p>
                          <p className="text-label text-tertiary mt-1">Orders placed by your strategies will appear here.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.flatMap((order, i) => {
                      const ss = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;
                      const hasNote = Boolean(journalByOrder[order.id]);
                      const isJournalOpen = openJournalOrderId === order.id;
                      const rows = [
                        <tr
                          key={order.id}
                          data-testid="order-row"
                          data-order-id={order.id}
                          tabIndex={0}
                          onClick={() => setSelectedOrder(order)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOrder(order); }}
                          className={`hover:bg-surface/50 transition-colors cursor-pointer ${isJournalOpen ? 'bg-surface/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-label text-tertiary">{(page - 1) * 25 + i + 1}</span>
                          </td>
                          <td className="px-4 py-3 max-w-col-sm">
                            <span className="text-primary text-label line-clamp-1" title={order.marketQuestion ?? order.marketId ?? ''}>
                              {order.marketQuestion || (order.marketId?.slice(0, 12)) || '—'}
                            </span>
                            <CategoryBadge category={order.marketCategory} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                              order.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                            }`}>
                              {order.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                              order.outcome === 'YES' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                            }`}>
                              {order.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{order.size}</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{order.price}</td>
                          <td className="px-4 py-3 text-right font-mono text-secondary hidden md:table-cell">{fillRatio(order)}</td>
                          <td className="px-4 py-3 text-right font-mono text-primary hidden md:table-cell">{order.fillPrice ?? '\u2014'}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="font-mono text-label text-tertiary">{order.orderType}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span data-testid="status-cell" className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${ss.bg} ${ss.text}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            <span className="font-mono text-label text-tertiary">{formatDate(order.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setOpenJournalOrderId(isJournalOpen ? null : order.id)}
                                title={hasNote ? 'Edit journal note' : 'Add journal note'}
                                aria-label={hasNote ? 'Edit journal note' : 'Add journal note'}
                                className={`p-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring ${
                                  hasNote
                                    ? 'text-accent-text hover:text-accent-text'
                                    : 'text-tertiary hover:text-accent-text'
                                }`}
                              >
                                <BookOpen className={`size-4 ${hasNote ? 'fill-accent-text/20' : ''}`} />
                              </Button>
                              {['PENDING', 'SUBMITTED', 'LIVE'].includes(order.status) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openCancelOrderConfirmation(order.id)}
                                  disabled={cancellingOrderId === order.id}
                                  title="Cancel order"
                                  aria-label="Cancel order"
                                  className="p-1 rounded-sm text-tertiary hover:text-loss transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/40"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>,
                      ];
                      if (isJournalOpen) {
                        rows.push(
                          <InlineJournalPanel
                            key={`journal-${order.id}`}
                            order={order}
                            entry={journalByOrder[order.id] ?? null}
                            onClose={() => setOpenJournalOrderId(null)}
                            onSaved={handleJournalSaved}
                            onDeleted={handleJournalDeleted}
                          />
                        );
                      }
                      return rows;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span data-testid="page-info" className="text-body-sm font-mono text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ─── Conditional Orders Tab ──────────────────────────── */}
      {viewTab === 'conditional' && (
        <>
          <div className="bg-elevated border border-default rounded-pf overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm" aria-label="Conditional orders">
                <caption className="sr-only">Conditional orders</caption>
                <thead>
                  <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3 font-medium">Type</th>
                    <th scope="col" className="px-4 py-3 font-medium">Market</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Trigger</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                    <th scope="col" className="px-4 py-3 font-medium">Side</th>
                    <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Expires</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Created</th>
                    <th scope="col" className="px-4 py-3 font-medium w-10"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {condLoading ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-overlay rounded-sm animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : condOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ClipboardList className="size-10 text-tertiary mb-3" />
                          <p className="text-body-md font-medium text-primary">No conditional orders</p>
                          <p className="text-label text-tertiary mt-1">Set up take profit, stop loss, or trailing stop orders.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    condOrders.map((co) => {
                      const ts = CONDITIONAL_TYPE_STYLES[co.type] ?? CONDITIONAL_TYPE_STYLES.LIMIT;
                      const cs = CONDITIONAL_STATUS_STYLES[co.status] ?? CONDITIONAL_STATUS_STYLES.PENDING;
                      return (
                        <tr key={co.id} data-testid="order-row" data-order-id={co.id} className="hover:bg-surface/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${ts.bg} ${ts.text}`}>
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-label text-tertiary">{co.marketId.slice(0, 8)}...</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{co.triggerPrice}</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{co.size}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                              co.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                            }`}>
                              {co.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                              co.outcome === 'YES' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                            }`}>
                              {co.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${cs.bg} ${cs.text}`}>
                              {co.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-label text-tertiary">
                              {co.expiresAt ? formatDate(co.expiresAt) : '\u2014'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-label text-tertiary">{formatDate(co.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {co.status === 'PENDING' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                data-testid={`cancel-order-${co.id}`}
                                onClick={() => openCancelConditionalConfirmation(co.id)}
                                disabled={cancellingConditionalId === co.id}
                                aria-label="Cancel conditional order"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conditional Pagination */}
          {condTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCondPage(p => Math.max(1, p - 1))}
                disabled={condPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-body-sm font-mono text-secondary" aria-live="polite">Page {condPage} of {condTotalPages}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCondPage(p => Math.min(condTotalPages, p + 1))}
                disabled={condPage === condTotalPages}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ─── Journal Tab ─────────────────────────────────────── */}
      {viewTab === 'journal' && (
        <JournalTab
          entries={journalEntries}
          loading={journalLoading}
          onEdit={(entry) => {
            // Switch to orders tab and open inline panel for that order
            // Build a synthetic order reference for edit — open inline panel via orderId
            setOpenJournalOrderId(entry.orderId);
            setViewTab('orders');
          }}
          onDelete={deleteJournalEntry}
        />
      )}

      {/* Order detail dialog */}
      <ConfirmDialog
        open={pendingCancelOrderId !== null}
        title="Cancel order?"
        description="This cancels the selected open order. If it has already filled or is being matched, cancellation may not complete."
        confirmLabel="Cancel order"
        tone="danger"
        isLoading={cancellingOrderId !== null}
        onConfirm={confirmCancelOrder}
        onCancel={() => setPendingCancelOrderId(null)}
      >
        {pendingCancelOrder && (
          <div className="rounded-sm border border-subtle bg-surface px-3 py-2 text-body-sm">
            <div className="flex justify-between gap-3">
              <span className="text-secondary">Order</span>
              <span className="font-medium text-primary">{pendingCancelOrder.side} {pendingCancelOrder.outcome}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-secondary">Size</span>
              <span className="font-mono text-primary">{pendingCancelOrder.size}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-secondary">Price</span>
              <span className="font-mono text-primary">{pendingCancelOrder.price}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingCancelConditionalId !== null}
        title="Cancel conditional order?"
        description="This cancels the selected conditional order before it triggers. Active market orders already created from a trigger are not cancelled here."
        confirmLabel="Cancel order"
        tone="danger"
        isLoading={cancellingConditionalId !== null}
        onConfirm={confirmCancelConditional}
        onCancel={() => setPendingCancelConditionalId(null)}
      >
        {pendingCancelConditionalOrder && (
          <div className="rounded-sm border border-subtle bg-surface px-3 py-2 text-body-sm">
            <div className="flex justify-between gap-3">
              <span className="text-secondary">Order</span>
              <span className="font-medium text-primary">{pendingCancelConditionalOrder.side} {pendingCancelConditionalOrder.outcome}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-secondary">Type</span>
              <span className="font-mono text-primary">{pendingCancelConditionalOrder.type}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-secondary">Trigger</span>
              <span className="font-mono text-primary">{pendingCancelConditionalOrder.triggerPrice}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" role="dialog" aria-modal="true" aria-label="Order Details">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="animate-slide-right relative w-full max-w-md h-full bg-surface border-l border-default overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
              <h2 className="text-lg font-semibold text-primary">Order Details</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedOrder(null)} aria-label="Close order details">
                <X className="size-5" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {([
                { label: 'Order ID', value: <span className="font-mono text-label">{selectedOrder.id.slice(0, 8)}...</span> },
                { label: 'Side', value: (
                  <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                    selectedOrder.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                  }`}>{selectedOrder.side}</span>
                )},
                { label: 'Outcome', value: (
                  <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                    selectedOrder.outcome === 'YES' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                  }`}>{selectedOrder.outcome}</span>
                )},
                { label: 'Size', value: <span className="font-mono">{selectedOrder.size}</span> },
                { label: 'Price', value: <span className="font-mono">{selectedOrder.price}</span> },
                { label: 'Fill Price', value: <span className="font-mono">{selectedOrder.fillPrice ?? '\u2014'}</span> },
                { label: 'Filled', value: <span className="font-mono">{fillRatio(selectedOrder)}</span> },
                { label: 'Type', value: selectedOrder.orderType },
                { label: 'Status', value: (() => {
                  const ss = STATUS_STYLES[selectedOrder.status] ?? STATUS_STYLES.PENDING;
                  return <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${ss.bg} ${ss.text}`}>{selectedOrder.status}</span>;
                })() },
                { label: 'Created', value: <span className="font-mono text-caption">{formatDate(selectedOrder.placedAt ?? selectedOrder.createdAt)}</span> },
              ] as { label: string; value: React.ReactNode }[]).map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
                  <span className="text-body-sm text-secondary">{row.label}</span>
                  <span className="text-body-md text-primary">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create conditional order dialog */}
      {showCreateDialog && (
        <CreateConditionalDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => loadConditional(condPage)}
        />
      )}
    </div>
  );
}
