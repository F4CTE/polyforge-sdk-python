import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button, Input, Select, Textarea } from '@polyforge/ui';
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
  PENDING:   { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  SUBMITTED: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
  LIVE:      { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
  MATCHED:   { text: 'text-pf-cyan-300', bg: 'bg-pf-cyan-500/8' },
  CONFIRMED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
  CANCELLED: { text: 'text-pf-text-secondary', bg: 'bg-pf-overlay' },
  FAILED:    { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};

const CONDITIONAL_TYPE_STYLES: Record<ConditionalOrderType, { text: string; bg: string; label: string }> = {
  TAKE_PROFIT:   { text: 'text-pf-success', bg: 'bg-pf-success/10', label: 'TP' },
  STOP_LOSS:     { text: 'text-pf-danger', bg: 'bg-pf-danger/10', label: 'SL' },
  TRAILING_STOP: { text: 'text-pf-warning', bg: 'bg-pf-warning/10', label: 'TRAILING' },
  LIMIT:         { text: 'text-pf-info', bg: 'bg-pf-info/10', label: 'LIMIT' },
  PEGGED:        { text: 'text-pf-purple-500', bg: 'bg-pf-purple-500/10', label: 'PEGGED' },
};

const CONDITIONAL_STATUS_STYLES: Record<ConditionalOrderStatus, { text: string; bg: string }> = {
  PENDING:   { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  TRIGGERED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
  CANCELLED: { text: 'text-pf-text-secondary', bg: 'bg-pf-overlay' },
  EXPIRED:   { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
  FAILED:    { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
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
        <div className="mx-4 my-1 rounded-pf border border-pf-cyan-500/30 bg-pf-surface p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-3.5 text-pf-cyan-400" />
              <span className="text-sm font-medium text-pf-text">Journal Note</span>
              {entry && <span className="text-[10px] text-pf-text-muted">Last updated {formatDate(entry.updatedAt)}</span>}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close journal panel">
              <X className="size-3.5" />
            </Button>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs text-pf-text-secondary mb-1">How did this trade go?</label>
            <Textarea
              ref={textareaRef}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Record your reasoning, what you observed, or what you'd do differently..."
              className="w-full px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 resize-none"
            />
          </div>

          {/* Mood selector */}
          <div>
            <span className="block text-xs text-pf-text-secondary mb-2">Mood</span>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_KEYS.map(m => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  onClick={() => setMood(m)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    mood === m
                      ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/40'
                      : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
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
            <span className="block text-xs text-pf-text-secondary mb-2">Tags</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-pf-purple-500/10 text-pf-purple-400 border border-pf-purple-500/30">
                  <Tag className="size-2.5" />
                  {t}
                  <Button type="button" variant="ghost" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} className="hover:text-pf-danger transition-colors ml-0.5">
                    <X className="size-2.5" />
                  </Button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="+ add tag"
                  className="h-6 px-2 rounded-full bg-pf-elevated border border-pf-border text-[11px] text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 w-24"
                />
                <Button type="button" variant="ghost" onClick={addTag} className="text-[11px] text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors">Add</Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-pf-border-subtle">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-cyan-500 text-black text-xs font-medium hover:bg-pf-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-danger/10 text-pf-danger text-xs font-medium border border-pf-danger/20 hover:bg-pf-danger/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 hover:border-pf-border-hover transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-pf-text line-clamp-1">{entry.marketTitle || `Order ${entry.orderId.slice(0, 8)}`}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`}>
              {entry.side}
            </span>
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`}>
              {entry.outcome}
            </span>
            <span className="font-mono text-[10px] text-pf-text-muted">{entry.size} @ {entry.price}</span>
            {entry.pnl !== undefined && (
              <span className={`font-mono text-[10px] font-medium ${entry.pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)} PnL
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit journal note">
            <Edit2 className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete journal note">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Mood + note */}
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0" title={mood.label}>{mood.emoji}</span>
        <p className="text-xs text-pf-text-secondary line-clamp-2 leading-relaxed">{entry.note}</p>
      </div>

      {/* Tags + date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {entry.tags.map(t => (
            <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-pf-purple-500/10 text-pf-purple-400 border border-pf-purple-500/20">
              <Tag className="size-2" />{t}
            </span>
          ))}
        </div>
        <span className="font-mono text-[10px] text-pf-text-muted shrink-0">{formatDate(entry.createdAt)}</span>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-pf-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes or markets..."
            className="w-full h-9 pl-8 pr-3 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
          />
        </div>
        {allTags.length > 0 && (
          <Select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="h-9 px-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {/* Mood filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMoodFilter('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            moodFilter === 'ALL'
              ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
              : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
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
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              moodFilter === m
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
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
            <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-pulse">
              <div className="h-3 bg-pf-overlay rounded w-3/4" />
              <div className="h-3 bg-pf-overlay rounded w-1/2" />
              <div className="h-8 bg-pf-overlay rounded" />
              <div className="h-3 bg-pf-overlay rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="size-10 text-pf-text-muted mb-3" />
          <p className="text-sm font-medium text-pf-text">
            {entries.length === 0 ? 'No journal entries yet' : 'No entries match your filters'}
          </p>
          <p className="text-xs text-pf-text-muted mt-1">
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
    crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    politics: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    sports: 'bg-green-500/15 text-green-400 border-green-500/30',
    entertainment: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };
  const key = category.toLowerCase();
  const cls = colors[key] ?? 'bg-pf-surface text-pf-text-muted border-pf-border';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
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
  const [positions, setPositions] = useState<Array<{ id: string; marketId: string; tokenId: string; marketTitle: string; outcome: string; size: string }>>([]);

  useEffect(() => {
    fetch('/api/v1/portfolio', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.positions) setPositions(data.positions); })
      .catch(() => {});
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

      const res = await fetch('/api/v1/orders/conditional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    }
    setSubmitting(false);
  }

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create Conditional Order">
      <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-lg p-6 shadow-pf-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-pf-text">Create Conditional Order</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="size-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="cond-market-select" className="block text-xs font-medium text-pf-text-secondary mb-1">Market</label>
              <Select id="cond-market-select" value={form.marketId} onChange={e => {
                const mkt = positions.find(p => p.marketId === e.target.value);
                updateField('marketId', e.target.value);
                if (mkt) updateField('tokenId', mkt.tokenId);
              }} required className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="">Select from your positions...</option>
                {positions.map(p => (
                  <option key={p.id} value={p.marketId}>
                    {p.marketTitle || p.marketId.slice(0, 12)} — {p.outcome} ({p.size})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="cond-token-id" className="block text-xs font-medium text-pf-text-secondary mb-1">Token</label>
              <Input id="cond-token-id" value={form.tokenId} readOnly
                className="w-full h-9 px-3 rounded-pf bg-pf-overlay border border-pf-border text-sm text-pf-text-secondary cursor-not-allowed font-mono text-xs" />
              <p className="text-[10px] text-pf-text-muted mt-0.5">Auto-filled from selected position</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-type" className="block text-xs font-medium text-pf-text-secondary mb-1">Type</label>
              <Select id="cond-type" value={form.type} onChange={e => updateField('type', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="TAKE_PROFIT">Take Profit</option>
                <option value="STOP_LOSS">Stop Loss</option>
                <option value="TRAILING_STOP">Trailing Stop</option>
                <option value="LIMIT">Limit</option>
                <option value="PEGGED">Pegged</option>
              </Select>
            </div>
            <div>
              <label htmlFor="cond-side" className="block text-xs font-medium text-pf-text-secondary mb-1">Side</label>
              <Select id="cond-side" value={form.side} onChange={e => updateField('side', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </Select>
            </div>
            <div>
              <label htmlFor="cond-outcome" className="block text-xs font-medium text-pf-text-secondary mb-1">Outcome</label>
              <Select id="cond-outcome" value={form.outcome} onChange={e => updateField('outcome', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cond-size" className="block text-xs font-medium text-pf-text-secondary mb-1">Size</label>
              <Input id="cond-size" type="number" step="any" value={form.size} onChange={e => updateField('size', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-trigger-price" className="block text-xs font-medium text-pf-text-secondary mb-1">Trigger Price</label>
              <Input id="cond-trigger-price" type="number" step="any" value={form.triggerPrice} onChange={e => updateField('triggerPrice', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-limit-price" className="block text-xs font-medium text-pf-text-secondary mb-1">Limit Price</label>
              <Input id="cond-limit-price" type="number" step="any" value={form.limitPrice} onChange={e => updateField('limitPrice', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-trailing-pct" className="block text-xs font-medium text-pf-text-secondary mb-1">Trailing %</label>
              <Input id="cond-trailing-pct" type="number" step="any" value={form.trailingPct} onChange={e => updateField('trailingPct', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-expires-at" className="block text-xs font-medium text-pf-text-secondary mb-1">Expires At</label>
              <input id="cond-expires-at" type="datetime-local" lang="en" value={form.expiresAt} onChange={e => updateField('expiresAt', e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-pf-border-subtle">
            <Button type="button" variant="secondary" onClick={onClose} className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors">Cancel</Button>
            <Button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus className="size-3.5" /> Create
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

  // ── Conditional orders state ──
  const [condOrders, setCondOrders] = useState<ConditionalOrder[]>([]);
  const [condLoading, setCondLoading] = useState(true);
  const [condTotal, setCondTotal] = useState(0);
  const [condTotalPages, setCondTotalPages] = useState(0);
  const [condPage, setCondPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

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
    try {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Order cancelled');
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { message?: string }).message ?? 'Failed to cancel order');
      }
    } catch { toast.error('Failed to cancel order'); }
  }

  async function cancelConditional(id: string) {
    try {
      const res = await fetch(`/api/v1/orders/conditional/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Conditional order cancelled');
        loadConditional(condPage);
      } else {
        toast.error('Failed to cancel order');
      }
    } catch { toast.error('Failed to cancel order'); }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Orders</h1>
        <div className="flex items-center gap-3">
          {viewTab === 'conditional' && (
            <Button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium border border-pf-cyan-500/30 hover:bg-pf-cyan-500/25 transition-colors"
            >
              <Plus className="size-3" /> New Conditional
            </Button>
          )}
          {!loading && viewTab === 'orders' && (
            <>
              <span className="text-sm text-pf-text-muted">{total} orders</span>
              <Button
                type="button"
                variant="secondary"
                onClick={exportCsv}
                disabled={exportingCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:text-pf-text hover:border-pf-border-hover transition-colors disabled:opacity-50"
              >
                {exportingCsv
                  ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  : <Download className="size-3" aria-hidden="true" />}
                Export CSV
              </Button>
            </>
          )}
          {!condLoading && viewTab === 'conditional' && <span className="text-sm text-pf-text-muted">{condTotal} conditional</span>}
          {viewTab === 'journal' && !journalLoading && (
            <span className="text-sm text-pf-text-muted">{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</span>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 border-b border-pf-border-subtle pb-2" role="tablist" aria-label="Order type">
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={viewTab === 'orders'}
          onClick={() => setViewTab('orders')}
          className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
            viewTab === 'orders' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'
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
          className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
            viewTab === 'conditional' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'
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
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
            viewTab === 'journal' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'
          }`}
        >
          <BookOpen className="size-3.5" />
          Journal
          {Object.keys(journalByOrder).length > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 text-[10px] font-medium">
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
                onClick={() => changeFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                  filter === f.value
                    ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                    : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm" aria-label="Orders">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
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
                <tbody className="divide-y divide-pf-border-subtle">
                  {loading ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 12 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ClipboardList className="size-10 text-pf-text-muted mb-3" />
                          <p className="text-sm font-medium text-pf-text">No orders found</p>
                          <p className="text-xs text-pf-text-muted mt-1">Orders placed by your strategies will appear here.</p>
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
                          tabIndex={0}
                          onClick={() => setSelectedOrder(order)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOrder(order); }}
                          className={`hover:bg-pf-surface/50 transition-colors cursor-pointer ${isJournalOpen ? 'bg-pf-surface/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-pf-text-muted">{(page - 1) * 25 + i + 1}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="text-pf-text text-xs line-clamp-1" title={order.marketQuestion ?? order.marketId ?? ''}>
                              {order.marketQuestion || (order.marketId?.slice(0, 12)) || '—'}
                            </span>
                            <CategoryBadge category={order.marketCategory} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              order.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {order.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              order.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {order.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{order.size}</td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{order.price}</td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text-secondary hidden md:table-cell">{fillRatio(order)}</td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text hidden md:table-cell">{order.fillPrice ?? '\u2014'}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="font-mono text-[11px] text-pf-text-muted">{order.orderType}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            <span className="font-mono text-[11px] text-pf-text-muted">{formatDate(order.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setOpenJournalOrderId(isJournalOpen ? null : order.id)}
                                title={hasNote ? 'Edit journal note' : 'Add journal note'}
                                aria-label={hasNote ? 'Edit journal note' : 'Add journal note'}
                                className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                                  hasNote
                                    ? 'text-pf-cyan-400 hover:text-pf-cyan-300'
                                    : 'text-pf-text-muted hover:text-pf-cyan-400'
                                }`}
                              >
                                <BookOpen className={`size-3.5 ${hasNote ? 'fill-pf-cyan-400/20' : ''}`} />
                              </Button>
                              {['PENDING', 'SUBMITTED', 'LIVE'].includes(order.status) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => cancelOrder(order.id)}
                                  title="Cancel order"
                                  aria-label="Cancel order"
                                  className="p-1 rounded text-pf-text-muted hover:text-pf-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger/40"
                                >
                                  <Trash2 className="size-3.5" />
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
              <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
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
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Conditional orders">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
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
                <tbody className="divide-y divide-pf-border-subtle">
                  {condLoading ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : condOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ClipboardList className="size-10 text-pf-text-muted mb-3" />
                          <p className="text-sm font-medium text-pf-text">No conditional orders</p>
                          <p className="text-xs text-pf-text-muted mt-1">Set up take profit, stop loss, or trailing stop orders.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    condOrders.map((co) => {
                      const ts = CONDITIONAL_TYPE_STYLES[co.type] ?? CONDITIONAL_TYPE_STYLES.LIMIT;
                      const cs = CONDITIONAL_STATUS_STYLES[co.status] ?? CONDITIONAL_STATUS_STYLES.PENDING;
                      return (
                        <tr key={co.id} className="hover:bg-pf-surface/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ts.bg} ${ts.text}`}>
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-pf-text-muted">{co.marketId.slice(0, 8)}...</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{co.triggerPrice}</td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{co.size}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              co.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {co.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              co.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {co.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cs.bg} ${cs.text}`}>
                              {co.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-[11px] text-pf-text-muted">
                              {co.expiresAt ? formatDate(co.expiresAt) : '\u2014'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-[11px] text-pf-text-muted">{formatDate(co.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {co.status === 'PENDING' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => cancelConditional(co.id)}
                                aria-label="Cancel conditional order"
                              >
                                <Trash2 className="size-3.5" />
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
              <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {condPage} of {condTotalPages}</span>
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
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" role="dialog" aria-modal="true" aria-label="Order Details">
          <div className="absolute inset-0 bg-pf-backdrop-light" onClick={() => setSelectedOrder(null)} />
          <div className="animate-slide-right relative w-full max-w-md h-full bg-pf-surface border-l border-pf-border overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pf-border-subtle">
              <h2 className="text-lg font-semibold text-pf-text">Order Details</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedOrder(null)} aria-label="Close order details">
                <X className="size-5" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {([
                { label: 'Order ID', value: <span className="font-mono text-[11px]">{selectedOrder.id.slice(0, 8)}...</span> },
                { label: 'Side', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                  }`}>{selectedOrder.side}</span>
                )},
                { label: 'Outcome', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                  }`}>{selectedOrder.outcome}</span>
                )},
                { label: 'Size', value: <span className="font-mono">{selectedOrder.size}</span> },
                { label: 'Price', value: <span className="font-mono">{selectedOrder.price}</span> },
                { label: 'Fill Price', value: <span className="font-mono">{selectedOrder.fillPrice ?? '\u2014'}</span> },
                { label: 'Filled', value: <span className="font-mono">{fillRatio(selectedOrder)}</span> },
                { label: 'Type', value: selectedOrder.orderType },
                { label: 'Status', value: (() => {
                  const ss = STATUS_STYLES[selectedOrder.status] ?? STATUS_STYLES.PENDING;
                  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>{selectedOrder.status}</span>;
                })() },
                { label: 'Created', value: <span className="font-mono text-xs">{formatDate(selectedOrder.placedAt ?? selectedOrder.createdAt)}</span> },
              ] as { label: string; value: React.ReactNode }[]).map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-pf-border-subtle last:border-0">
                  <span className="text-sm text-pf-text-secondary">{row.label}</span>
                  <span className="text-sm text-pf-text">{row.value}</span>
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
