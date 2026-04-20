import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KalshiAuthService } from "./kalshi-auth.service";

const RETRY_DELAYS_MS = [500, 1000, 2000];

export interface KalshiMarket {
  ticker: string;
  status: string;
  title?: string;
  category?: string;
  close_time?: string;
  yes_ask?: number;
  yes_bid?: number;
  no_ask?: number;
  no_bid?: number;
  last_price?: number;
  volume?: number;
  open_interest?: number;
}

export interface KalshiOrderBook {
  yes: Array<{ price: number; quantity: number }>;
  no: Array<{ price: number; quantity: number }>;
}

export interface KalshiPlaceOrderRequest {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  type: "limit" | "market";
  yes_price?: number;
  no_price?: number;
  expiration_ts?: number;
}

export interface KalshiOrderResponse {
  order_id: string;
  status: string;
  ticker?: string;
  side?: string;
  action?: string;
  count?: number;
  yes_price?: number;
  no_price?: number;
}

export interface KalshiPosition {
  ticker: string;
  position: number;
  resting_orders_count: number;
  market_exposure?: string;
  realized_pnl?: string;
  total_cost?: string;
}

export interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: string;
  action: string;
  count: number;
  status: string;
  yes_price?: number;
  no_price?: number;
  created_time?: string;
}

export interface KalshiMarketsParams {
  limit?: number;
  offset?: number;
  status?: string;
  ticker?: string;
}

@Injectable()
export class KalshiRestService {
  private readonly logger = new Logger(KalshiRestService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly auth: KalshiAuthService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl =
      this.config.get<string>("KALSHI_BASE_URL") ??
      "https://demo-api.kalshi.co/trade-api/v2";
  }

  // ─── Price normalization (pure, static) ──────────────────────────────────

  static normalizeKalshiPrice(centPrice: number): number {
    return centPrice / 100;
  }

  static denormalizeKalshiPrice(normalizedPrice: number): number {
    return Math.round(normalizedPrice * 100);
  }

  // ─── REST endpoints ───────────────────────────────────────────────────────

  async getMarkets(params: KalshiMarketsParams): Promise<KalshiMarket[]> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("cursor", String(params.offset));
    if (params.status) qs.set("status", params.status);
    if (params.ticker) qs.set("ticker", params.ticker);

    const result = await this.withRetry<{ markets: KalshiMarket[] }>(
      () => this.get(`/markets?${qs.toString()}`),
      "user",
    );
    return result.markets;
  }

  async getMarket(ticker: string): Promise<KalshiMarket> {
    const result = await this.withRetry<{ market: KalshiMarket }>(
      () => this.get(`/markets/${encodeURIComponent(ticker)}`),
      "user",
    );
    return result.market;
  }

  async getOrderBook(ticker: string): Promise<KalshiOrderBook> {
    const result = await this.withRetry<{ orderbook: KalshiOrderBook }>(
      () => this.get(`/markets/${encodeURIComponent(ticker)}/orderbook`),
      "user",
    );
    return result.orderbook;
  }

  async placeOrder(req: KalshiPlaceOrderRequest): Promise<KalshiOrderResponse> {
    const result = await this.withRetry<{ order: KalshiOrderResponse }>(
      () =>
        this.post(
          "/portfolio/orders",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.withRetryVoid(
      () => this.delete(`/portfolio/orders/${encodeURIComponent(orderId)}`),
      "user",
    );
  }

  async getPositions(_userId: string): Promise<KalshiPosition[]> {
    const result = await this.withRetry<{
      market_positions: KalshiPosition[];
    }>(() => this.get("/portfolio/positions"), "user");
    return result.market_positions;
  }

  async getOrders(_userId: string, limit: number): Promise<KalshiOrder[]> {
    const qs = new URLSearchParams({ limit: String(limit) });
    const result = await this.withRetry<{ orders: KalshiOrder[] }>(
      () => this.get(`/portfolio/orders?${qs.toString()}`),
      "user",
    );
    return result.orders;
  }

  async getBalance(): Promise<{ balance: number }> {
    return this.withRetry<{ balance: number }>(
      () => this.get("/portfolio/balance"),
      "user",
    );
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────

  private async get(path: string): Promise<Response> {
    const token = await this.auth.getToken("user");
    return fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const token = await this.auth.getToken("user");
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  }

  private async delete(path: string): Promise<Response> {
    const token = await this.auth.getToken("user");
    return fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  // ─── Retry logic ──────────────────────────────────────────────────────────

  private async withRetry<T>(
    call: () => Promise<Response>,
    _userId: string,
  ): Promise<T> {
    const res = await this.retryOn429(call);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      const rawBody = await res.text().catch(() => "<unreadable>");
      throw new Error(
        `Kalshi API returned unparseable response (${res.status}): ${rawBody.slice(0, 200)}`,
      );
    }
    return data as T;
  }

  private async withRetryVoid(
    call: () => Promise<Response>,
    _userId: string,
  ): Promise<void> {
    await this.retryOn429(call);
  }

  private async retryOn429(call: () => Promise<Response>): Promise<Response> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      let res: Response;
      try {
        res = await call();
      } catch (err: unknown) {
        // Network errors (TypeError) and timeout aborts (AbortError) are retryable
        if (
          attempt < RETRY_DELAYS_MS.length &&
          (err instanceof TypeError ||
            (err instanceof DOMException && err.name === "AbortError"))
        ) {
          this.logger.warn(
            `Kalshi network error (${(err as Error).message}), retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
          );
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw err;
      }

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        this.logger.warn(
          `Kalshi 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Kalshi API error ${res.status}: ${body}`);
      }

      return res;
    }

    throw new Error("Kalshi API error 429: rate limit exhausted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
