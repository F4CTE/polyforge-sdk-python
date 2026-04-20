import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { VenuePriceFeed, RawPriceEvent } from "./venue-data-router";

/**
 * Bridges the existing PolymarketWsService (EventEmitter-based) into the
 * VenuePriceFeed interface expected by VenueDataRouter.
 *
 * PolymarketWsService emits `market-data.price` events directly onto the
 * EventEmitter. This adapter intercepts those events and forwards them to
 * any handler registered via subscribe().
 */
@Injectable()
export class PolymarketPriceFeed implements VenuePriceFeed {
  readonly venueId = "polymarket" as const;
  private handler: ((event: RawPriceEvent) => void) | null = null;
  private healthy = true;

  subscribe(handler: (event: RawPriceEvent) => void): void {
    this.handler = handler;
  }

  unsubscribe(): void {
    this.handler = null;
  }

  subscribeTokens(_tokenIds: string[]): void {
    // Token subscription is managed by PolymarketWsService separately.
    // This is a no-op here; call PolymarketWsService.subscribeToTokens() directly.
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  @OnEvent("market-data.price.raw.polymarket")
  handleRawPriceEvent(event: RawPriceEvent & { venueId?: string }): void {
    if (this.handler && (!event.venueId || event.venueId === "polymarket")) {
      this.handler(event);
    }
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }
}
