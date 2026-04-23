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

export interface KalshiCandlestick {
  end_period_ts: number;
  price: { open: number; close: number; high: number; low: number };
  volume: number;
}

export interface KalshiMarketsParams {
  limit?: number;
  offset?: number;
  status?: string;
  ticker?: string;
}

// ─── Phase 2: Cursor-based pagination ─────────────────────────────────────

export interface KalshiCursorParams {
  limit?: number;
  cursor?: string;
}

// ─── Phase 2: Events API ──────────────────────────────────────────────────

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title: string;
  mutually_exclusive: boolean;
  category: string;
  collateral_return_type?: string;
  strike_date?: string;
  strike_period?: string;
  markets?: KalshiMarket[];
  available_on_brokers?: boolean;
  product_metadata?: Record<string, unknown>;
  last_updated_ts?: string;
}

export interface KalshiEventsParams extends KalshiCursorParams {
  status?: "open" | "closed" | "settled";
  series_ticker?: string;
  with_nested_markets?: boolean;
  min_close_ts?: number;
  min_updated_ts?: number;
}

export interface KalshiEventMetadata {
  image_url: string;
  featured_image_url?: string;
  market_details: Array<{
    market_ticker: string;
    image_url: string;
    color_code: string;
  }>;
  settlement_sources: Array<{ name?: string; url?: string }>;
  competition?: string;
  competition_scope?: string;
}

export interface KalshiForecastPoint {
  event_ticker: string;
  end_period_ts: number;
  period_interval: number;
  percentile_points: Array<{
    percentile: number;
    raw_numerical_forecast: number;
    numerical_forecast: number;
    formatted_forecast: string;
  }>;
}

export interface KalshiForecastParams {
  series_ticker: string;
  event_ticker: string;
  percentiles: number[];
  start_ts: number;
  end_ts: number;
  period_interval: number;
}

export interface KalshiMultivariateCollection {
  collection_ticker: string;
  series_ticker: string;
  title: string;
  description: string;
  open_date: string;
  close_date: string;
  associated_events: Array<{
    ticker: string;
    is_yes_only: boolean;
    size_max?: number;
    size_min?: number;
    active_quoters: string[];
  }>;
  is_ordered: boolean;
  size_min: number;
  size_max: number;
  functional_description: string;
}

// ─── Phase 2: Order amendments ────────────────────────────────────────────

export interface KalshiAmendOrderRequest {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  client_order_id?: string;
  updated_client_order_id?: string;
  yes_price?: number;
  no_price?: number;
  count?: number;
}

export interface KalshiAmendOrderResponse {
  old_order: KalshiOrderDetail;
  order: KalshiOrderDetail;
}

export interface KalshiDecreaseOrderRequest {
  reduce_by?: number;
  reduce_to?: number;
}

// ─── Phase 2: Batch operations ────────────────────────────────────────────

export interface KalshiBatchOrderResult {
  client_order_id?: string;
  order?: KalshiOrderDetail;
  error?: { code?: string; message?: string };
}

export interface KalshiBatchCancelResult {
  order_id: string;
  order?: KalshiOrderDetail;
  reduced_by: number;
  error?: { code?: string; message?: string };
}

// ─── Phase 2: Fills ───────────────────────────────────────────────────────

export interface KalshiFill {
  fill_id: string;
  trade_id: string;
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  yes_price: number;
  no_price: number;
  is_taker: boolean;
  created_time?: string;
  fee_cost?: string;
}

export interface KalshiFillsParams extends KalshiCursorParams {
  ticker?: string;
  order_id?: string;
  min_ts?: number;
  max_ts?: number;
}

// ─── Phase 2: Settlements ─────────────────────────────────────────────────

export interface KalshiSettlement {
  ticker: string;
  event_ticker: string;
  market_result: "yes" | "no" | "scalar" | "void";
  yes_count: number;
  no_count: number;
  yes_total_cost: number;
  no_total_cost: number;
  revenue: number;
  settled_time: string;
  fee_cost?: string;
  value?: number;
}

export interface KalshiSettlementsParams extends KalshiCursorParams {
  ticker?: string;
  event_ticker?: string;
  min_ts?: number;
  max_ts?: number;
}

// ─── Phase 2: Trades ──────────────────────────────────────────────────────

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  count: number;
  yes_price: number;
  no_price: number;
  taker_side: "yes" | "no";
  created_time?: string;
}

export interface KalshiTradesParams extends KalshiCursorParams {
  ticker?: string;
  min_ts?: number;
  max_ts?: number;
}

// ─── Phase 2: Exchange ────────────────────────────────────────────────────

