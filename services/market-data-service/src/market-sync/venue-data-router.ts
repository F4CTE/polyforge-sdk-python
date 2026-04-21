import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { VenueId } from "@polyforge/shared-types";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RawPriceEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface UnifiedPriceEvent extends RawPriceEvent {
  venueId: VenueId;
}

/** Minimal contract for a venue's price feed source. */
export interface VenuePriceFeed {
  readonly venueId: VenueId;
  subscribe(handler: (event: RawPriceEvent) => void): void;
  unsubscribe(): void;
  subscribeTokens(tokenIds: string[]): void;
  isHealthy(): boolean;
}

// ─── Router ───────────────────────────────────────────────────────────────────

@Injectable()
export class VenueDataRouter {
  private readonly logger = new Logger(VenueDataRouter.name);
  private readonly feeds = new Map<VenueId, VenuePriceFeed>();

  constructor(
    feeds: VenuePriceFeed[],
    private readonly emitter: EventEmitter2,
  ) {
    for (const feed of feeds) {
      this.feeds.set(feed.venueId, feed);
      feed.subscribe((event) => this.onPriceUpdate(feed.venueId, event));
    }
  }

  /** Returns all registered feeds. */
  getFeeds(): VenuePriceFeed[] {
    return Array.from(this.feeds.values());
  }

  /** Returns the feed for a specific venue, or undefined. */
  getFeed(venueId: VenueId): VenuePriceFeed | undefined {
    return this.feeds.get(venueId);
  }

  /**
   * Called by individual venue feeds when a price update arrives.
   * Emits a unified `market-data.price` event with venueId attached.
   */
  onPriceUpdate(venueId: VenueId | string, event: RawPriceEvent): void {
    if (!this.feeds.has(venueId as VenueId)) {
      this.logger.warn(
        `Received price update from unregistered venue '${venueId}' — ignoring`,
      );
      return;
    }
    const unified: UnifiedPriceEvent = {
      ...event,
      venueId: venueId as VenueId,
    };
    this.emitter.emit("market-data.price", unified);
  }

  /** Delegates token subscription to a specific venue feed. */
  subscribeTokens(venueId: VenueId, tokenIds: string[]): void {
    const feed = this.feeds.get(venueId);
    if (!feed) {
      throw new Error(`No feed registered for venue '${venueId}'`);
    }
    feed.subscribeTokens(tokenIds);
  }

  /** Returns a health map for all registered feeds. */
  healthCheck(): Map<VenueId, boolean> {
    const result = new Map<VenueId, boolean>();
    for (const [venueId, feed] of this.feeds) {
      result.set(venueId, feed.isHealthy());
    }
    return result;
  }

  destroy(): void {
    for (const feed of this.feeds.values()) {
      try {
        feed.unsubscribe();
      } catch {
        // best-effort cleanup
      }
    }
  }
}
