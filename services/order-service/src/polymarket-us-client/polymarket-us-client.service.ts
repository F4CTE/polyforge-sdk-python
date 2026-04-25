import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PolymarketUS,
  type MarketsListParams,
  type GetMarketsResponse,
  type MarketBook,
  type MarketBBO,
  type CreateOrderParams,
  type CreateOrderResponse,
  type CancelOrderParams,
  type CancelAllOrdersParams,
  type CancelAllOrdersResponse,
  type GetUserPositionsParams,
  type GetUserPositionsResponse,
  type GetActivitiesParams,
  type GetActivitiesResponse,
  RateLimitError,
} from "polymarket-us";

export type { GetMarketsResponse, MarketBook, MarketBBO };
export type { CreateOrderParams, CreateOrderResponse };
export type { GetUserPositionsResponse, GetActivitiesResponse };

export interface PolymarketUsCreds {
  keyId: string;
  secretKey: string;
}

const RETRY_DELAYS_MS = [500, 1000, 2000];
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 20;

@Injectable()
export class PolymarketUsClientService {
  private readonly logger = new Logger(PolymarketUsClientService.name);
  private readonly apiBaseUrl: string;
  private readonly readonlySdk: PolymarketUS;

  // Token-bucket rate limiter (20 req/s global)
  private requestTimestamps: number[] = [];

  constructor(private readonly config: ConfigService) {
    this.apiBaseUrl = this.config.getOrThrow<string>("POLYMARKET_US_API_URL");
    this.readonlySdk = new PolymarketUS({ apiBaseUrl: this.apiBaseUrl });
  }

  // ─── Market data (unauthenticated) ────────────────────────────────────────

  async getMarkets(
    params: MarketsListParams = {},
  ): Promise<GetMarketsResponse> {
    await this.acquireSlot();
    return this.readonlySdk.markets.list(params);
  }

  async getOrderBook(slug: string): Promise<MarketBook> {
    await this.acquireSlot();
    return this.readonlySdk.markets.book(slug);
  }

  async getBBO(slug: string): Promise<MarketBBO> {
    await this.acquireSlot();
    return this.readonlySdk.markets.bbo(slug);
  }

  async getPrice(slug: string): Promise<string | null> {
    await this.acquireSlot();
    const bbo = await this.readonlySdk.markets.bbo(slug);
    return bbo.lastTradePx?.value ?? null;
  }

  // ─── Authenticated operations ─────────────────────────────────────────────

  async submitOrder(
    creds: PolymarketUsCreds,
    params: CreateOrderParams,
  ): Promise<CreateOrderResponse> {
    await this.acquireSlot();
    const sdk = this.makeSdk(creds);
    return this.withRetry(() => sdk.orders.create(params));
  }

  async cancelOrder(
    creds: PolymarketUsCreds,
    orderId: string,
    params: CancelOrderParams,
  ): Promise<void> {
    await this.acquireSlot();
    const sdk = this.makeSdk(creds);
    return this.withRetryVoid(() => sdk.orders.cancel(orderId, params));
  }

  async cancelAll(
    creds: PolymarketUsCreds,
    params?: CancelAllOrdersParams,
  ): Promise<CancelAllOrdersResponse> {
    await this.acquireSlot();
    const sdk = this.makeSdk(creds);
    return this.withRetry(() => sdk.orders.cancelAll(params));
  }

  async getPositions(
    creds: PolymarketUsCreds,
    params?: GetUserPositionsParams,
  ): Promise<GetUserPositionsResponse> {
    await this.acquireSlot();
    const sdk = this.makeSdk(creds);
    return this.withRetry(() => sdk.portfolio.positions(params));
  }

  async getOrderHistory(
    creds: PolymarketUsCreds,
    params?: GetActivitiesParams,
  ): Promise<GetActivitiesResponse> {
    await this.acquireSlot();
    const sdk = this.makeSdk(creds);
    return this.withRetry(() => sdk.portfolio.activities(params));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.acquireSlot();
      await this.readonlySdk.markets.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private makeSdk(creds: PolymarketUsCreds): PolymarketUS {
    return new PolymarketUS({
      apiBaseUrl: this.apiBaseUrl,
      keyId: creds.keyId,
      secretKey: creds.secretKey,
    });
  }

  private async acquireSlot(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );

    if (this.requestTimestamps.length >= RATE_LIMIT_MAX) {
      const oldest = this.requestTimestamps[0];
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 1;
      this.logger.warn(
        `US API rate limit reached, waiting ${waitMs}ms before next request`,
      );
      await sleep(waitMs);
      // Re-run cleanup after waiting
      const after = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(
        (t) => after - t < RATE_LIMIT_WINDOW_MS,
      );
    }

    this.requestTimestamps.push(Date.now());
  }

  private async withRetry<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await call();
      } catch (err) {
        if (err instanceof RateLimitError && attempt < RETRY_DELAYS_MS.length) {
          this.logger.warn(
            `Polymarket US 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
          );
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Polymarket US API error 429: rate limit exhausted");
  }

  private async withRetryVoid(call: () => Promise<void>): Promise<void> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await call();
        return;
      } catch (err) {
        if (err instanceof RateLimitError && attempt < RETRY_DELAYS_MS.length) {
          this.logger.warn(
            `Polymarket US 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
          );
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Polymarket US API error 429: rate limit exhausted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
