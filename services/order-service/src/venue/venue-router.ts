import { Injectable, Logger } from "@nestjs/common";
import type {
  VenueAdapter,
  VenueOrderRequest,
  VenueOrderResponse,
} from "@polyforge/shared-types";

import type { VenueId } from "@polyforge/shared-types";

export type VenueSelection = VenueId | "best" | undefined | null;

export type RailMode = "auto" | "global" | "us";

export interface FeeContext {
  feeBpsByVenue: Record<string, number>;
}

/**
 * User jurisdiction context used to select the correct Polymarket rail.
 * Only the two fields the router needs — intentionally narrow to avoid
 * leaking full Prisma user objects into the venue layer.
 */
export interface UserRailContext {
  /** ISO 3166-1 alpha-2 country code from the user record (set at credential import time). */
  country?: string | null;
  /** True when the user has stored Polymarket US Ed25519 credentials. */
  polymarketUsConnected?: boolean;
  /** True when the user has connected global Polymarket credentials. */
  polymarketConnected?: boolean;
  /** True when the Prisma user lookup failed — callers should fail closed. */
  lookupFailed?: boolean;
}

@Injectable()
export class VenueRouter {
  private readonly logger = new Logger(VenueRouter.name);
  private readonly registry = new Map<string, VenueAdapter>();

  /**
   * @param adapters Registered venue adapters (from VenueModule factory).
   * @param railMode POLYMARKET_RAIL env var: "auto" (default) | "global" | "us".
   */
  constructor(
    adapters: VenueAdapter[],
    readonly railMode: RailMode = "auto",
  ) {
    for (const adapter of adapters) {
      this.registry.set(adapter.venueId, adapter);
    }
  }

  /**
   * Returns the adapter for a specific venue.
   *
   * When venue is "polymarket" (or absent/best), the active rail is determined
   * by POLYMARKET_RAIL and the user's jurisdiction:
   *   - "global" → always use global polymarket
   *   - "us"     → always use polymarket_us (requires adapter registered)
   *   - "auto"   → redirect US users with US credentials to polymarket_us
   */
  resolve(venue: VenueSelection, userCtx?: UserRailContext): VenueAdapter {
    if (!venue || venue === "best") {
      return this.getOrThrow(this.pickPolymarketVenueId(userCtx));
    }
    if (venue === "polymarket") {
      return this.getOrThrow(this.pickPolymarketVenueId(userCtx));
    }
    return this.getOrThrow(venue);
  }

  /**
   * Compares total cost (ask + fees) across all eligible adapters for a
   * given outcomeId. Adapters are filtered by user jurisdiction so that:
   *   - Non-US users never see polymarket_us
   *   - US users with US credentials skip the global polymarket rail in "auto" mode
   *
   * Falls back to global polymarket if all eligible adapters fail.
   */
  async resolveBest(
    outcomeId: string,
    feeContext?: FeeContext,
    userCtx?: UserRailContext,
  ): Promise<VenueAdapter> {
    const eligible = Array.from(this.registry.values()).filter((a) =>
      this.isEligible(a, userCtx),
    );

    if (eligible.length === 0) {
      this.logger.warn(
        "No eligible adapters for resolveBest — falling back to global polymarket",
      );
      return this.getOrThrow("polymarket");
    }

    if (eligible.length === 1) return eligible[0];

    const results = await Promise.allSettled(
      eligible.map(async (a) => {
        const book = await a.getOrderBook(outcomeId);
        const bestAsk = book.asks[0];
        const askPrice = bestAsk ? Number(bestAsk.price) : Infinity;
        const feeBps = feeContext?.feeBpsByVenue[a.venueId] ?? 0;
        const effectiveCost = askPrice * (1 + feeBps / 10000);
        return { adapter: a, effectiveCost };
      }),
    );

    let best: { adapter: VenueAdapter; effectiveCost: number } | null = null;
    for (const r of results) {
      if (
        r.status === "fulfilled" &&
        (!best || r.value.effectiveCost < best.effectiveCost)
      ) {
        best = r.value;
      }
    }

    if (!best) {
      this.logger.warn(
        "All adapters failed resolveBest — defaulting to polymarket",
      );
      return this.getOrThrow("polymarket");
    }

    return best.adapter;
  }

  /** Routes an order to the correct adapter and returns the response. */
  async route(
    venue: VenueSelection,
    req: VenueOrderRequest,
    feeContext?: FeeContext,
    userCtx?: UserRailContext,
  ): Promise<VenueOrderResponse> {
    const adapter =
      venue === "best"
        ? await this.resolveBest(req.venueOutcomeId, feeContext, userCtx)
        : this.resolve(venue, userCtx);
    return adapter.submitOrder(req);
  }

  /** Returns all registered adapters. */
  getAdapters(): VenueAdapter[] {
    return Array.from(this.registry.values());
  }

  /**
   * Returns the Polymarket venue ID the user should be routed to, based on
   * POLYMARKET_RAIL mode and user jurisdiction.
   */
  private pickPolymarketVenueId(userCtx?: UserRailContext): string {
    if (this.railMode === "global") return "polymarket";
    if (this.railMode === "us") return "polymarket_us";
    // auto: redirect US users with US credentials when the US adapter is registered
    if (
      userCtx?.country === "US" &&
      userCtx.polymarketUsConnected &&
      this.registry.has("polymarket_us")
    ) {
      return "polymarket_us";
    }
    return "polymarket";
  }

  /**
   * Returns true if the adapter should be considered for this user in
   * resolveBest(). Prevents cross-jurisdiction price comparisons.
   */
  private isEligible(
    adapter: VenueAdapter,
    userCtx?: UserRailContext,
  ): boolean {
    if (adapter.venueId === "polymarket_us") {
      if (this.railMode === "global") return false;
      if (this.railMode === "us") return true;
      // auto: eligible only for US users with US credentials
      return userCtx?.country === "US" && !!userCtx.polymarketUsConnected;
    }
    if (adapter.venueId === "polymarket") {
      if (this.railMode === "us") return false;
      // In auto mode, US users with US credentials use only the US rail
      if (
        this.railMode === "auto" &&
        userCtx?.country === "US" &&
        userCtx.polymarketUsConnected &&
        this.registry.has("polymarket_us")
      ) {
        return false;
      }
    }
    return true;
  }

  private getOrThrow(venueId: string): VenueAdapter {
    const adapter = this.registry.get(venueId);
    if (!adapter) {
      throw new Error(`No adapter registered for venue '${venueId}'`);
    }
    return adapter;
  }
}
