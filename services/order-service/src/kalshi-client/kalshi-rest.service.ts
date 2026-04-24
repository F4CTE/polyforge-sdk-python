import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KalshiAuthService } from "./kalshi-auth.service";

const RETRY_DELAYS_MS = [500, 1000, 2000];

// ─── Shared format helpers (ts_ms / _dollars migration) ─────────────────────

export function parseKalshiTimestamp(msg: Record<string, unknown>): number {
  if (typeof msg["ts_ms"] === "number") return msg["ts_ms"];
  if (typeof msg["ts"] === "number") return msg["ts"] * 1000;
  return Date.now();
}

export function parseKalshiDollars(value: unknown): number | undefined {
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

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
  yes_ask_dollars?: string;
  yes_bid_dollars?: string;
  no_ask_dollars?: string;
  no_bid_dollars?: string;
  last_price_dollars?: string;
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
  count_fp?: string;
  type: "limit" | "market";
  yes_price?: number;
  no_price?: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  expiration_ts?: number;
  client_order_id?: string;
  self_trade_prevention_type?: "taker_at_cross" | "maker";
  post_only?: boolean;
  reduce_only?: boolean;
  cancel_order_on_pause?: boolean;
}

export interface KalshiOrderResponse {
  order_id: string;
  status: string;
  ticker?: string;
  side?: string;
  action?: string;
  count?: number;
  count_fp?: string;
  yes_price?: number;
  no_price?: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  client_order_id?: string;
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
  count_fp?: string;
  status: string;
  yes_price?: number;
  no_price?: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  created_time?: string;
  client_order_id?: string;
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
  yes_price_dollars?: string;
  no_price_dollars?: string;
  count?: number;
  count_fp?: string;
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
  count_fp?: string;
  yes_price: number;
  no_price: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
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
  count_fp?: string;
  yes_price: number;
  no_price: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
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
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fill_count: number;
  remaining_count: number;
  initial_count: number;
  count_fp?: string;
  taker_fees: number;
  maker_fees: number;
  created_time?: string;
  last_update_time?: string;
  client_order_id?: string;
}

// ─── Phase 3: Order groups ──────────────────────────────────────────────────

export interface KalshiOrderGroup {
  id: string;
  max_loss: number;
  created_time?: string;
  status?: string;
}

export interface KalshiCreateOrderGroupRequest {
  max_loss: number;
  market_tickers?: string[];
}

export interface KalshiUpdateOrderGroupRequest {
  max_loss: number;
}

// ─── Phase 3: Historical data ───────────────────────────────────────────────

export interface KalshiHistoricalMarketsParams extends KalshiCursorParams {
  min_close_ts?: number;
  max_close_ts?: number;
  status?: string;
  ticker?: string;
  event_ticker?: string;
}

export interface KalshiHistoricalCandlesticksParams {
  start_ts?: number;
  end_ts?: number;
  period_interval?: number;
}

export interface KalshiHistoricalOrdersParams extends KalshiCursorParams {
  ticker?: string;
  status?: string;
  min_ts?: number;
  max_ts?: number;
}

export interface KalshiCutoffTimestamps {
  markets_cutoff_ts: number;
  fills_cutoff_ts: number;
  orders_cutoff_ts: number;
  trades_cutoff_ts: number;
}

// ─── Phase 3: Subaccounts ───────────────────────────────────────────────────

export interface KalshiSubaccount {
  id: string;
  name?: string;
  created_time?: string;
}

export interface KalshiCreateSubaccountRequest {
  name?: string;
}

export interface KalshiSubaccountBalance {
  subaccount_id: string;
  balance: number;
  available_balance?: number;
}

export interface KalshiSubaccountTransferRequest {
  from_subaccount_id: string;
  to_subaccount_id: string;
  amount: number;
}

export interface KalshiSubaccountNettingConfig {
  netting_enabled: boolean;
}

// ─── Phase 3: Search and filters ────────────────────────────────────────────

export interface KalshiSportFilter {
  sport: string;
  league?: string;
  filters: Array<{ key: string; values: string[] }>;
}

export interface KalshiSeriesTag {
  tag: string;
  series_tickers: string[];
}

// ─── Phase 3: Order queue position ──────────────────────────────────────────

