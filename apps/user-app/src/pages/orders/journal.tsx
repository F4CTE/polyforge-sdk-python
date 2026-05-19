import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button, Input, Select } from "@polyforge/ui";
import { BookOpen, Search, Tag } from "lucide-react";

type JournalMood = "CONFIDENT" | "UNCERTAIN" | "FOMO" | "DISCIPLINED" | "REVENGE";

interface JournalEntry {
  id: string;
  orderId?: string;
  marketId?: string;
  marketTitle?: string;
  outcome: "YES" | "NO";
  side: "BUY" | "SELL";
  price: number;
  size: number;
  pnl?: number;
  note: string;
  tags?: string[];
  mood: JournalMood | string;
  createdAt: string;
  updatedAt?: string;
}

const MOOD_CONFIG: Record<JournalMood, { emoji: string; label: string }> = {
  CONFIDENT: { emoji: "😊", label: "Confident" },
  UNCERTAIN: { emoji: "🤔", label: "Uncertain" },
  FOMO: { emoji: "😰", label: "FOMO" },
  DISCIPLINED: { emoji: "🎯", label: "Disciplined" },
  REVENGE: { emoji: "😤", label: "Revenge" },
};

const MOOD_KEYS = Object.keys(MOOD_CONFIG) as JournalMood[];

function normalizeMood(mood: string): JournalMood {
  const upper = mood.toUpperCase();
  if (upper in MOOD_CONFIG) return upper as JournalMood;
  return "UNCERTAIN";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function JournalEntryCard({
  entry,
}: {
  entry: JournalEntry;
}) {
  const mood = MOOD_CONFIG[normalizeMood(entry.mood)];
  return (
    <div className="bg-elevated border border-default rounded-pf p-4 space-y-3 hover:border-default transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-medium text-primary line-clamp-1">
            {entry.marketTitle || entry.marketId || (entry.orderId ? `Order ${entry.orderId.slice(0, 8)}` : `Order ${entry.id.slice(0, 8)}`)}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`inline-flex px-2 py-1 rounded text-caption font-medium ${entry.side === "BUY" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}
            >
              {entry.side}
            </span>
            <span
              className={`inline-flex px-2 py-1 rounded text-caption font-medium ${entry.outcome === "YES" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}
            >
              {entry.outcome}
            </span>
            <span className="font-mono text-caption text-tertiary">
              {entry.size} @ {entry.price}
            </span>
            {entry.pnl !== undefined && (
              <span
                className={`font-mono text-caption font-medium ${entry.pnl >= 0 ? "text-gain" : "text-loss"}`}
              >
                {entry.pnl >= 0 ? "+" : ""}
                {entry.pnl.toFixed(2)} PnL
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0" title={mood.label}>
          {mood.emoji}
        </span>
        <p className="text-label text-secondary line-clamp-2 leading-relaxed">
          {entry.note}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {(entry.tags ?? []).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-caption bg-variable-subtle text-variable-text border border-variable/20"
            >
              <Tag className="size-2" />
              {t}
            </span>
          ))}
        </div>
        <span className="font-mono text-caption text-tertiary shrink-0">
          {formatDate(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function Component() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<JournalMood | "ALL">("ALL");
  const [tagFilter, setTagFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const limit = 100;
      let page = 1;
      let hasNext = true;
      const all: JournalEntry[] = [];

      while (hasNext) {
        const res = await fetch(
          `/api/v1/journal?page=${page}&limit=${limit}`,
          { credentials: "include" },
        );
        if (!res.ok) break;

        const body = (await res.json()) as {
          data: JournalEntry[];
          hasNext: boolean;
        };
        all.push(...(body.data ?? []));
        hasNext = body.hasNext ?? false;
        page += 1;
      }

      setEntries(all);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);



  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags ?? []))).sort();

  const filtered = entries.filter((e) => {
    if (moodFilter !== "ALL" && normalizeMood(e.mood) !== moodFilter) return false;
    if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.note ?? "").toLowerCase().includes(q) ||
        (e.marketTitle ?? "").toLowerCase().includes(q) ||
        (e.marketId ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 h-14 border-b border-default shrink-0">
        <BookOpen className="size-5 text-accent-text" />
        <h1 className="text-body-lg font-semibold text-primary">
          Trading Journal
        </h1>
        {!loading && (
          <span className="text-body-sm text-tertiary">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes or markets..."
              className="w-full h-9 pl-8 pr-3 rounded-pf bg-elevated border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50"
            />
          </div>
          {allTags.length > 0 && (
            <Select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="h-9 px-2 rounded-pf bg-elevated border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Mood filter pills */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMoodFilter("ALL")}
            className={`px-3 py-1 rounded-full text-label font-medium border transition-colors ${
              moodFilter === "ALL"
                ? "bg-accent-subtle text-accent-text border-accent/30"
                : "bg-elevated text-secondary border-default hover:border-strong"
            }`}
          >
            All moods
          </Button>
          {MOOD_KEYS.map((m) => (
            <Button
              key={m}
              type="button"
              variant="ghost"
              onClick={() => setMoodFilter(moodFilter === m ? "ALL" : m)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label font-medium border transition-colors ${
                moodFilter === m
                  ? "bg-accent-subtle text-accent-text border-accent/30"
                  : "bg-elevated text-secondary border-default hover:border-strong"
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
              <div
                key={i}
                className="bg-elevated border border-default rounded-pf p-4 space-y-3 animate-pulse"
              >
                <div className="h-3 bg-overlay rounded w-3/4" />
                <div className="h-3 bg-overlay rounded w-1/2" />
                <div className="h-8 bg-overlay rounded" />
                <div className="h-3 bg-overlay rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="size-10 text-tertiary mb-3" />
            <p className="text-body-md font-medium text-primary">
              {entries.length === 0
                ? "No journal entries yet"
                : "No entries match your filters"}
            </p>
            <p className="text-label text-tertiary mt-1">
              {entries.length === 0
                ? "Go to Orders and click the journal icon on any order to add your first note."
                : "Try adjusting your search or filters."}
            </p>
            {entries.length === 0 && (
              <Button
                type="button"
                onClick={() => void navigate("/orders")}
                className="mt-4 px-4 py-2 rounded-pf bg-accent text-inverse text-label font-medium hover:bg-accent-text transition-colors"
              >
                Go to Orders
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