export interface KalshiExchangeStatus {
  exchange_active: boolean;
  trading_active: boolean;
  exchange_estimated_resume_time?: string;
}

export interface KalshiDailySchedule {
  open_time: string;
  close_time: string;
}

export interface KalshiWeeklySchedule {
  start_time: string;
  end_time: string;
  monday: KalshiDailySchedule[];
  tuesday: KalshiDailySchedule[];
  wednesday: KalshiDailySchedule[];
  thursday: KalshiDailySchedule[];
  friday: KalshiDailySchedule[];
  saturday: KalshiDailySchedule[];
  sunday: KalshiDailySchedule[];
}

export interface KalshiExchangeSchedule {
  standard_hours: KalshiWeeklySchedule[];
  maintenance_windows: Array<{
    start_datetime: string;
    end_datetime: string;
  }>;
}

// ─── Phase 2: Detailed order (shared by amend, batch, decrease) ───────────

export interface KalshiOrderDetail {
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  type: "limit" | "market";
  status: "resting" | "canceled" | "executed";
  yes_price: number;
  no_price: number;
  fill_count: number;
  remaining_count: number;
  initial_count: number;
  taker_fees: number;
  maker_fees: number;
  created_time?: string;
  last_update_time?: string;
  client_order_id?: string;
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

  async getCandlesticks(
    ticker: string,
    periodInterval: number,
  ): Promise<KalshiCandlestick[]> {
    const qs = new URLSearchParams({
      series_ticker: ticker,
      period_interval: String(periodInterval),
    });
    const result = await this.withRetry<{
      candlesticks: KalshiCandlestick[];
    }>(
      () =>
        this.get(
          `/markets/${encodeURIComponent(ticker)}/candlesticks?${qs.toString()}`,
        ),
      "user",
    );
    return result.candlesticks ?? [];
  }

  // ─── Phase 2: Events API ─────────────────────────────────────────────────

  async getEvents(
    params: KalshiEventsParams = {},
  ): Promise<{ events: KalshiEvent[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.status) qs.set("status", params.status);
    if (params.series_ticker) qs.set("series_ticker", params.series_ticker);
    if (params.with_nested_markets)
      qs.set("with_nested_markets", String(params.with_nested_markets));
    if (params.min_close_ts !== undefined)
      qs.set("min_close_ts", String(params.min_close_ts));
    if (params.min_updated_ts !== undefined)
      qs.set("min_updated_ts", String(params.min_updated_ts));

    return this.withRetry<{ events: KalshiEvent[]; cursor: string }>(
      () => this.get(`/events?${qs.toString()}`),
      "user",
    );
  }

  async getEvent(
    eventTicker: string,
    withNestedMarkets = false,
  ): Promise<{ event: KalshiEvent; markets: KalshiMarket[] }> {
    const qs = new URLSearchParams();
    if (withNestedMarkets) qs.set("with_nested_markets", "true");
    return this.withRetry<{ event: KalshiEvent; markets: KalshiMarket[] }>(
      () =>
        this.get(`/events/${encodeURIComponent(eventTicker)}?${qs.toString()}`),
      "user",
    );
  }

  async getEventMetadata(eventTicker: string): Promise<KalshiEventMetadata> {
    return this.withRetry<KalshiEventMetadata>(
      () => this.get(`/events/${encodeURIComponent(eventTicker)}/metadata`),
      "user",
    );
  }

  async getForecastPercentileHistory(
    params: KalshiForecastParams,
  ): Promise<KalshiForecastPoint[]> {
    const qs = new URLSearchParams({
      start_ts: String(params.start_ts),
      end_ts: String(params.end_ts),
      period_interval: String(params.period_interval),
    });
    for (const p of params.percentiles) qs.append("percentiles", String(p));

    const result = await this.withRetry<{
      forecast_history: KalshiForecastPoint[];
    }>(
      () =>
        this.get(
          `/series/${encodeURIComponent(params.series_ticker)}/events/${encodeURIComponent(params.event_ticker)}/forecast_percentile_history?${qs.toString()}`,
        ),
      "user",
    );
    return result.forecast_history ?? [];
  }

  async getMultivariateCollection(
    collectionTicker: string,
  ): Promise<KalshiMultivariateCollection> {
    const result = await this.withRetry<{
      multivariate_contract: KalshiMultivariateCollection;
    }>(
      () =>
        this.get(
          `/multivariate_event_collections/${encodeURIComponent(collectionTicker)}`,
        ),
      "user",
    );
    return result.multivariate_contract;
  }

