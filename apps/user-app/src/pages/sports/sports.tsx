import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Button,
  CardSkeleton,
  SkeletonLine,
  SkeletonBadge,
} from "@polyforge/ui";
import {
  Trophy,
  TrendingUp,
  Clock,
  Flame,
  ChevronRight,
  Tv2,
} from "lucide-react";
import {
  SportsCategory,
  SPORTS_CATEGORY_LABELS,
  GameStatus,
  type SportMarket,
  type SportEvent,
} from "./types";

/* ─── Helpers ────────────────────────────────────────────────────────── */

const CATEGORY_TABS: Array<{ label: string; value: SportsCategory | null }> = [
  { label: "All Sports", value: null },
  { label: "NFL", value: SportsCategory.NFL },
  { label: "NBA", value: SportsCategory.NBA },
  { label: "MLB", value: SportsCategory.MLB },
  { label: "NHL", value: SportsCategory.NHL },
  { label: "Soccer", value: SportsCategory.SOCCER },
  { label: "MMA", value: SportsCategory.MMA },
  { label: "Golf", value: SportsCategory.GOLF },
  { label: "Tennis", value: SportsCategory.TENNIS },
  { label: "College FB", value: SportsCategory.NCAA_FOOTBALL },
  { label: "College BB", value: SportsCategory.NCAA_BASKETBALL },
  { label: "Formula 1", value: SportsCategory.F1 },
  { label: "NASCAR", value: SportsCategory.NASCAR },
  { label: "Boxing", value: SportsCategory.BOXING },
  { label: "Esports", value: SportsCategory.ESPORTS },
];

type SortOption = "volume" | "close_time" | "activity";

const SORT_OPTIONS: Array<{
  label: string;
  value: SortOption;
  icon: typeof TrendingUp;
}> = [
  { label: "Volume", value: "volume", icon: TrendingUp },
  { label: "Closing Soon", value: "close_time", icon: Clock },
  { label: "Most Active", value: "activity", icon: Flame },
];

function formatPrice(p: string | null): string {
  if (!p) return "—";
  const n = Number(p);
  return isNaN(n) ? "—" : `${Math.round(n * 100)}¢`;
}

