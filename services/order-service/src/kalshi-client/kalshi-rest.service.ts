import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { type AxiosInstance } from "axios";
import {
  Configuration,
  MarketApi,
  OrdersApi,
  PortfolioApi,
  EventsApi,
  ExchangeApi,
  HistoricalApi,
  OrderGroupsApi,
  MultivariateApi,
  SearchApi,
  LiveDataApi,
  MilestoneApi,
  StructuredTargetsApi,
  IncentiveProgramsApi,
  ApiKeysApi,
  AccountApi,
  CommunicationsApi,
  type Market,
  type Order,
  type Fill,
  type Settlement,
  type MarketPosition,
  type MarketCandlestick,
  type MarketCandlestickHistorical,
  type Trade,
  type CreateOrderRequest,
  type AmendOrderRequest,
  type DecreaseOrderRequest,
  type BatchCreateOrdersRequest,
  type BatchCancelOrdersRequest,
  type CreateOrderGroupRequest,
  type OrderGroup,
  type Milestone,
  type StructuredTarget,
  type IncentiveProgram,
  type CreateApiKeyRequest,
  type GenerateApiKeyRequest,
  type CreateRFQRequest,
  type CreateQuoteRequest,
  type AcceptQuoteRequest,
  type RFQ,
  type Quote,
  type MultivariateEventCollection,
  type ExchangeStatus,
  type Schedule,
  type EventData,
  type ForecastPercentilesPoint,
  type LiveData,
  type TickerPair,
  type UpdateOrderGroupLimitRequest,
  type SubaccountNettingConfig,
  type GetOrderGroupResponse,
  type BatchCreateOrdersIndividualResponse,
  type BatchCancelOrdersIndividualResponse,
} from "kalshi-typescript";
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

// ─── Re-export SDK types for consumers ──────────────────────────────────────

export type {
  Market as KalshiMarket,
  Order as KalshiOrder,
  Fill as KalshiFill,
  Settlement as KalshiSettlement,
  MarketPosition as KalshiPosition,
  MarketCandlestick as KalshiCandlestick,
  MarketCandlestickHistorical as KalshiCandlestickHistorical,
  Trade as KalshiTrade,
  CreateOrderRequest as KalshiPlaceOrderRequest,
  AmendOrderRequest as KalshiAmendOrderRequest,
  DecreaseOrderRequest as KalshiDecreaseOrderRequest,
  OrderGroup as KalshiOrderGroup,
  Milestone as KalshiMilestone,
  StructuredTarget as KalshiStructuredTarget,
  IncentiveProgram as KalshiIncentive,
  RFQ as KalshiRfq,
  Quote as KalshiQuote,
  MultivariateEventCollection as KalshiMultivariateCollection,
  ExchangeStatus as KalshiExchangeStatus,
  Schedule as KalshiExchangeSchedule,
  EventData as KalshiEvent,
  ForecastPercentilesPoint as KalshiForecastPoint,
  LiveData as KalshiLiveData,
};

export type { CreateRFQRequest as KalshiCreateRfqRequest };
export type { CreateQuoteRequest as KalshiCreateQuoteRequest };

// ─── Legacy type aliases for backward compatibility ─────────────────────────

export interface KalshiOrderBook {
  yes: Array<{ price: number; quantity: number }>;
  no: Array<{ price: number; quantity: number }>;
}

export interface KalshiOrderResponse {
  order_id: string;
  status: string;
  ticker?: string;
  side?: string;
  action?: string;
  count_fp?: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  client_order_id?: string;
}

export interface KalshiMarketsParams {
  limit?: number;
  offset?: number;
  status?: string;
  ticker?: string;
}

export interface KalshiCursorParams {
  limit?: number;
  cursor?: string;
}

export interface KalshiEventsParams extends KalshiCursorParams {
  status?: "open" | "closed" | "settled";
  series_ticker?: string;
  with_nested_markets?: boolean;
  min_close_ts?: number;
  min_updated_ts?: number;
}

export interface KalshiForecastParams {
  series_ticker: string;
  event_ticker: string;
  percentiles: number[];
  start_ts: number;
  end_ts: number;
  period_interval: number;
}

export interface KalshiFillsParams extends KalshiCursorParams {
  ticker?: string;
  order_id?: string;
  min_ts?: number;
  max_ts?: number;
}

