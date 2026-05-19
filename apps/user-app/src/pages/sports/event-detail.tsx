import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import {
  Button,
  CardSkeleton,
  SkeletonLine,
  SkeletonBadge,
} from "@polyforge/ui";
import {
  ChevronLeft,
  Trophy,
  TrendingUp,
  Clock,
  Plus,
  X,
  ExternalLink,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import {
  GameStatus,
  SportsCategory,
  SPORTS_CATEGORY_LABELS,
  type SportEvent,
  type SportMarket,
  type SportMilestone,
  type ComboCollection,
  type ComboLookupResponse,
} from "./types";
import { GameStatusBadge } from "./sports";

/* ─── Helpers ────────────────────────────────────────────────────────── */

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

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : String(value);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function normalizeSportMarket(
  raw: unknown,
  fallbackEventTicker: string,
): SportMarket | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;

  const id =
    asString(m.id) ?? asString(m.marketTicker) ?? asString(m.market_ticker);
  const title = asString(m.title) ?? asString(m.name);
  if (!id || !title) return null;

  return {
    id,
    title,
    category: asString(m.category) ?? "OTHER",
    seriesSlug: asNullableString(m.seriesSlug ?? m.series_slug),
    eventTicker:
      asString(m.eventTicker) ??
      asString(m.event_ticker) ??
      fallbackEventTicker,
    endDate: asNullableString(
      m.endDate ?? m.end_date ?? m.closeTime ?? m.close_time,
    ),
    closed: asBoolean(m.closed ?? m.isClosed ?? m.is_closed),
    volume24h: String(m.volume24h ?? m.volume_24h ?? "0"),
    yesPrice: asNullableString(m.yesPrice ?? m.yes_price),
    noPrice: asNullableString(m.noPrice ?? m.no_price),
  };
}

function normalizeComboCollection(raw: unknown): ComboCollection | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  const collectionTicker =
    asString(c.collectionTicker) ?? asString(c.collection_ticker);
  const title = asString(c.title) ?? asString(c.name);
  if (!collectionTicker || !title) return null;

  return {
    collectionTicker,
    title,
    description: asNullableString(c.description),
    marketCount: Number(
      c.marketCount ?? c.market_count ?? c.markets_count ?? 0,
    ),
    seriesTicker: asNullableString(c.seriesTicker ?? c.series_ticker),
  };
}

function normalizeComboLookupResponse(
  raw: unknown,
): ComboLookupResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const eventTicker = asString(r.eventTicker) ?? asString(r.event_ticker);
  const marketTicker = asString(r.marketTicker) ?? asString(r.market_ticker);
  if (!eventTicker || !marketTicker) return null;
  return { eventTicker, marketTicker };
}

function deriveCategory(rawCategory?: unknown): SportsCategory | null {
  if (typeof rawCategory !== "string") return null;
  const cat = rawCategory.toUpperCase();
  const values = Object.values(SportsCategory);
  if (values.includes(cat as SportsCategory)) return cat as SportsCategory;
  return null;
}

function normalizeSportEvent(
  raw: unknown,
  eventTicker: string,
  marketCount: number,
  overrideCategory?: SportsCategory,
  overrideSeriesTicker?: string,
): SportEvent {
  const defaults: SportEvent = {
    eventTicker,
    title: "Unknown Event",
    category: SportsCategory.OTHER,
    seriesTicker: "",
    startTime: null,
    endTime: null,
    gameStatus: GameStatus.SCHEDULED,
    marketCount,
  };

  if (!raw || typeof raw !== "object") return defaults;
  const e = raw as Record<string, unknown>;

  const startTime =
    asNullableString(e.startDate ?? e.startTime ?? e.start_time) ??
    defaults.startTime;
  const endTime =
    asNullableString(e.endDate ?? e.endTime ?? e.end_time) ?? defaults.endTime;

  let gameStatus = defaults.gameStatus;
  if (endTime && new Date(endTime) < new Date()) {
    gameStatus = GameStatus.FINAL;
  } else if (startTime && new Date(startTime) < new Date()) {
    gameStatus = GameStatus.LIVE;
  }

  const seriesTicker =
    asNullableString(e.seriesTicker ?? e.series_ticker) ??
    overrideSeriesTicker ??
    "";

  let category: SportsCategory =
    deriveCategory(e.category ?? e.category_ticker) ?? defaults.category;
  if (category === SportsCategory.OTHER && overrideCategory) {
    category = overrideCategory;
  }

  return {
    eventTicker,
    title: asString(e.title) ?? defaults.title,
    category,
    seriesTicker,
    startTime,
    endTime,
    gameStatus,
    marketCount,
  };
}