function formatVolume(v: string): string {
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatCloseTime(d: string | null): string {
  if (!d) return "No expiry";
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "Closed";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ─── Game Status Badge ──────────────────────────────────────────────── */

interface GameStatusBadgeProps {
  status: GameStatus;
}

export function GameStatusBadge({ status }: GameStatusBadgeProps) {
  const cfg: Record<
    GameStatus,
    { label: string; className: string; live?: boolean }
  > = {
    [GameStatus.LIVE]: {
      label: "LIVE",
      className: "bg-loss/15 text-loss border-loss/30",
      live: true,
    },
    [GameStatus.PREGAME]: {
      label: "PREGAME",
      className: "bg-warning/15 text-warning border-warning/30",
    },
    [GameStatus.HALFTIME]: {
      label: "HALFTIME",
      className: "bg-info/15 text-info border-info/30",
    },
    [GameStatus.SCHEDULED]: {
      label: "SCHEDULED",
      className: "bg-overlay text-secondary border-default",
    },
    [GameStatus.FINAL]: {
      label: "FINAL",
      className: "bg-overlay text-tertiary border-default",
    },
    [GameStatus.POSTPONED]: {
      label: "POSTPONED",
      className: "bg-warning-subtle text-warning border-warning/20",
    },
    [GameStatus.CANCELLED]: {
      label: "CANCELLED",
      className: "bg-overlay text-tertiary border-default",
    },
  };

  const { label, className, live } = cfg[status] ?? cfg[GameStatus.SCHEDULED];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-semibold border ${className}`}
      aria-label={`Game status: ${label}`}
    >
      {live && (
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-loss opacity-75" />
          <span className="relative inline-flex rounded-full size-1.5 bg-loss" />
        </span>
      )}
      {label}
    </span>
  );
}

/* ─── Market Card ────────────────────────────────────────────────────── */

interface MarketCardProps {
  market: SportMarket;
}

function MarketCard({ market }: MarketCardProps) {
  const yesPrice = formatPrice(market.yesPrice);
  const noPrice = formatPrice(market.noPrice);
  const volume = formatVolume(market.volume24h);
  const closeLabel = formatCloseTime(market.endDate);
  const isClosed = market.closed;

  return (
    <Link
      to={
        market.eventTicker ? `/sports/events/${market.eventTicker}` : "/markets"
      }
      data-testid="sport-market-card"
      className={`group block bg-elevated border rounded-pf p-4 transition-all duration-panel hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-focus-ring ${
        isClosed
          ? "border-default opacity-60 cursor-default pointer-events-none"
          : "border-default hover:border-strong"
      }`}
    >
      {/* Title */}
      <div className="text-body-sm font-medium text-primary group-hover:text-accent-text transition-colors mb-3 line-clamp-2 leading-snug">
        {market.title}
      </div>

      {/* Price row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gain/10 border border-gain/20 rounded-sm px-2 py-1.5 text-center">
          <div className="text-caption text-tertiary mb-0.5">YES</div>
          <div className="font-mono text-body-sm font-semibold text-gain">
            {yesPrice}
          </div>
        </div>
        <div className="bg-loss/10 border border-loss/20 rounded-sm px-2 py-1.5 text-center">
          <div className="text-caption text-tertiary mb-0.5">NO</div>
          <div className="font-mono text-body-sm font-semibold text-loss">
            {noPrice}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-caption text-tertiary">
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3" aria-hidden="true" />
          {volume}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" aria-hidden="true" />
          {closeLabel}
        </span>
      </div>
    </Link>
  );
}

/* ─── Skeletons ──────────────────────────────────────────────────────── */

function MarketCardSkeleton() {
  return (
    <CardSkeleton>
      <SkeletonLine h="h-4" w="w-[85%]" />
      <SkeletonLine w="w-[70%]" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonBadge w="w-full" />
        <SkeletonBadge w="w-full" />
      </div>
    </CardSkeleton>
  );
}

/* ─── Live Events Strip ──────────────────────────────────────────────── */

interface LiveEventsStripProps {
  events: SportEvent[];
}

function LiveEventsStrip({ events }: LiveEventsStripProps) {
  if (events.length === 0) return null;

  return (
    <section aria-label="Live games">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-loss opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-loss" />
        </span>
        <span className="text-base font-semibold text-primary">Live Now</span>
        <span className="text-label text-tertiary">
          {events.length} game{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {events.map((ev) => (
          <Link
            key={ev.eventTicker}
            to={`/sports/events/${ev.eventTicker}`}
            className="shrink-0 bg-elevated border border-loss/30 rounded-pf px-3 py-2 flex items-center gap-2 hover:border-loss/50 transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <Tv2 className="size-3.5 text-loss shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-body-sm font-medium text-primary truncate max-w-[160px]">
                {ev.title}
              </div>
              <div className="text-caption text-tertiary">
                {SPORTS_CATEGORY_LABELS[ev.category] ?? ev.category} ·{" "}
                {ev.marketCount} market{ev.marketCount !== 1 ? "s" : ""}
              </div>
            </div>
            <ChevronRight
              className="size-3.5 text-tertiary shrink-0"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      <div className="border-t border-default mt-5" />
    </section>
  );
}

/* ─── Page Component ─────────────────────────────────────────────────── */

export function Component() {
  const [category, setCategory] = useState<SportsCategory | null>(null);
  const [sort, setSort] = useState<SortOption>("volume");
  const [liveOnly, setLiveOnly] = useState(false);

  const [markets, setMarkets] = useState<SportMarket[]>([]);
  const [liveEvents, setLiveEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchMarkets = useCallback(
    async (cat: SportsCategory | null, s: SortOption, live: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort: s });
        if (cat) params.set("category", cat);
        if (live) params.set("liveOnly", "true");

        const [marketsRes, eventsRes] = await Promise.all([
          fetch(`/api/v1/sports/markets?${params}`, { credentials: "include" }),
          live || cat === null
            ? fetch("/api/v1/sports/events?liveOnly=true", {
                credentials: "include",
              })
            : Promise.resolve(null),
        ]);

        if (marketsRes.ok) {
          const data = await marketsRes.json();
          const items: SportMarket[] = Array.isArray(data)
            ? data
            : (data.data ?? []);
          setMarkets(items);
          setTotal(
            Array.isArray(data) ? items.length : (data.total ?? items.length),
          );
        }

        if (eventsRes?.ok) {
          const data = await eventsRes.json();
          const items: SportEvent[] = Array.isArray(data)
            ? data
            : (data.data ?? []);
          setLiveEvents(items.filter((e) => e.gameStatus === GameStatus.LIVE));
        }
      } catch {
        toast.error("Failed to load sports markets");
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    void fetchMarkets(category, sort, liveOnly);
  }, [category, sort, liveOnly, fetchMarkets]);

  function changeCategory(cat: SportsCategory | null) {
    setCategory(cat);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-accent-text" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              Sports Markets
            </h1>
            {!loading && (
              <p className="text-body-sm text-tertiary mt-0.5">
                {total} market{total !== 1 ? "s" : ""} available
              </p>
            )}
          </div>
        </div>

        {/* Live-only toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={liveOnly}
          onClick={() => setLiveOnly((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full text-body-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring ${
            liveOnly
              ? "bg-loss/15 text-loss border-loss/40"
              : "bg-elevated text-secondary border-default hover:border-strong"
          }`}
        >
          <span className="relative flex size-2" aria-hidden="true">
            {liveOnly && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-loss opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full size-2 ${liveOnly ? "bg-loss" : "bg-tertiary"}`}
            />
          </span>
          Live Only
        </button>
      </div>

      {/* Live events strip — shown when no category filter */}
      {!liveOnly && liveEvents.length > 0 && (
        <LiveEventsStrip events={liveEvents} />
      )}

      {/* Category tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Filter by sport"
      >
        {CATEGORY_TABS.map((tab) => (
          <Button
            key={tab.value ?? "all"}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={category === tab.value}
            onClick={() => changeCategory(tab.value)}
            className={`px-3 py-1.5 rounded-full text-label font-medium border transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:shadow-focus-ring ${
              category === tab.value
                ? "bg-accent-subtle text-accent-text border-accent/30"
                : "bg-elevated text-secondary border-default hover:border-strong"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Sort bar */}
      <div className="flex gap-2" role="group" aria-label="Sort options">
        {SORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              aria-pressed={sort === opt.value}
              onClick={() => setSort(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-label font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring ${
                sort === opt.value
                  ? "bg-accent-subtle text-accent-text border-accent/30"
                  : "bg-elevated text-secondary border-default hover:border-strong"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {opt.label}
            </Button>
          );
        })}
      </div>

      {/* Market grid */}
      {loading && markets.length === 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          aria-busy="true"
          aria-label="Loading sports markets"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div
          data-testid="sports-empty-state"
          className="flex flex-col items-center justify-center py-24 text-center"
          role="status"
        >
          <Trophy className="size-12 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">No markets found</p>
          <p className="text-body-sm text-tertiary mt-1">
            {liveOnly
              ? "No live markets right now — check back during game time."
              : "Try a different sport or check back later."}
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}
        >
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
