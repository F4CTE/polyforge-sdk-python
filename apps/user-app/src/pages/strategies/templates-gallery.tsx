import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Search,
  LayoutTemplate,
  Loader2,
  TrendingUp,
  RefreshCw,
  Calendar,
  Brain,
  Shuffle,
} from 'lucide-react';
import { Button, Input } from '@polyforge/ui';
import { toast } from 'sonner';
import { notifyApiError } from '@/lib/api-error';
import { TemplateCard, type TemplateData, type TemplateCategory } from '../../components/templates/template-card';
import { TemplatePreviewDialog, type TemplatePreviewData } from '../../components/templates/template-preview-dialog';

const CATEGORIES: { key: TemplateCategory | 'all'; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: 'All' },
  { key: 'momentum', label: 'Momentum', icon: <TrendingUp className="size-3" /> },
  { key: 'mean-reversion', label: 'Mean Reversion', icon: <RefreshCw className="size-3" /> },
  { key: 'event-based', label: 'Event', icon: <Calendar className="size-3" /> },
  { key: 'sentiment', label: 'Sentiment', icon: <Brain className="size-3" /> },
  { key: 'arbitrage', label: 'Arbitrage', icon: <Shuffle className="size-3" /> },
];

interface ApiTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  template: boolean;
  forkCount: number;
  triggers: unknown[];
  conditions: unknown[];
  actions: unknown[];
  safety: unknown[];
  logicBlocks?: unknown[];
  calcBlocks?: unknown[];
  canvas?: { nodes?: unknown[]; edges?: unknown[] };
}

function mapApiTemplate(t: ApiTemplate): TemplateData {
  const blockCount = (t.triggers?.length ?? 0) + (t.conditions?.length ?? 0) +
    (t.actions?.length ?? 0) + (t.safety?.length ?? 0) +
    (t.logicBlocks?.length ?? 0) + (t.calcBlocks?.length ?? 0);
  const edgeCount = t.canvas?.edges ? (t.canvas.edges as unknown[]).length : 0;

  const tags = t.tags ?? [];
  const category = inferCategory(tags, t.name);
  const difficulty = inferDifficulty(blockCount);

  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    category,
    difficulty,
    emoji: inferEmoji(category),
    estimatedWinRate: inferWinRate(category),
    blockCount,
    edgeCount,
    forkCount: t.forkCount ?? 0,
    tags,
  };
}

function inferCategory(tags: string[], name: string): TemplateCategory {
  const haystack = [...tags, name].join(' ').toLowerCase();
  if (haystack.includes('momentum') || haystack.includes('trend')) return 'momentum';
  if (haystack.includes('reversion') || haystack.includes('mean')) return 'mean-reversion';
  if (haystack.includes('event') || haystack.includes('resolv')) return 'event-based';
  if (haystack.includes('sentiment') || haystack.includes('whale')) return 'sentiment';
  if (haystack.includes('arbitrage') || haystack.includes('arb')) return 'arbitrage';
  return 'momentum';
}

function inferDifficulty(blockCount: number): 'beginner' | 'intermediate' | 'advanced' {
  if (blockCount <= 6) return 'beginner';
  if (blockCount <= 9) return 'intermediate';
  return 'advanced';
}

function inferEmoji(category: TemplateCategory): string {
  const map: Record<TemplateCategory, string> = {
    momentum: '\u{1F680}',
    'mean-reversion': '\u{1F4C9}',
    'event-based': '\u{1F4C5}',
    sentiment: '\u{1F9E0}',
    arbitrage: '\u{26A1}',
  };
  return map[category];
}

function inferWinRate(category: TemplateCategory): string {
  const map: Record<TemplateCategory, string> = {
    momentum: '62-68%',
    'mean-reversion': '58-65%',
    'event-based': '55-60%',
    sentiment: '60-67%',
    arbitrage: '50-55%',
  };
  return map[category];
}

export function Component() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePreviewData | null>(null);
  const [forking, setForking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/v1/strategies/templates', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load templates');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data.data ?? [];
        setTemplates(items.map(mapApiTemplate));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = templates;
    if (category !== 'all') {
      result = result.filter((t) => t.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [templates, category, search]);

  const handlePreview = useCallback((template: TemplateData) => {
    setPreviewTemplate({
      ...template,
      blocks: [],
    });

    fetch(`/api/v1/strategies/${template.id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const blocks = [
          ...(data.safety ?? []).map((b: { type: string }) => ({ section: 'safety', type: b.type, label: formatBlockLabel(b.type) })),
          ...(data.triggers ?? []).map((b: { type: string }) => ({ section: 'triggers', type: b.type, label: formatBlockLabel(b.type) })),
          ...(data.conditions ?? []).map((b: { type: string }) => ({ section: 'conditions', type: b.type, label: formatBlockLabel(b.type) })),
          ...(data.actions ?? []).map((b: { type: string }) => ({ section: 'actions', type: b.type, label: formatBlockLabel(b.type) })),
          ...(data.logicBlocks ?? []).map((b: { type: string }) => ({ section: 'logic', type: b.type, label: formatBlockLabel(b.type) })),
          ...(data.calcBlocks ?? []).map((b: { type: string }) => ({ section: 'calc', type: b.type, label: formatBlockLabel(b.type) })),
        ];
        setPreviewTemplate((prev) => prev ? { ...prev, blocks } : null);
      })
      .catch(err => { notifyApiError(err, "load template blocks"); });
  }, []);

  const handleUseTemplate = useCallback(async (template: TemplateData) => {
    setForking(true);
    try {
      const res = await fetch(`/api/v1/strategies/${template.id}/fork`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to create strategy from template');
      }

      const created = await res.json();
      toast.success(`Created "${template.name}" — customize it now`);
      navigate(`/strategies/${created.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to use template');
    } finally {
      setForking(false);
      setPreviewTemplate(null);
    }
  }, [navigate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-subtle shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/strategies"
            className="flex items-center gap-1 text-label text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Strategies
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
              <LayoutTemplate className="size-5 text-accent-text" aria-hidden="true" />
              Template Gallery
            </h1>
            <p className="text-body-sm text-secondary mt-1">Start faster with pre-built strategies</p>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search templates"
              className="pl-9"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              type="button"
              variant={category === cat.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategory(cat.key)}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              {cat.icon && <span className="opacity-70">{cat.icon}</span>}
              {cat.label}
              {cat.key !== 'all' && (
                <span className="text-caption opacity-60">
                  {templates.filter((t) => cat.key === 'all' || t.category === cat.key).length}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-tertiary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-body-sm text-loss mb-3">{error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutTemplate className="size-8 text-tertiary mb-3 opacity-40" />
            <p className="text-body-sm text-tertiary">
              {search ? 'No templates match your search' : 'No templates in this category'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={handlePreview}
                onUse={handleUseTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUse={handleUseTemplate}
        loading={forking}
      />
    </div>
  );
}

function formatBlockLabel(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