export interface KalshiQueuePosition {
  order_id: string;
  queue_position: number;
  ticker: string;
}

// ─── Phase 4: RFQ (Request for Quote) ──────────────────────────────────────

export interface KalshiRfq {
  rfq_id: string;
  ticker: string;
  side: "yes" | "no";
  count: number;
  status: "open" | "accepted" | "confirmed" | "expired" | "cancelled";
  created_time?: string;
  expiration_time?: string;
}

export interface KalshiCreateRfqRequest {
  ticker: string;
  side: "yes" | "no";
  count: number;
}

export interface KalshiRfqsParams extends KalshiCursorParams {
  ticker?: string;
  status?: string;
}

export interface KalshiQuote {
  quote_id: string;
  rfq_id: string;
  price: number;
  side: "yes" | "no";
  count: number;
  status: "open" | "accepted" | "confirmed" | "expired" | "cancelled";
  created_time?: string;
  expiration_time?: string;
}

export interface KalshiCreateQuoteRequest {
  price: number;
  side: "yes" | "no";
  count: number;
}

export interface KalshiRfqCommunications {
  communications_id: string;
}

// ─── Phase 4: Combo / MVE markets ──────────────────────────────────────────

export interface KalshiCreateComboMarketRequest {
  ticker_components: string[];
  label?: string;
}

export interface KalshiComboMarket {
  ticker: string;
  components: string[];
  label?: string;
  created_time?: string;
}

export interface KalshiMveCollectionsParams extends KalshiCursorParams {
  series_ticker?: string;
}

export interface KalshiTickerLookup {
  ticker: string;
  event_ticker: string;
  series_ticker: string;
  title?: string;
}

// ─── Phase 4: Live sports data ─────────────────────────────────────────────

export interface KalshiGameStats {
  game_id: string;
  sport: string;
  league?: string;
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  status?: string;
  period?: string;
  clock?: string;
  stats?: Record<string, unknown>;
}

export interface KalshiGameStatsParams {
  sport?: string;
  league?: string;
  game_id?: string;
}

export interface KalshiMilestoneData {
  milestone_id: string;
  type: string;
  value?: number;
  status?: string;
  timestamp?: string;
}

export interface KalshiBatchMilestoneParams {
  milestone_ids: string[];
}

// ─── Phase 4: Milestones and structured targets ────────────────────────────

export interface KalshiMilestone {
  id: string;
  title: string;
  type: string;
  status: "active" | "resolved" | "cancelled";
  target_value?: number;
  current_value?: number;
  resolved_time?: string;
  event_ticker?: string;
}

export interface KalshiMilestonesParams extends KalshiCursorParams {
  status?: string;
  event_ticker?: string;
}

export interface KalshiStructuredTarget {
  id: string;
  title: string;
  type: string;
  market_ticker?: string;
  target_value?: number;
  description?: string;
}

export interface KalshiStructuredTargetsParams extends KalshiCursorParams {
  type?: string;
  market_ticker?: string;
}

// ─── Phase 4: Incentives ───────────────────────────────────────────────────

export interface KalshiIncentive {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: "active" | "expired" | "redeemed";
  value?: number;
  expiration_time?: string;
}

// ─── Phase 4: API key management ───────────────────────────────────────────

export interface KalshiApiKey {
  api_key_id: string;
  name?: string;
  created_time?: string;
  last_used_time?: string;
  status?: string;
}

export interface KalshiCreateApiKeyRequest {
  name?: string;
}

export interface KalshiGeneratedApiKey extends KalshiApiKey {
  secret: string;
}

// ─── Phase 4: Account rate limits ──────────────────────────────────────────

export interface KalshiAccountLimits {
  tier: string;
  order_rate_limit: number;
  order_rate_remaining: number;
  combo_creation_limit: number;
  combo_creation_remaining: number;
  reset_time?: string;
}

// ─── Phase 4: WS communications event ──────────────────────────────────────

export interface KalshiCommunicationsEvent {
  rfq_id: string;
  type:
    | "quote_received"
    | "quote_accepted"
    | "quote_confirmed"
    | "rfq_expired"
    | "rfq_cancelled";
  quote_id?: string;
  price?: number;
  count?: number;
  timestamp: number;
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

  static toDollarsString(normalizedPrice: number): string {
    return normalizedPrice.toFixed(4);
  }

