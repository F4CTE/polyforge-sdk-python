import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { VenuePriceFeed, RawPriceEvent } from "./venue-data-router";

@Injectable()
export class KalshiPriceFeed implements VenuePriceFeed {
  readonly venueId = "kalshi" as const;
  private handler: ((event: RawPriceEvent) => void) | null = null;
  private healthy = true;

  subscribe(handler: (event: RawPriceEvent) => void): void {
    this.handler = handler;
  }

  unsubscribe(): void {
    this.handler = null;
  }

  subscribeTokens(_tokenIds: string[]): void {
    // Token subscription is managed by KalshiFeedService.subscribeMarkets() separately.
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  @OnEvent("market-data.price.raw.kalshi")
  handleRawPriceEvent(event: RawPriceEvent & { venueId?: string }): void {
    if (this.handler && (!event.venueId || event.venueId === "kalshi")) {
      this.handler(event);
    }
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }
}
