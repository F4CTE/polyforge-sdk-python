import { Injectable, Logger } from "@nestjs/common";
import type {
  VenueAdapter,
  VenueOrderRequest,
  VenueOrderResponse,
} from "@polyforge/shared-types";

export type VenueSelection =
  | "polymarket"
  | "kalshi"
  | "best"
  | undefined
  | null;

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
   * Compares asks across all registered adapters for a given outcomeId and
   * returns the adapter offering the best (lowest) ask price.
   * Falls back to polymarket if all other adapters fail.
   */
  async resolveBest(outcomeId: string): Promise<VenueAdapter> {
    const adapters = Array.from(this.registry.values());
    if (adapters.length === 1) return adapters[0];

    const results = await Promise.allSettled(
      adapters.map(async (a) => {
        const book = await a.getOrderBook(outcomeId);
        const bestAsk = book.asks[0];
        return { adapter: a, ask: bestAsk ? Number(bestAsk.price) : Infinity };
      }),
    );

    let best: { adapter: VenueAdapter; ask: number } | null = null;
    for (const r of results) {
      if (r.status === "fulfilled" && (!best || r.value.ask < best.ask)) {
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
  ): Promise<VenueOrderResponse> {
    const adapter =
      venue === "best"
        ? await this.resolveBest(req.venueOutcomeId)
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