  // ─── Phase 2: Order amendments ────────────────────────────────────────────

  async amendOrder(
    orderId: string,
    req: KalshiAmendOrderRequest,
  ): Promise<KalshiAmendOrderResponse> {
    return this.withRetry<KalshiAmendOrderResponse>(
      () =>
        this.post(
          `/portfolio/orders/${encodeURIComponent(orderId)}/amend`,
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
  }

  async decreaseOrder(
    orderId: string,
    req: KalshiDecreaseOrderRequest,
  ): Promise<KalshiOrderDetail> {
    const result = await this.withRetry<{ order: KalshiOrderDetail }>(
      () =>
        this.post(
          `/portfolio/orders/${encodeURIComponent(orderId)}/decrease`,
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.order;
  }

  // ─── Phase 2: Batch operations ────────────────────────────────────────────

  async batchCreateOrders(
    orders: KalshiPlaceOrderRequest[],
  ): Promise<KalshiBatchOrderResult[]> {
    const result = await this.withRetry<{
      orders: KalshiBatchOrderResult[];
    }>(
      () =>
        this.post("/portfolio/orders/batched", {
          orders: orders as unknown as Record<string, unknown>[],
        }),
      "user",
    );
    return result.orders;
  }

  async batchCancelOrders(
    orderIds: string[],
  ): Promise<KalshiBatchCancelResult[]> {
    const result = await this.withRetry<{
      orders: KalshiBatchCancelResult[];
    }>(
      () => this.deleteWithBody("/portfolio/orders/batched", { ids: orderIds }),
      "user",
    );
    return result.orders;
  }

  // ─── Phase 2: Portfolio fills ─────────────────────────────────────────────

  async getFills(
    params: KalshiFillsParams = {},
  ): Promise<{ fills: KalshiFill[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.order_id) qs.set("order_id", params.order_id);
    if (params.min_ts !== undefined) qs.set("min_ts", String(params.min_ts));
    if (params.max_ts !== undefined) qs.set("max_ts", String(params.max_ts));

    return this.withRetry<{ fills: KalshiFill[]; cursor: string }>(
      () => this.get(`/portfolio/fills?${qs.toString()}`),
      "user",
    );
  }

  // ─── Phase 2: Portfolio settlements ───────────────────────────────────────

  async getSettlements(
    params: KalshiSettlementsParams = {},
  ): Promise<{ settlements: KalshiSettlement[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.event_ticker) qs.set("event_ticker", params.event_ticker);
    if (params.min_ts !== undefined) qs.set("min_ts", String(params.min_ts));
    if (params.max_ts !== undefined) qs.set("max_ts", String(params.max_ts));

    return this.withRetry<{
      settlements: KalshiSettlement[];
      cursor: string;
    }>(() => this.get(`/portfolio/settlements?${qs.toString()}`), "user");
  }

  // ─── Phase 2: Multiple orderbooks ────────────────────────────────────────

  async getOrderBooks(
    tickers: string[],
  ): Promise<Map<string, KalshiOrderBook>> {
    const results = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const book = await this.getOrderBook(ticker);
          return [ticker, book] as const;
        } catch (err) {
          this.logger.warn(
            `Failed to fetch orderbook for ${ticker}: ${String(err)}`,
          );
          return [ticker, null] as const;
        }
      }),
    );
    const map = new Map<string, KalshiOrderBook>();
    for (const [ticker, book] of results) {
      if (book) map.set(ticker, book);
    }
    return map;
  }

  // ─── Phase 2: Exchange status ─────────────────────────────────────────────

  async getExchangeStatus(): Promise<KalshiExchangeStatus> {
    return this.withRetry<KalshiExchangeStatus>(
      () => this.get("/exchange/status"),
      "user",
    );
  }

  async getExchangeSchedule(): Promise<KalshiExchangeSchedule> {
    const result = await this.withRetry<{
      schedule: KalshiExchangeSchedule;
    }>(() => this.get("/exchange/schedule"), "user");
    return result.schedule;
  }

  // ─── Phase 2: Market trades ───────────────────────────────────────────────

  async getTrades(
    params: KalshiTradesParams = {},
  ): Promise<{ trades: KalshiTrade[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.min_ts !== undefined) qs.set("min_ts", String(params.min_ts));
    if (params.max_ts !== undefined) qs.set("max_ts", String(params.max_ts));

    return this.withRetry<{ trades: KalshiTrade[]; cursor: string }>(
      () => this.get(`/markets/trades?${qs.toString()}`),
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

  private async deleteWithBody(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const token = await this.auth.getToken("user");
    return fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
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