  static resolvePriceDollars(
    dollarsField: string | undefined,
    centsField: number | undefined,
  ): number {
    const d = parseKalshiDollars(dollarsField);
    if (d !== undefined) return d;
    return centsField !== undefined
      ? KalshiRestService.normalizeKalshiPrice(centsField)
      : 0;
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

  // ─── Phase 3: Order groups ─────────────────────────────────────────────────

  async createOrderGroup(
    req: KalshiCreateOrderGroupRequest,
  ): Promise<KalshiOrderGroup> {
    const result = await this.withRetry<{ order_group: KalshiOrderGroup }>(
      () =>
        this.post(
          "/portfolio/order-groups",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.order_group;
  }

  async getOrderGroups(): Promise<KalshiOrderGroup[]> {
    const result = await this.withRetry<{ order_groups: KalshiOrderGroup[] }>(
      () => this.get("/portfolio/order-groups"),
      "user",
    );
    return result.order_groups;
  }

  async getOrderGroup(groupId: string): Promise<KalshiOrderGroup> {
    const result = await this.withRetry<{ order_group: KalshiOrderGroup }>(
      () => this.get(`/portfolio/order-groups/${encodeURIComponent(groupId)}`),
      "user",
    );
    return result.order_group;
  }

  async updateOrderGroup(
    groupId: string,
    req: KalshiUpdateOrderGroupRequest,
  ): Promise<KalshiOrderGroup> {
    const result = await this.withRetry<{ order_group: KalshiOrderGroup }>(
      () =>
        this.put(
          `/portfolio/order-groups/${encodeURIComponent(groupId)}`,
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.order_group;
  }

  async resetOrderGroup(groupId: string): Promise<void> {
    await this.withRetryVoid(
      () =>
        this.post(
          `/portfolio/order-groups/${encodeURIComponent(groupId)}/reset`,
          {},
        ),
      "user",
    );
  }

  async triggerOrderGroup(groupId: string): Promise<void> {
    await this.withRetryVoid(
      () =>
        this.post(
          `/portfolio/order-groups/${encodeURIComponent(groupId)}/trigger`,
          {},
        ),
      "user",
    );
  }

  async deleteOrderGroup(groupId: string): Promise<void> {
    await this.withRetryVoid(
      () =>
        this.delete(`/portfolio/order-groups/${encodeURIComponent(groupId)}`),
      "user",
    );
  }

  // ─── Phase 3: Historical data ─────────────────────────────────────────────

  async getHistoricalMarkets(
    params: KalshiHistoricalMarketsParams = {},
  ): Promise<{ markets: KalshiMarket[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.min_close_ts !== undefined)
      qs.set("min_close_ts", String(params.min_close_ts));
    if (params.max_close_ts !== undefined)
      qs.set("max_close_ts", String(params.max_close_ts));
    if (params.status) qs.set("status", params.status);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.event_ticker) qs.set("event_ticker", params.event_ticker);

    return this.withRetry<{ markets: KalshiMarket[]; cursor: string }>(
      () => this.get(`/markets?${qs.toString()}`),
      "user",
    );
  }

  async getHistoricalMarketCandlesticks(
    ticker: string,
    params: KalshiHistoricalCandlesticksParams = {},
  ): Promise<KalshiCandlestick[]> {
    const qs = new URLSearchParams();
    if (params.start_ts !== undefined)
      qs.set("start_ts", String(params.start_ts));
    if (params.end_ts !== undefined) qs.set("end_ts", String(params.end_ts));
    if (params.period_interval !== undefined)
      qs.set("period_interval", String(params.period_interval));

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

  async getHistoricalTrades(
    params: KalshiTradesParams = {},
  ): Promise<{ trades: KalshiTrade[]; cursor: string }> {
    return this.getTrades(params);
  }

  async getHistoricalFills(
    params: KalshiFillsParams = {},
  ): Promise<{ fills: KalshiFill[]; cursor: string }> {
    return this.getFills(params);
  }

  async getHistoricalOrders(
    params: KalshiHistoricalOrdersParams = {},
  ): Promise<{ orders: KalshiOrder[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.status) qs.set("status", params.status);
    if (params.min_ts !== undefined) qs.set("min_ts", String(params.min_ts));
    if (params.max_ts !== undefined) qs.set("max_ts", String(params.max_ts));

    return this.withRetry<{ orders: KalshiOrder[]; cursor: string }>(
      () => this.get(`/portfolio/orders?${qs.toString()}`),
      "user",
    );
  }

  async getCutoffTimestamps(): Promise<KalshiCutoffTimestamps> {
    return this.withRetry<KalshiCutoffTimestamps>(
      () => this.get("/history/cutoff-timestamps"),
      "user",
    );
  }

  // ─── Phase 3: Subaccounts ─────────────────────────────────────────────────

  async createSubaccount(
    req: KalshiCreateSubaccountRequest,
  ): Promise<KalshiSubaccount> {
    const result = await this.withRetry<{ subaccount: KalshiSubaccount }>(
      () =>
        this.post(
          "/portfolio/subaccounts",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.subaccount;
  }

  async getSubaccountBalances(): Promise<KalshiSubaccountBalance[]> {
    const result = await this.withRetry<{
      subaccount_balances: KalshiSubaccountBalance[];
    }>(() => this.get("/portfolio/subaccount-balances"), "user");
    return result.subaccount_balances;
  }

  async transferSubaccountFunds(
    req: KalshiSubaccountTransferRequest,
  ): Promise<void> {
    await this.withRetryVoid(
      () =>
        this.post(
          "/portfolio/subaccount-transfers",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
  }

  async getSubaccountNetting(): Promise<KalshiSubaccountNettingConfig> {
    return this.withRetry<KalshiSubaccountNettingConfig>(
      () => this.get("/portfolio/subaccount-netting"),
      "user",
    );
  }

  async updateSubaccountNetting(
    req: KalshiSubaccountNettingConfig,
  ): Promise<KalshiSubaccountNettingConfig> {
    return this.withRetry<KalshiSubaccountNettingConfig>(
      () =>
        this.put(
          "/portfolio/subaccount-netting",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
  }

  // ─── Phase 3: Search and filters ──────────────────────────────────────────

  async getSportsFilters(): Promise<KalshiSportFilter[]> {
    const result = await this.withRetry<{ filters: KalshiSportFilter[] }>(
      () => this.get("/search/sports/filters"),
      "user",
    );
    return result.filters;
  }

  async getSeriesTags(): Promise<KalshiSeriesTag[]> {
    const result = await this.withRetry<{ tags: KalshiSeriesTag[] }>(
      () => this.get("/search/series/tags"),
      "user",
    );
    return result.tags;
  }

  // ─── Phase 3: Order queue position ────────────────────────────────────────

  async getOrderQueuePosition(orderId: string): Promise<KalshiQueuePosition> {
    return this.withRetry<KalshiQueuePosition>(
      () =>
        this.get(
          `/portfolio/orders/${encodeURIComponent(orderId)}/queue-position`,
        ),
      "user",
    );
  }

  async getOrderQueuePositions(
    orderIds: string[],
  ): Promise<KalshiQueuePosition[]> {
    const qs = new URLSearchParams();
    for (const id of orderIds) qs.append("order_ids", id);

    const result = await this.withRetry<{
      queue_positions: KalshiQueuePosition[];
    }>(
      () => this.get(`/portfolio/orders/queue-positions?${qs.toString()}`),
      "user",
    );
    return result.queue_positions;
  }

  // ─── Phase 4: RFQ system ───────────────────────────────────────────────────

  async createRfq(req: KalshiCreateRfqRequest): Promise<KalshiRfq> {
    const result = await this.withRetry<{ rfq: KalshiRfq }>(
      () => this.post("/rfqs", req as unknown as Record<string, unknown>),
      "user",
    );
    return result.rfq;
  }

  async getRfqs(
    params: KalshiRfqsParams = {},
  ): Promise<{ rfqs: KalshiRfq[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.status) qs.set("status", params.status);

    return this.withRetry<{ rfqs: KalshiRfq[]; cursor: string }>(
      () => this.get(`/rfqs?${qs.toString()}`),
      "user",
    );
  }

  async getRfq(rfqId: string): Promise<KalshiRfq> {
    const result = await this.withRetry<{ rfq: KalshiRfq }>(
      () => this.get(`/rfqs/${encodeURIComponent(rfqId)}`),
      "user",
    );
    return result.rfq;
  }

  async deleteRfq(rfqId: string): Promise<void> {
    await this.withRetryVoid(
      () => this.delete(`/rfqs/${encodeURIComponent(rfqId)}`),
      "user",
    );
  }

  async createQuote(
    rfqId: string,
    req: KalshiCreateQuoteRequest,
  ): Promise<KalshiQuote> {
    const result = await this.withRetry<{ quote: KalshiQuote }>(
      () =>
        this.post(
          `/rfqs/${encodeURIComponent(rfqId)}/quotes`,
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.quote;
  }

  async getQuotes(rfqId: string): Promise<KalshiQuote[]> {
    const result = await this.withRetry<{ quotes: KalshiQuote[] }>(
      () => this.get(`/rfqs/${encodeURIComponent(rfqId)}/quotes`),
      "user",
    );
    return result.quotes;
  }

  async getQuote(rfqId: string, quoteId: string): Promise<KalshiQuote> {
    const result = await this.withRetry<{ quote: KalshiQuote }>(
      () =>
        this.get(
          `/rfqs/${encodeURIComponent(rfqId)}/quotes/${encodeURIComponent(quoteId)}`,
        ),
      "user",
    );
    return result.quote;
  }

  async deleteQuote(rfqId: string, quoteId: string): Promise<void> {
    await this.withRetryVoid(
      () =>
        this.delete(
          `/rfqs/${encodeURIComponent(rfqId)}/quotes/${encodeURIComponent(quoteId)}`,
        ),
      "user",
    );
  }

  async acceptQuote(rfqId: string, quoteId: string): Promise<KalshiQuote> {
    const result = await this.withRetry<{ quote: KalshiQuote }>(
      () =>
        this.post(
          `/rfqs/${encodeURIComponent(rfqId)}/quotes/${encodeURIComponent(quoteId)}/accept`,
          {},
        ),
      "user",
    );
    return result.quote;
  }

  async confirmQuote(rfqId: string, quoteId: string): Promise<KalshiQuote> {
    const result = await this.withRetry<{ quote: KalshiQuote }>(
      () =>
        this.post(
          `/rfqs/${encodeURIComponent(rfqId)}/quotes/${encodeURIComponent(quoteId)}/confirm`,
          {},
        ),
      "user",
    );
    return result.quote;
  }

  async getRfqCommunicationsId(
    rfqId: string,
  ): Promise<KalshiRfqCommunications> {
    return this.withRetry<KalshiRfqCommunications>(
      () => this.get(`/rfqs/${encodeURIComponent(rfqId)}/communications-id`),
      "user",
    );
  }

  // ─── Phase 4: Combo / MVE markets ─────────────────────────────────────────

  async createComboMarket(
    collectionTicker: string,
    req: KalshiCreateComboMarketRequest,
  ): Promise<KalshiComboMarket> {
    const result = await this.withRetry<{ market: KalshiComboMarket }>(
      () =>
        this.post(
          `/markets/mve/${encodeURIComponent(collectionTicker)}/create`,
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.market;
  }

  async getMultivariateCollections(
    params: KalshiMveCollectionsParams = {},
  ): Promise<{
    collections: KalshiMultivariateCollection[];
    cursor: string;
  }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.series_ticker) qs.set("series_ticker", params.series_ticker);

    return this.withRetry<{
      collections: KalshiMultivariateCollection[];
      cursor: string;
    }>(
      () => this.get(`/multivariate_event_collections?${qs.toString()}`),
      "user",
    );
  }

  async lookupTicker(ticker: string): Promise<KalshiTickerLookup> {
    return this.withRetry<KalshiTickerLookup>(
      () => this.get(`/markets/lookup?ticker=${encodeURIComponent(ticker)}`),
      "user",
    );
  }

  // ─── Phase 4: Live sports data ────────────────────────────────────────────

  async getGameStats(
    params: KalshiGameStatsParams = {},
  ): Promise<KalshiGameStats[]> {
    const qs = new URLSearchParams();
    if (params.sport) qs.set("sport", params.sport);
    if (params.league) qs.set("league", params.league);
    if (params.game_id) qs.set("game_id", params.game_id);

    const result = await this.withRetry<{ games: KalshiGameStats[] }>(
      () => this.get(`/live-data/game-stats?${qs.toString()}`),
      "user",
    );
    return result.games;
  }

  async getLiveData(type: string): Promise<KalshiMilestoneData[]> {
    const result = await this.withRetry<{ milestones: KalshiMilestoneData[] }>(
      () => this.get(`/live-data/${encodeURIComponent(type)}`),
      "user",
    );
    return result.milestones;
  }

  async getBatchLiveData(
    params: KalshiBatchMilestoneParams,
  ): Promise<KalshiMilestoneData[]> {
    const result = await this.withRetry<{ milestones: KalshiMilestoneData[] }>(
      () =>
        this.post("/live-data/batch", {
          milestone_ids: params.milestone_ids,
        }),
      "user",
    );
    return result.milestones;
  }

  // ─── Phase 4: Milestones ──────────────────────────────────────────────────

  async getMilestones(
    params: KalshiMilestonesParams = {},
  ): Promise<{ milestones: KalshiMilestone[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.status) qs.set("status", params.status);
    if (params.event_ticker) qs.set("event_ticker", params.event_ticker);

    return this.withRetry<{ milestones: KalshiMilestone[]; cursor: string }>(
      () => this.get(`/milestones?${qs.toString()}`),
      "user",
    );
  }

  async getMilestone(milestoneId: string): Promise<KalshiMilestone> {
    const result = await this.withRetry<{ milestone: KalshiMilestone }>(
      () => this.get(`/milestones/${encodeURIComponent(milestoneId)}`),
      "user",
    );
    return result.milestone;
  }

  // ─── Phase 4: Structured targets ──────────────────────────────────────────

  async getStructuredTargets(
    params: KalshiStructuredTargetsParams = {},
  ): Promise<{ structured_targets: KalshiStructuredTarget[]; cursor: string }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.type) qs.set("type", params.type);
    if (params.market_ticker) qs.set("market_ticker", params.market_ticker);

    return this.withRetry<{
      structured_targets: KalshiStructuredTarget[];
      cursor: string;
    }>(() => this.get(`/structured-targets?${qs.toString()}`), "user");
  }

  async getStructuredTarget(targetId: string): Promise<KalshiStructuredTarget> {
    const result = await this.withRetry<{
      structured_target: KalshiStructuredTarget;
    }>(
      () => this.get(`/structured-targets/${encodeURIComponent(targetId)}`),
      "user",
    );
    return result.structured_target;
  }

  // ─── Phase 4: Incentives ──────────────────────────────────────────────────

  async getIncentives(): Promise<KalshiIncentive[]> {
    const result = await this.withRetry<{ incentives: KalshiIncentive[] }>(
      () => this.get("/incentives"),
      "user",
    );
    return result.incentives;
  }

  // ─── Phase 4: API key management ──────────────────────────────────────────

  async createApiKey(req: KalshiCreateApiKeyRequest): Promise<KalshiApiKey> {
    const result = await this.withRetry<{ api_key: KalshiApiKey }>(
      () => this.post("/api-keys", req as unknown as Record<string, unknown>),
      "user",
    );
    return result.api_key;
  }

  async generateApiKey(
    req: KalshiCreateApiKeyRequest,
  ): Promise<KalshiGeneratedApiKey> {
    const result = await this.withRetry<{
      api_key: KalshiGeneratedApiKey;
    }>(
      () =>
        this.post(
          "/api-keys/generate",
          req as unknown as Record<string, unknown>,
        ),
      "user",
    );
    return result.api_key;
  }

  async getApiKeys(): Promise<KalshiApiKey[]> {
    const result = await this.withRetry<{ api_keys: KalshiApiKey[] }>(
      () => this.get("/api-keys"),
      "user",
    );
    return result.api_keys;
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await this.withRetryVoid(
      () => this.delete(`/api-keys/${encodeURIComponent(keyId)}`),
      "user",
    );
  }

  // ─── Phase 4: Account rate limits ─────────────────────────────────────────

  async getAccountLimits(): Promise<KalshiAccountLimits> {
    return this.withRetry<KalshiAccountLimits>(
      () => this.get("/account/limits"),
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

  private async put(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const token = await this.auth.getToken("user");
    return fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
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
