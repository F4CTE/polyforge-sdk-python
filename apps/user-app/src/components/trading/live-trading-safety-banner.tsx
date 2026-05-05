import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { wsManager, type WsMessage } from "@/lib/websocket";

interface LiveStrategySummary {
  id: string;
  name: string;
  status: string;
}

interface StrategiesResponse {
  data?: LiveStrategySummary[];
}

function readStrategies(json: unknown): LiveStrategySummary[] {
  if (Array.isArray(json)) return json as LiveStrategySummary[];
  const data = (json as StrategiesResponse | null)?.data;
  return Array.isArray(data) ? data : [];
}

export function LiveTradingSafetyBanner() {
  const [liveStrategies, setLiveStrategies] = useState<LiveStrategySummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);

  const activeCount = liveStrategies.length;
  const strategyLabel = useMemo(() => {
    if (activeCount === 1) return liveStrategies[0]?.name ?? "1 strategy";
    return `${activeCount} strategies`;
  }, [activeCount, liveStrategies]);

  const loadLiveStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/strategies?status=RUNNING&limit=50", {
        credentials: "include",
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      setLiveStrategies(
        readStrategies(json).filter(
          (strategy) => strategy.status === "RUNNING",
        ),
      );
    } catch {
      /* keep the last known live-state banner visible if refresh fails */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLiveStrategies();

    function refreshOnFocus() {
      void loadLiveStrategies();
    }

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loadLiveStrategies]);

  useEffect(() => {
    function handleStrategyEvent(msg: WsMessage) {
      if (
        msg.type === "STRATEGY_STARTED" ||
        msg.type === "STRATEGY_STOPPED" ||
        msg.type === "STRATEGY_ERROR"
      ) {
        void loadLiveStrategies();
      }
    }

    wsManager.addListener(handleStrategyEvent);
    return () => wsManager.removeListener(handleStrategyEvent);
  }, [loadLiveStrategies]);

  async function stopAllLiveStrategies() {
    if (activeCount === 0 || stopping) return;
    const targets = [...liveStrategies];
    setStopping(true);

    const results = await Promise.allSettled(
      targets.map((strategy) =>
        fetch(`/api/v1/strategies/${strategy.id}/stop`, {
          method: "POST",
          credentials: "include",
        }),
      ),
    );

    const failed =
      results.filter((result) => result.status === "rejected").length +
      results.filter(
        (result) => result.status === "fulfilled" && !result.value.ok,
      ).length;

    if (failed > 0) {
      toast.error(
        `Failed to stop ${failed} live ${failed === 1 ? "strategy" : "strategies"}`,
      );
    } else {
      toast.success("All live strategies stopped");
    }

    await loadLiveStrategies();
    setStopping(false);
  }

  if (loading && activeCount === 0) return null;
  if (activeCount === 0) return null;

  return (
    <section
      data-testid="live-trading-safety-banner"
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 border-y border-loss/40 bg-loss/10 px-4 py-3 text-loss sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-label font-semibold uppercase">LIVE MODE</p>
          <p className="text-body-sm text-primary">
            Real orders may be placed by {strategyLabel}.
          </p>
        </div>
      </div>

      <button
        type="button"
        data-testid="emergency-stop-all"
        onClick={() => {
          void stopAllLiveStrategies();
        }}
        disabled={stopping}
        className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-sm border border-loss/50 bg-loss px-3 py-2 text-body-sm font-semibold text-inverse transition-colors hover:bg-loss/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-focus-ring"
      >
        {stopping ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Square className="size-4" aria-hidden="true" />
        )}
        Stop all live strategies
      </button>
    </section>
  );
}