/* ─── Milestone Timeline ─────────────────────────────────────────────── */

interface MilestoneTimelineProps {
  milestones: SportMilestone[];
}

function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (milestones.length === 0) return null;

  function statusIcon(status: string) {
    switch (status.toLowerCase()) {
      case "completed":
      case "done":
        return (
          <CheckCircle2
            className="size-4 text-gain shrink-0"
            aria-hidden="true"
          />
        );
      case "active":
      case "in_progress":
        return (
          <AlertCircle
            className="size-4 text-warning shrink-0 animate-pulse"
            aria-hidden="true"
          />
        );
      default:
        return (
          <Circle
            className="size-4 text-tertiary shrink-0"
            aria-hidden="true"
          />
        );
    }
  }

  function statusClass(status: string): string {
    switch (status.toLowerCase()) {
      case "completed":
      case "done":
        return "border-gain/20 bg-gain/5";
      case "active":
      case "in_progress":
        return "border-warning/30 bg-warning/5";
      default:
        return "border-default bg-elevated";
    }
  }

  return (
    <section aria-label="Game milestones">
      <h2 className="text-base font-semibold text-primary mb-3">
        Game Milestones
      </h2>
      <ol className="space-y-2" role="list">
        {milestones.map((m, idx) => (
          <li
            key={m.id}
            className={`flex items-start gap-3 p-3 rounded-pf border transition-colors ${statusClass(m.status)}`}
          >
            <span className="mt-0.5">{statusIcon(m.status)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-body-sm font-medium text-primary">
                {m.description}
              </div>
              <div className="text-caption text-tertiary mt-0.5">
                Milestone {idx + 1} · {m.status}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Combo Parlay UI ────────────────────────────────────────────────── */

interface ComboLeg {
  marketTicker: string;
  eventTicker: string;
  side: "yes" | "no";
  title: string;
}

interface ComboBrowserProps {
  collections: ComboCollection[];
  eventTicker: string;
  markets: SportMarket[];
}

function ComboBrowser({
  collections,
  eventTicker,
  markets,
}: ComboBrowserProps) {
  const normalizedCollections = collections
    .map((collection) => normalizeComboCollection(collection))
    .filter((collection): collection is ComboCollection => collection !== null);

  const [selectedCollection, setSelectedCollection] =
    useState<ComboCollection | null>(null);
  const [legs, setLegs] = useState<ComboLeg[]>([]);
  const [lookupResult, setLookupResult] = useState<ComboLookupResponse | null>(
    null,
  );
  const [looking, setLooking] = useState(false);

  if (normalizedCollections.length === 0) return null;

  function addLeg(market: SportMarket, side: "yes" | "no") {
    if (!selectedCollection) return;
    setLegs((prev) => {
      const existingIdx = prev.findIndex((l) => l.marketTicker === market.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], side };
        return updated;
      }
      return [
        ...prev,
        {
          marketTicker: market.id,
          eventTicker: market.eventTicker ?? eventTicker,
          side,
          title: market.title,
        },
      ];
    });
    setLookupResult(null);
  }

  function removeLeg(idx: number) {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
    setLookupResult(null);
  }

  async function lookupCombo() {
    if (!selectedCollection || legs.length < 2) return;
    setLooking(true);
    try {
      const res = await fetch("/api/v1/sports/combos/lookup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionTicker: selectedCollection.collectionTicker,
          selectedMarkets: legs.map((l) => ({
            marketTicker: l.marketTicker,
            eventTicker: l.eventTicker,
            side: l.side,
          })),
        }),
      });
      if (res.ok) {
        const data = normalizeComboLookupResponse(await res.json());
        if (data) {
          setLookupResult(data);
        } else {
          toast.error("Unexpected combo lookup response");
        }
      } else {
        toast.error("Could not find a matching combo market");
      }
    } catch {
      toast.error("Failed to look up combo");
    }
    setLooking(false);
  }

  return (
    <section aria-label="Combo / parlay builder">
      <h2 className="text-base font-semibold text-primary mb-3">
        Combo Markets
      </h2>
      <p className="text-body-sm text-tertiary mb-4">
        Build a multi-leg bet by selecting markets below. Kalshi will find a
        matching combo market.
      </p>

      {/* Collection picker */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
        {normalizedCollections.map((col) => (
          <button
            key={col.collectionTicker}
            type="button"
            onClick={() => {
              setSelectedCollection(col);
              setLegs([]);
              setLookupResult(null);
            }}
            className={`shrink-0 px-3 py-2 rounded-pf text-body-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring ${
              selectedCollection?.collectionTicker === col.collectionTicker
                ? "bg-accent-subtle text-accent-text border-accent/30"
                : "bg-elevated text-secondary border-default hover:border-strong"
            }`}
          >
            <div className="font-medium">{col.title}</div>
            <div className="text-caption text-tertiary">
              {col.marketCount} markets
            </div>
          </button>
        ))}
      </div>

      {/* Legs builder */}
      {selectedCollection && (
        <div className="space-y-3">
          {legs.length > 0 && (
            <div className="space-y-2">
              <div className="text-label font-semibold text-tertiary uppercase tracking-wider">
                Selected Legs
              </div>
              {legs.map((leg, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-elevated border border-default rounded-pf px-3 py-2"
                >
                  <span
                    className={`text-caption font-semibold px-1.5 py-0.5 rounded ${
                      leg.side === "yes"
                        ? "bg-gain/15 text-gain"
                        : "bg-loss/15 text-loss"
                    }`}
                  >
                    {leg.side.toUpperCase()}
                  </span>
                  <span className="flex-1 text-body-sm text-primary line-clamp-1">
                    {leg.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLeg(idx)}
                    aria-label={`Remove ${leg.title} leg`}
                    className="text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring rounded"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {legs.length < 2 && (
            <p className="text-body-sm text-tertiary">
              Add at least 2 legs from the markets below to build a combo.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <EventMarketCard
                key={`combo-${market.id}`}
                market={market}
                onAddLeg={addLeg}
              />
            ))}
          </div>

          {legs.length >= 2 && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => void lookupCombo()}
                disabled={looking}
                className="px-4 py-2 bg-accent text-inverse text-body-sm font-semibold rounded-pf hover:bg-accent/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-focus-ring"
              >
                {looking ? "Looking up…" : "Find Combo Market"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setLegs([]);
                  setLookupResult(null);
                }}
                className="text-body-sm text-tertiary hover:text-primary transition-colors"
              >
                Clear legs
              </button>
            </div>
          )}

          {lookupResult && (
            <div className="bg-gain/10 border border-gain/30 rounded-pf px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-body-sm font-semibold text-gain">
                  Combo market found!
                </div>
                <div className="text-caption text-secondary font-mono">
                  {lookupResult.marketTicker}
                </div>
              </div>
              <Link
                to={`/markets/${lookupResult.marketTicker}`}
                className="flex items-center gap-1 text-body-sm text-accent-text hover:underline focus-visible:outline-none"
              >
                Trade <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Skeletons ──────────────────────────────────────────────────────── */

function EventDetailSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <CardSkeleton>
        <SkeletonLine h="h-7" w="w-[60%]" />
        <div className="flex gap-2">
          <SkeletonBadge w="w-16" />
          <SkeletonBadge w="w-20" />
        </div>
      </CardSkeleton>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i}>
            <SkeletonLine h="h-4" w="w-[80%]" />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonBadge w="w-full" />
              <SkeletonBadge w="w-full" />
            </div>
          </CardSkeleton>
        ))}
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────────── */

export function Component() {
  const { eventTicker } = useParams<{ eventTicker: string }>();

  const [event, setEvent] = useState<SportEvent | null>(null);
  const [markets, setMarkets] = useState<SportMarket[]>([]);
  const [milestones, setMilestones] = useState<SportMilestone[]>([]);
  const [combos, setCombos] = useState<ComboCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventTicker) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [eventRes, milestonesRes] = await Promise.all([
          fetch(`/api/v1/sports/events/${eventTicker}`, {
            credentials: "include",
          }),
          fetch(`/api/v1/sports/milestones?eventTicker=${eventTicker}`, {
            credentials: "include",
          }),
        ]);

        if (!eventRes.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (cancelled) return;

        const eventData = await eventRes.json();
        const normEventTicker = eventTicker as string;
        const normalizedMarkets = Array.isArray(eventData.markets)
          ? (eventData.markets as unknown[])
              .map((market: unknown) =>
                normalizeSportMarket(market, normEventTicker),
              )
              .filter(
                (market): market is SportMarket =>
                  market !== null && !market.closed,
              )
          : [];

        const categoryFromMarkets = normalizedMarkets
          .map((m) => deriveCategory(m.category))
          .find((c): c is SportsCategory => c !== null && c !== SportsCategory.OTHER);

        const seriesTickerFromMarkets = normalizedMarkets
          .map((m) => m.seriesSlug)
          .find((s): s is string => typeof s === "string" && s.length > 0);

        const normalizedEvent = normalizeSportEvent(
          eventData.event,
          normEventTicker,
          normalizedMarkets.length,
          categoryFromMarkets,
          seriesTickerFromMarkets,
        );

        setEvent(normalizedEvent);
        setMarkets(normalizedMarkets);

        if (milestonesRes.ok) {
          const data = await milestonesRes.json();
          setMilestones(Array.isArray(data) ? data : (data.data ?? []));
        }

        if (normalizedEvent.seriesTicker) {
          const combosRes = await fetch(
            `/api/v1/sports/combos?seriesTicker=${encodeURIComponent(normalizedEvent.seriesTicker)}`,
            { credentials: "include" },
          );

          if (cancelled) return;

          if (combosRes.ok) {
            const data = await combosRes.json();
            setCombos(Array.isArray(data) ? data : (data.collections ?? data.data ?? []));
          } else {
            setCombos([]);
          }
        } else {
          setCombos([]);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load event");
      }
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventTicker]);

  if (loading) return <EventDetailSkeleton />;

  if (notFound) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Trophy className="size-12 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">Event not found</p>
          <p className="text-body-sm text-tertiary mt-1">
            This event may have ended or the ticker is incorrect.
          </p>
          <Link
            to="/sports"
            className="mt-4 text-accent-text hover:underline text-body-sm"
          >
            Back to Sports
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const categoryLabel =
    SPORTS_CATEGORY_LABELS[event.category] ?? event.category;
  const startLabel = formatDateTime(event.startTime);

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-8">
      {/* Back nav */}
      <Link
        to="/sports"
        className="inline-flex items-center gap-1.5 text-body-sm text-secondary hover:text-primary transition-colors focus-visible:outline-none"
        aria-label="Back to Sports"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Sports
      </Link>

      {/* Event header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label px-2 py-0.5 rounded bg-accent-subtle text-accent-text border border-accent/20 font-medium">
            {categoryLabel}
          </span>
          <GameStatusBadge status={event.gameStatus} />
        </div>
        <h1 className="text-2xl font-semibold text-primary leading-tight">
          {event.title}
        </h1>
        <div className="flex flex-wrap gap-4 text-body-sm text-tertiary">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" />
            {startLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="size-4" aria-hidden="true" />
            {event.marketCount} market{event.marketCount !== 1 ? "s" : ""}
          </span>
          <span className="font-mono text-caption text-tertiary">
            {event.seriesTicker}
          </span>
        </div>
      </header>

      <div className="border-t border-default" />

      {/* Markets grid */}
      <section aria-label="Event markets">
        <h2 className="text-base font-semibold text-primary mb-4">
          Markets
          {markets.length > 0 && (
            <span className="text-tertiary font-normal ml-2 text-body-sm">
              ({markets.length})
            </span>
          )}
        </h2>

        {markets.length === 0 ? (
          <div
            className="flex flex-col items-center py-12 text-center"
            role="status"
          >
            <Trophy className="size-10 text-tertiary mb-3" aria-hidden="true" />
            <p className="text-secondary">
              No markets available for this event yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((m) => (
              <EventMarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </section>

      {/* Combo builder */}
      {combos.length > 0 && (
        <>
          <div className="border-t border-default" />
          <ComboBrowser
            key={event.eventTicker}
            collections={combos}
            eventTicker={event.eventTicker}
            markets={markets}
          />
        </>
      )}

      {/* Milestone timeline */}
      {milestones.length > 0 && (
        <>
          <div className="border-t border-default" />
          <MilestoneTimeline milestones={milestones} />
        </>
      )}
    </div>
  );
}

/* ─── Event Market Card (inline — includes leg-add buttons) ──────────── */

interface EventMarketCardProps {
  market: SportMarket;
  onAddLeg?: (market: SportMarket, side: "yes" | "no") => void;
}

function EventMarketCard({ market, onAddLeg }: EventMarketCardProps) {
  const yesPrice = formatPrice(market.yesPrice);
  const noPrice = formatPrice(market.noPrice);
  const volume = formatVolume(market.volume24h);

  return (
    <div
      data-testid="event-market-card"
      className={`bg-elevated border rounded-pf p-4 space-y-3 ${
        market.closed
          ? "border-default opacity-60"
          : "border-default hover:border-strong transition-colors"
      }`}
    >
      <div className="text-body-sm font-medium text-primary line-clamp-2 leading-snug">
        {market.title}
      </div>

      {/* Price + leg buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={market.closed}
          onClick={() => onAddLeg?.(market, "yes")}
          aria-label={`Add YES leg for ${market.title}`}
          className="bg-gain/10 border border-gain/25 rounded-sm px-2 py-1.5 text-center group hover:bg-gain/20 disabled:opacity-50 disabled:cursor-default transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <div className="text-caption text-tertiary mb-0.5 flex items-center justify-center gap-1">
            YES{" "}
            <Plus
              className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            />
          </div>
          <div className="font-mono text-body-sm font-semibold text-gain">
            {yesPrice}
          </div>
        </button>
        <button
          type="button"
          disabled={market.closed}
          onClick={() => onAddLeg?.(market, "no")}
          aria-label={`Add NO leg for ${market.title}`}
          className="bg-loss/10 border border-loss/25 rounded-sm px-2 py-1.5 text-center group hover:bg-loss/20 disabled:opacity-50 disabled:cursor-default transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <div className="text-caption text-tertiary mb-0.5 flex items-center justify-center gap-1">
            NO{" "}
            <Plus
              className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            />
          </div>
          <div className="font-mono text-body-sm font-semibold text-loss">
            {noPrice}
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between text-caption text-tertiary border-t border-subtle pt-2">
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3" aria-hidden="true" />
          {volume} vol
        </span>
        {market.closed && <span className="text-tertiary">Closed</span>}
      </div>
    </div>
  );
}