export interface KalshiSettlementsParams extends KalshiCursorParams {
  ticker?: string;
  event_ticker?: string;
  min_ts?: number;
  max_ts?: number;
}

export interface KalshiTradesParams extends KalshiCursorParams {
  ticker?: string;
  min_ts?: number;
  max_ts?: number;
}

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

export interface KalshiMveCollectionsParams extends KalshiCursorParams {
  series_ticker?: string;
}

export interface KalshiRfqsParams extends KalshiCursorParams {
  ticker?: string;
  status?: string;
}

export interface KalshiMilestonesParams extends KalshiCursorParams {
  status?: string;
  event_ticker?: string;
}

export interface KalshiStructuredTargetsParams extends KalshiCursorParams {
  type?: string;
  market_ticker?: string;
}

export interface KalshiGameStatsParams {
  sport?: string;
  league?: string;
  game_id?: string;
}

export interface KalshiBatchMilestoneParams {
  milestone_ids: string[];
}

// WS types kept for kalshi-ws.service.ts consumers
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
  private readonly axiosInstance: AxiosInstance;

  private readonly marketApi: MarketApi;
  private readonly ordersApi: OrdersApi;
  private readonly portfolioApi: PortfolioApi;
  private readonly eventsApi: EventsApi;
  private readonly exchangeApi: ExchangeApi;
  private readonly historicalApi: HistoricalApi;
  private readonly orderGroupsApi: OrderGroupsApi;
  private readonly multivariateApi: MultivariateApi;
  private readonly searchApi: SearchApi;
  private readonly liveDataApi: LiveDataApi;
  private readonly milestoneApi: MilestoneApi;
  private readonly structuredTargetsApi: StructuredTargetsApi;
  private readonly incentivesApi: IncentiveProgramsApi;
  private readonly apiKeysApi: ApiKeysApi;
  private readonly accountApi: AccountApi;
  private readonly communicationsApi: CommunicationsApi;

  constructor(
    private readonly auth: KalshiAuthService,
    private readonly config: ConfigService,
  ) {
    const basePath =
      this.config.get<string>("KALSHI_BASE_URL") ??
      "https://demo-api.kalshi.co/trade-api/v2";

    this.axiosInstance = axios.create({ timeout: 15_000 });
    this.axiosInstance.interceptors.request.use(async (reqConfig: import("axios").InternalAxiosRequestConfig) => {
      const token = await this.auth.getToken("user");
      reqConfig.headers.set("Authorization", `Bearer ${token}`);
      return reqConfig;
    });

    this.axiosInstance.interceptors.response.use(undefined, async (error: unknown) => {
      const axErr = error as { config?: Record<string, unknown>; response?: { status: number }; code?: string };
      const cfg = axErr.config;
      if (!cfg) throw error;

      const retryCount = (cfg.__retryCount as number) ?? 0;
      const status = axErr.response?.status;
      const isRetryable =
        status === 429 ||
        axErr.code === "ECONNABORTED" ||
        axErr.code === "ERR_NETWORK";

      if (isRetryable && retryCount < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[retryCount];
        this.logger.warn(
          `Kalshi ${status ?? axErr.code} — retrying in ${delay}ms (attempt ${retryCount + 1})`,
        );
        cfg.__retryCount = retryCount + 1;
        await sleep(delay);
        return this.axiosInstance.request(cfg as import("axios").AxiosRequestConfig);
      }
      throw error;
    });

    const sdkConfig = new Configuration({ basePath });

    this.marketApi = new MarketApi(sdkConfig, basePath, this.axiosInstance);
    this.ordersApi = new OrdersApi(sdkConfig, basePath, this.axiosInstance);
    this.portfolioApi = new PortfolioApi(sdkConfig, basePath, this.axiosInstance);
    this.eventsApi = new EventsApi(sdkConfig, basePath, this.axiosInstance);
    this.exchangeApi = new ExchangeApi(sdkConfig, basePath, this.axiosInstance);
    this.historicalApi = new HistoricalApi(sdkConfig, basePath, this.axiosInstance);
    this.orderGroupsApi = new OrderGroupsApi(sdkConfig, basePath, this.axiosInstance);
    this.multivariateApi = new MultivariateApi(sdkConfig, basePath, this.axiosInstance);
    this.searchApi = new SearchApi(sdkConfig, basePath, this.axiosInstance);
    this.liveDataApi = new LiveDataApi(sdkConfig, basePath, this.axiosInstance);
    this.milestoneApi = new MilestoneApi(sdkConfig, basePath, this.axiosInstance);
    this.structuredTargetsApi = new StructuredTargetsApi(sdkConfig, basePath, this.axiosInstance);
    this.incentivesApi = new IncentiveProgramsApi(sdkConfig, basePath, this.axiosInstance);
    this.apiKeysApi = new ApiKeysApi(sdkConfig, basePath, this.axiosInstance);
    this.accountApi = new AccountApi(sdkConfig, basePath, this.axiosInstance);
    this.communicationsApi = new CommunicationsApi(sdkConfig, basePath, this.axiosInstance);
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

  // ─── Markets ─────────────────────────────────────────────────────────────

  async getMarkets(params: KalshiMarketsParams): Promise<Market[]> {
    const res = await this.marketApi.getMarkets(
      params.limit,
      undefined, // cursor
      undefined, // eventTicker
      undefined, // seriesTicker
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, // ts filters
      params.ticker ? undefined : (params.status as "open" | "closed" | undefined),
      params.ticker,
    );
    return res.data.markets ?? [];
  }

  async getMarket(ticker: string): Promise<Market> {
    const res = await this.marketApi.getMarket(ticker);
    return res.data.market;
  }

  async getOrderBook(ticker: string): Promise<KalshiOrderBook> {
    const res = await this.marketApi.getMarketOrderbook(ticker);
    const fp = res.data.orderbook_fp;
    const parseLevels = (levels: Array<Array<string>> | undefined) =>
      (levels ?? []).map(([priceDollars, qtyFp]) => ({
        price: KalshiRestService.denormalizeKalshiPrice(Number(priceDollars)),
        quantity: Math.round(Number(qtyFp)),
      }));
    return {
      yes: parseLevels(fp?.yes_dollars),
      no: parseLevels(fp?.no_dollars),
    };
  }

  async placeOrder(req: CreateOrderRequest): Promise<KalshiOrderResponse> {
    const res = await this.ordersApi.createOrder(req);
    const o = res.data.order;
    return {
      order_id: o.order_id,
      status: o.status,
      ticker: o.ticker,
      side: o.side,
      action: o.action,
      count_fp: o.remaining_count_fp,
      yes_price_dollars: o.yes_price_dollars,
      no_price_dollars: o.no_price_dollars,
      client_order_id: o.client_order_id,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.ordersApi.cancelOrder(orderId);
  }

  async getPositions(_userId: string): Promise<MarketPosition[]> {
    const res = await this.portfolioApi.getPositions();
    return res.data.market_positions ?? [];
  }

  async getOrders(_userId: string, limit: number): Promise<Order[]> {
    const res = await this.ordersApi.getOrders(
      undefined, // ticker
      undefined, // eventTicker
      undefined, // minTs
      undefined, // maxTs
      undefined, // status
      limit,
    );
    return res.data.orders ?? [];
  }

  async getBalance(): Promise<{ balance: number }> {
    const res = await this.portfolioApi.getBalance();
    return { balance: res.data.balance ?? 0 };
  }

  async getCandlesticks(
    ticker: string,
    periodInterval: number,
  ): Promise<MarketCandlestick[]> {
    const now = Math.floor(Date.now() / 1000);
    const oneWeekAgo = now - 7 * 24 * 60 * 60;
    const res = await this.marketApi.getMarketCandlesticks(
      ticker, ticker, oneWeekAgo, now, periodInterval as 1 | 60 | 1440,
    );
    return res.data.candlesticks ?? [];
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  async getEvents(
    params: KalshiEventsParams = {},
  ): Promise<{ events: EventData[]; cursor: string }> {
    const res = await this.eventsApi.getEvents(
      params.limit,
      params.cursor,
      params.with_nested_markets,
      undefined, // withMilestones
      params.status as "open" | "closed" | "settled" | undefined,
      params.series_ticker,
    );
    return { events: res.data.events ?? [], cursor: res.data.cursor ?? "" };
  }

  async getEvent(
    eventTicker: string,
    withNestedMarkets = false,
  ): Promise<{ event: EventData; markets: Market[] }> {
    const res = await this.eventsApi.getEvent(eventTicker, withNestedMarkets);
    return { event: res.data.event, markets: res.data.markets ?? [] };
  }

  async getEventMetadata(
    eventTicker: string,
  ): Promise<Record<string, unknown>> {
    const res = await this.eventsApi.getEventMetadata(eventTicker);
    return res.data as unknown as Record<string, unknown>;
  }

  async getForecastPercentileHistory(
    params: KalshiForecastParams,
  ): Promise<ForecastPercentilesPoint[]> {
    const res = await this.eventsApi.getEventForecastPercentilesHistory(
      params.event_ticker,
      params.series_ticker,
      params.percentiles,
      params.start_ts,
      params.end_ts,
      params.period_interval as 1 | 60 | 1440,
    );
    return res.data.forecast_history ?? [];
  }

  async getMultivariateCollection(
    collectionTicker: string,
  ): Promise<MultivariateEventCollection> {
    const res = await this.multivariateApi.getMultivariateEventCollection(collectionTicker);
    return res.data.multivariate_contract;
  }

  // ─── Order amendments ────────────────────────────────────────────────────

  async amendOrder(
    orderId: string,
    req: AmendOrderRequest,
  ): Promise<{ old_order: Order; order: Order }> {
    const res = await this.ordersApi.amendOrder(orderId, req);
    return res.data;
  }

  async decreaseOrder(
    orderId: string,
    req: DecreaseOrderRequest,
  ): Promise<Order> {
    const res = await this.ordersApi.decreaseOrder(orderId, req);
    return res.data.order;
  }

  // ─── Batch operations ────────────────────────────────────────────────────

  async batchCreateOrders(
    orders: CreateOrderRequest[],
  ): Promise<BatchCreateOrdersIndividualResponse[]> {
    const req: BatchCreateOrdersRequest = { orders };
    const res = await this.ordersApi.batchCreateOrders(req);
    return res.data.orders ?? [];
  }

  async batchCancelOrders(
    orderIds: string[],
  ): Promise<BatchCancelOrdersIndividualResponse[]> {
    const req: BatchCancelOrdersRequest = { orders: orderIds.map((id) => ({ order_id: id })) };
    const res = await this.ordersApi.batchCancelOrders(req);
    return res.data.orders ?? [];
  }

  // ─── Portfolio fills ─────────────────────────────────────────────────────

  async getFills(
    params: KalshiFillsParams = {},
  ): Promise<{ fills: Fill[]; cursor: string }> {
    const res = await this.portfolioApi.getFills(
      params.ticker, params.order_id,
      params.min_ts, params.max_ts,
      params.limit, params.cursor,
    );
    return { fills: res.data.fills ?? [], cursor: res.data.cursor ?? "" };
  }

  // ─── Portfolio settlements ───────────────────────────────────────────────

  async getSettlements(
    params: KalshiSettlementsParams = {},
  ): Promise<{ settlements: Settlement[]; cursor: string }> {
    const res = await this.portfolioApi.getSettlements(
      params.limit, params.cursor,
      params.ticker, params.event_ticker,
      params.min_ts, params.max_ts,
    );
    return { settlements: res.data.settlements ?? [], cursor: res.data.cursor ?? "" };
  }

  // ─── Multiple orderbooks ────────────────────────────────────────────────

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

  // ─── Exchange status ─────────────────────────────────────────────────────

  async getExchangeStatus(): Promise<ExchangeStatus> {
    const res = await this.exchangeApi.getExchangeStatus();
    return res.data;
  }

  async getExchangeSchedule(): Promise<Schedule> {
    const res = await this.exchangeApi.getExchangeSchedule();
    return res.data.schedule;
  }

  // ─── Market trades ───────────────────────────────────────────────────────

  async getTrades(
    params: KalshiTradesParams = {},
  ): Promise<{ trades: Trade[]; cursor: string }> {
    const res = await this.marketApi.getTrades(
      params.limit, params.cursor,
      params.ticker, params.min_ts, params.max_ts,
    );
    return { trades: res.data.trades ?? [], cursor: res.data.cursor ?? "" };
  }

  // ─── Order groups ─────────────────────────────────────────────────────────

  async createOrderGroup(
    req: CreateOrderGroupRequest,
  ): Promise<{ order_group_id: string }> {
    const res = await this.orderGroupsApi.createOrderGroup(req);
    return { order_group_id: res.data.order_group_id };
  }

  async getOrderGroups(): Promise<OrderGroup[]> {
    const res = await this.orderGroupsApi.getOrderGroups();
    return res.data.order_groups ?? [];
  }

  async getOrderGroup(groupId: string): Promise<GetOrderGroupResponse> {
    const res = await this.orderGroupsApi.getOrderGroup(groupId);
    return res.data;
  }

  async updateOrderGroup(
    groupId: string,
    req: UpdateOrderGroupLimitRequest,
  ): Promise<void> {
    await this.orderGroupsApi.updateOrderGroupLimit(groupId, req);
  }

  async resetOrderGroup(groupId: string): Promise<void> {
    await this.orderGroupsApi.resetOrderGroup(groupId);
  }

  async triggerOrderGroup(groupId: string): Promise<void> {
    await this.orderGroupsApi.triggerOrderGroup(groupId);
  }

  async deleteOrderGroup(groupId: string): Promise<void> {
    await this.orderGroupsApi.deleteOrderGroup(groupId);
  }

  // ─── Historical data ─────────────────────────────────────────────────────

  async getHistoricalMarkets(
    params: KalshiHistoricalMarketsParams = {},
  ): Promise<{ markets: Market[]; cursor: string }> {
    const res = await this.historicalApi.getHistoricalMarkets(
      params.limit, params.cursor,
      params.ticker,
      params.event_ticker,
    );
    return { markets: res.data.markets ?? [], cursor: res.data.cursor ?? "" };
  }

  async getHistoricalMarketCandlesticks(
    ticker: string,
    params: KalshiHistoricalCandlesticksParams = {},
  ): Promise<MarketCandlestickHistorical[]> {
    const res = await this.historicalApi.getMarketCandlesticksHistorical(
      ticker,
      params.start_ts ?? Math.floor(Date.now() / 1000) - 7 * 86400,
      params.end_ts ?? Math.floor(Date.now() / 1000),
      (params.period_interval ?? 60) as 1 | 60 | 1440,
    );
    return res.data.candlesticks ?? [];
  }

  async getHistoricalTrades(
    params: KalshiTradesParams = {},
  ): Promise<{ trades: Trade[]; cursor: string }> {
    const res = await this.historicalApi.getTradesHistorical(
      params.ticker, params.min_ts, params.max_ts,
      params.limit, params.cursor,
    );
    return { trades: res.data.trades ?? [], cursor: res.data.cursor ?? "" };
  }

  async getHistoricalFills(
    params: KalshiFillsParams = {},
  ): Promise<{ fills: Fill[]; cursor: string }> {
    const res = await this.historicalApi.getFillsHistorical(
      params.ticker, params.max_ts,
      params.limit, params.cursor,
    );
    return { fills: res.data.fills ?? [], cursor: res.data.cursor ?? "" };
  }

  async getHistoricalOrders(
    params: KalshiHistoricalOrdersParams = {},
  ): Promise<{ orders: Order[]; cursor: string }> {
    const res = await this.historicalApi.getHistoricalOrders(
      params.ticker, params.max_ts,
      params.limit, params.cursor,
    );
    return { orders: res.data.orders ?? [], cursor: res.data.cursor ?? "" };
  }

  async getCutoffTimestamps(): Promise<Record<string, number>> {
    const res = await this.historicalApi.getHistoricalCutoff();
    return res.data as unknown as Record<string, number>;
  }

  // ─── Subaccounts ─────────────────────────────────────────────────────────

  async createSubaccount(): Promise<{ subaccount_number: number }> {
    const res = await this.portfolioApi.createSubaccount();
    return res.data as unknown as { subaccount_number: number };
  }

  async getSubaccountBalances(): Promise<Array<{ subaccount_number: number; balance: number }>> {
    const res = await this.portfolioApi.getSubaccountBalances();
    return (res.data.subaccount_balances ?? []) as unknown as Array<{
      subaccount_number: number;
      balance: number;
    }>;
  }

  async transferSubaccountFunds(req: {
    client_transfer_id: string;
    from_subaccount: number;
    to_subaccount: number;
    amount_cents: number;
  }): Promise<void> {
    await this.portfolioApi.applySubaccountTransfer(req);
  }

  async getSubaccountNetting(): Promise<SubaccountNettingConfig[]> {
    const res = await this.portfolioApi.getSubaccountNetting();
    return res.data.netting_configs ?? [];
  }

  async updateSubaccountNetting(req: {
    subaccount_number: number;
    enabled: boolean;
  }): Promise<void> {
    await this.portfolioApi.updateSubaccountNetting(req);
  }

  // ─── Search and filters ──────────────────────────────────────────────────

  async getSportsFilters(): Promise<Record<string, unknown>> {
    const res = await this.searchApi.getFiltersForSports();
    return res.data as unknown as Record<string, unknown>;
  }

  async getSeriesTags(): Promise<Record<string, unknown>> {
    const res = await this.searchApi.getTagsForSeriesCategories();
    return res.data as unknown as Record<string, unknown>;
  }

  // ─── Order queue position ────────────────────────────────────────────────

  async getOrderQueuePosition(
    orderId: string,
  ): Promise<{ order_id: string; queue_position: number }> {
    const res = await this.ordersApi.getOrderQueuePosition(orderId);
    return res.data as unknown as { order_id: string; queue_position: number };
  }

  async getOrderQueuePositions(
    _orderIds: string[],
  ): Promise<Array<{ order_id: string; queue_position: number }>> {
    const res = await this.ordersApi.getOrderQueuePositions();
    return (res.data.queue_positions ?? []) as unknown as Array<{
      order_id: string;
      queue_position: number;
    }>;
  }

  // ─── RFQ system ───────────────────────────────────────────────────────────

  async createRfq(req: CreateRFQRequest): Promise<{ id: string }> {
    const res = await this.communicationsApi.createRFQ(req);
    return { id: res.data.id };
  }

  async getRfqs(
    params: KalshiRfqsParams = {},
  ): Promise<{ rfqs: RFQ[]; cursor: string }> {
    const res = await this.communicationsApi.getRFQs(
      params.cursor,
      undefined, // eventTicker
      params.ticker,
      undefined, // subaccount
      params.limit,
      params.status,
    );
    return { rfqs: res.data.rfqs ?? [], cursor: res.data.cursor ?? "" };
  }

  async getRfq(rfqId: string): Promise<RFQ> {
    const res = await this.communicationsApi.getRFQ(rfqId);
    return res.data.rfq;
  }

  async deleteRfq(rfqId: string): Promise<void> {
    await this.communicationsApi.deleteRFQ(rfqId);
  }

  async createQuote(req: CreateQuoteRequest): Promise<{ id: string }> {
    const res = await this.communicationsApi.createQuote(req);
    return { id: res.data.id };
  }

  async getQuotes(
    params: { cursor?: string; rfq_id?: string; limit?: number; status?: string } = {},
  ): Promise<Quote[]> {
    const res = await this.communicationsApi.getQuotes(
      params.cursor,
      undefined, // eventTicker
      undefined, // marketTicker
      params.limit,
      params.status,
      undefined, // quoteCreatorUserId
      undefined, // rfqCreatorUserId
      undefined, // rfqCreatorSubtraderId
      params.rfq_id,
    );
    return res.data.quotes ?? [];
  }

  async getQuote(quoteId: string): Promise<Quote> {
    const res = await this.communicationsApi.getQuote(quoteId);
    return res.data.quote;
  }

  async deleteQuote(quoteId: string): Promise<void> {
    await this.communicationsApi.deleteQuote(quoteId);
  }

  async acceptQuote(quoteId: string, req: AcceptQuoteRequest): Promise<void> {
    await this.communicationsApi.acceptQuote(quoteId, req);
  }

  async confirmQuote(quoteId: string): Promise<void> {
    await this.communicationsApi.confirmQuote(quoteId);
  }

  async getRfqCommunicationsId(): Promise<{ communications_id: string }> {
    const res = await this.communicationsApi.getCommunicationsID();
    return res.data as unknown as { communications_id: string };
  }

  // ─── Combo / MVE markets ─────────────────────────────────────────────────

  async createComboMarket(
    collectionTicker: string,
    req: { selected_markets: TickerPair[]; with_market_payload?: boolean },
  ): Promise<{ event_ticker: string; market_ticker: string; market?: Market }> {
    const res = await this.multivariateApi.createMarketInMultivariateEventCollection(
      collectionTicker, req,
    );
    return res.data;
  }

  async getMultivariateCollections(
    params: KalshiMveCollectionsParams = {},
  ): Promise<{ collections: MultivariateEventCollection[]; cursor: string }> {
    const res = await this.multivariateApi.getMultivariateEventCollections(
      undefined, // status
      undefined, // associatedEventTicker
      params.series_ticker,
      params.limit,
      params.cursor,
    );
    return {
      collections: res.data.multivariate_contracts ?? [],
      cursor: res.data.cursor ?? "",
    };
  }

  async lookupTicker(
    collectionTicker: string,
    selectedMarkets: TickerPair[],
  ): Promise<{ event_ticker: string; market_ticker: string }> {
    const res = await this.multivariateApi.lookupTickersForMarketInMultivariateEventCollection(
      collectionTicker, { selected_markets: selectedMarkets },
    );
    return res.data;
  }

  // ─── Live sports data ────────────────────────────────────────────────────

  async getGameStats(
    params: KalshiGameStatsParams & { milestone_id?: string } = {},
  ): Promise<LiveData[]> {
    if (params.game_id && params.milestone_id) {
      const res = await this.liveDataApi.getLiveData(params.game_id, params.milestone_id);
      return [res.data.live_data];
    }
    if (params.milestone_id) {
      const res = await this.liveDataApi.getLiveDatas([params.milestone_id]);
      return res.data.live_datas ?? [];
    }
    return [];
  }

  async getLiveData(type: string, milestoneId: string): Promise<LiveData> {
    const res = await this.liveDataApi.getLiveData(type, milestoneId);
    return res.data.live_data;
  }

  async getBatchLiveData(
    params: KalshiBatchMilestoneParams,
  ): Promise<LiveData[]> {
    const res = await this.liveDataApi.getLiveDatas(params.milestone_ids);
    return res.data.live_datas ?? [];
  }

  // ─── Milestones ──────────────────────────────────────────────────────────

  async getMilestones(
    params: KalshiMilestonesParams & { limit: number },
  ): Promise<{ milestones: Milestone[]; cursor: string }> {
    const res = await this.milestoneApi.getMilestones(
      params.limit,
      undefined, // minimumStartDate
      undefined, // category
      undefined, // competition
      undefined, // sourceId
      undefined, // type
      params.event_ticker,
      params.cursor,
    );
    return { milestones: res.data.milestones ?? [], cursor: res.data.cursor ?? "" };
  }

  async getMilestone(milestoneId: string): Promise<Milestone> {
    const res = await this.milestoneApi.getMilestone(milestoneId);
    return res.data.milestone;
  }

  // ─── Structured targets ──────────────────────────────────────────────────

  async getStructuredTargets(
    params: KalshiStructuredTargetsParams = {},
  ): Promise<{ structured_targets: StructuredTarget[]; cursor: string }> {
    const res = await this.structuredTargetsApi.getStructuredTargets(
      undefined, // ids
      params.type,
      undefined, // competition
      params.limit,
      params.cursor,
    );
    return {
      structured_targets: res.data.structured_targets ?? [],
      cursor: res.data.cursor ?? "",
    };
  }

  async getStructuredTarget(targetId: string): Promise<StructuredTarget | undefined> {
    const res = await this.structuredTargetsApi.getStructuredTarget(targetId);
    return res.data.structured_target;
  }

  // ─── Incentives ──────────────────────────────────────────────────────────

  async getIncentives(): Promise<IncentiveProgram[]> {
    const res = await this.incentivesApi.getIncentivePrograms();
    return res.data.incentive_programs ?? [];
  }

  // ─── API key management ──────────────────────────────────────────────────

  async createApiKey(req: CreateApiKeyRequest): Promise<{ api_key_id: string }> {
    const res = await this.apiKeysApi.createApiKey(req);
    return { api_key_id: res.data.api_key_id };
  }

  async generateApiKey(
    req: GenerateApiKeyRequest,
  ): Promise<{ api_key_id: string; private_key: string }> {
    const res = await this.apiKeysApi.generateApiKey(req);
    return { api_key_id: res.data.api_key_id, private_key: res.data.private_key };
  }

  async getApiKeys(): Promise<Record<string, unknown>[]> {
    const res = await this.apiKeysApi.getApiKeys();
    return (res.data.api_keys ?? []) as unknown as Record<string, unknown>[];
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await this.apiKeysApi.deleteApiKey(keyId);
  }

  // ─── Account rate limits ─────────────────────────────────────────────────

  async getAccountLimits(): Promise<Record<string, unknown>> {
    const res = await this.accountApi.getAccountApiLimits();
    return res.data as unknown as Record<string, unknown>;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
