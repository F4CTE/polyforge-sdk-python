import { Injectable, Logger } from "@nestjs/common";
import type {
  VenueAdapter,
  VenueOrderRequest,
  VenueOrderResponse,
} from "@polyforge/shared-types";

import type { VenueId } from "@polyforge/shared-types";

export type VenueSelection = VenueId | "best" | undefined | null;

export interface FeeContext {
  feeBpsByVenue: Record<string, number>;
}

@Injectable()
export class VenueRouter {
  private readonly logger = new Logger(VenueRouter.name);
  private readonly registry = new Map<string, VenueAdapter>();

  constructor(adapters: VenueAdapter[]) {
    for (const adapter of adapters) {
      this.registry.set(adapter.venueId, adapter);
    }
  }

  /** Returns the adapter for a specific venue, defaulting to polymarket. */
  resolve(venue: VenueSelection): VenueAdapter {
    if (!venue || venue === "best") {
      return this.getOrThrow("polymarket");
    }
    return this.getOrThrow(venue);
  }

  /**
   * Compares total cost (ask + fees) across all registered adapters for a
   * given outcomeId. When feeContext is provided, the fee in bps is added to
   * each ask price so the cheapest *effective* venue wins.
   * Falls back to polymarket if all other adapters fail.
   */
  async resolveBest(
    outcomeId: string,
    feeContext?: FeeContext,
  ): Promise<VenueAdapter> {
    const adapters = Array.from(this.registry.values());
    if (adapters.length === 1) return adapters[0];

    const results = await Promise.allSettled(
      adapters.map(async (a) => {
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
  ): Promise<VenueOrderResponse> {
    const adapter =
      venue === "best"
        ? await this.resolveBest(req.venueOutcomeId, feeContext)
        : this.resolve(venue);
    return adapter.submitOrder(req);
  }

  /** Returns all registered adapters. */
  getAdapters(): VenueAdapter[] {
    return Array.from(this.registry.values());
  }

  private getOrThrow(venueId: string): VenueAdapter {
    const adapter = this.registry.get(venueId);
    if (!adapter) {
      throw new Error(`No adapter registered for venue '${venueId}'`);
    }
    return adapter;
  }
}
