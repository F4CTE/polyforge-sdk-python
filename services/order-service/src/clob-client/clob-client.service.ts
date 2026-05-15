import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  Chain as PolymarketChain,
  OrderBookSummary,
  OpenOrder,
  Trade,
  MarketPrice,
  OrderScoring,
  OrdersScoring,
  BuilderTrade,
  HeartbeatResponse,
  TickSize,
  PriceHistoryInterval as PriceHistoryIntervalType,
} from "@polymarket/clob-client" with { "resolution-mode": "import" };

export interface ClobClientLike {
  readonly host: string;
  getOrderBook(tokenID: string): Promise<OrderBookSummary>;
  getSpread(tokenID: string): Promise<{ spread: string }>;
  getMidpoint(tokenID: string): Promise<{ mid: string }>;
  getTickSize(tokenID: string): Promise<TickSize>;
  getFeeRateBps(tokenID: string): Promise<number>;
  getLastTradePrice(tokenID: string): Promise<{ price: string }>;
  getServerTime(): Promise<number>;
  getMarket(conditionID: string): Promise<Record<string, unknown>>;
  getPricesHistory(params: {
    market: string;
    interval?: PriceHistoryIntervalType;
    fidelity?: number;
  }): Promise<MarketPrice[]>;
}

type PolymarketClobClientModule = {
  ClobClient: new (host: string, chain: PolymarketChain) => ClobClientLike;
  Chain: {
    readonly POLYGON: PolymarketChain;
    readonly AMOY: PolymarketChain;
  };
  PriceHistoryInterval: {
    readonly MAX: PriceHistoryIntervalType;
    readonly ONE_WEEK: PriceHistoryIntervalType;
    readonly ONE_DAY: PriceHistoryIntervalType;
    readonly SIX_HOURS: PriceHistoryIntervalType;
    readonly ONE_HOUR: PriceHistoryIntervalType;
  };
};

/* eslint-disable @typescript-eslint/no-require-imports */
const polymarketClobClient =
  require("@polymarket/clob-client") as PolymarketClobClientModule;
/* eslint-enable @typescript-eslint/no-require-imports */
const { ClobClient, Chain, PriceHistoryInterval } = polymarketClobClient;

// ─── Re-export SDK types for downstream consumers ───────────────────────────

export type { OrderBookSummary, OpenOrder, Trade, MarketPrice, TickSize };
export type { BuilderTrade, HeartbeatResponse, OrderScoring, OrdersScoring };
export type { PriceHistoryIntervalType };

// PriceHistoryInterval is exported as a runtime enum so downstream code can
// use the typed enum members (e.g. PriceHistoryInterval.MAX) instead of
// string-literals-with-assertions.
export { PriceHistoryInterval };

// ─── Legacy interfaces kept for backward compatibility ──────────────────────

export interface ClobSubmitRequest {
  order: Record<string, unknown>;
  builderHeaders: Record<string, string>;
}

export interface ClobOrderResponse {
  orderID: string;
  status: string;
  transactionHash?: string;
}

export interface ClobUserOrdersParams {
  id?: string;
  market?: string;
  asset_id?: string;
  next_cursor?: string;
}

export interface ClobUserOrdersResponse {
  limit: number;
  count: number;
  next_cursor: string;
  data: OpenOrder[];
}

export interface ClobOrderScoringResponse {
  scoring: Record<string, unknown>;
}

export interface ClobLastTradePrice {
  price: string;
}

export interface ClobTokenPrice {
  token_id: string;
  price: string;
}

export interface ClobTokenMidpoint {
  token_id: string;
  mid: string;
}

export interface ClobTokenSpread {
  token_id: string;
  spread: string;
}

export interface ClobServerTime {
  time: string;
}

export interface ClobMarketInfo {
  condition_id: string;
  min_tick_size: string;
  min_order_size: string;
  [key: string]: unknown;
}

export interface ClobBuilderLeaderboardEntry {
  builder: string;
  volume: string;
  trades: number;
  rank: number;
}

export interface ClobDailyBuilderVolume {
  date: string;
  builder: string;
  volume: string;
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

@Injectable()
export class ClobClientService {
  private readonly logger = new Logger(ClobClientService.name);
  private readonly clobUrl: string;
  readonly sdk: ClobClientLike;

  constructor(private readonly config: ConfigService) {
    this.clobUrl = this.config.getOrThrow<string>("CLOB_API_URL");
    const chainId =
      this.config.get<PolymarketChain>("POLYMARKET_CHAIN_ID") ?? Chain.POLYGON;
    this.sdk = new ClobClient(this.clobUrl, chainId);
  }

  // ─── SDK-backed market data (unauthenticated) ─────────────────────────────

  async getBook(tokenId: string): Promise<{
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    spread: string;
    midpoint: string;
    timestamp: number;
  }> {
    const ob: OrderBookSummary = await this.sdk.getOrderBook(tokenId);
    const bids = ob.bids.map((b) => ({ price: b.price, size: b.size }));
    const asks = ob.asks.map((a) => ({ price: a.price, size: a.size }));
    const midNum =
      bids.length > 0 && asks.length > 0
        ? (parseFloat(bids[0].price) + parseFloat(asks[0].price)) / 2
        : 0;
    const spreadNum =
      asks.length > 0 && bids.length > 0
        ? parseFloat(asks[0].price) - parseFloat(bids[0].price)
        : 0;
    return {
      bids,
      asks,
      spread: spreadNum.toFixed(4),
      midpoint: midNum.toFixed(4),
      timestamp: parseInt(ob.timestamp, 10) || Date.now(),
    };
  }

  async getSpread(tokenId: string): Promise<{ spread: string }> {
    return this.sdk.getSpread(tokenId);
  }

  async getMidpoint(tokenId: string): Promise<{ mid: string }> {
    return this.sdk.getMidpoint(tokenId);
  }

  async getTickSize(tokenId: string): Promise<string> {
    const ts: TickSize = await this.sdk.getTickSize(tokenId);
    return ts;
  }

  async getFeeRate(tokenId: string): Promise<string> {
    const bps: number = await this.sdk.getFeeRateBps(tokenId);
    return String(bps);
  }

  async getLastTradePrice(tokenId: string): Promise<ClobLastTradePrice> {
    return this.sdk.getLastTradePrice(tokenId);
  }

  async getServerTime(): Promise<ClobServerTime> {
    const ts: number = await this.sdk.getServerTime();
    return { time: String(ts) };
  }

  async getClobMarketInfo(conditionId: string): Promise<ClobMarketInfo> {
    const info: Record<string, unknown> = await this.sdk.getMarket(conditionId);
    return info as unknown as ClobMarketInfo;
  }

  async getPricesHistory(
    tokenId: string,
    interval?: PriceHistoryIntervalType,
    fidelity?: number,
  ): Promise<{ history: Array<{ t: number; p: string }> }> {
    const prices: MarketPrice[] = await this.sdk.getPricesHistory({
      market: tokenId,
      ...(interval ? { interval } : {}),
      ...(fidelity !== undefined ? { fidelity } : {}),
    });
    return { history: prices.map((mp) => ({ t: mp.t, p: String(mp.p) })) };
  }

  // ─── Fetch-based methods (auth headers from caller) ───────────────────────

  async submitOrder(req: ClobSubmitRequest): Promise<ClobOrderResponse> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...req.builderHeaders,
        },
        body: JSON.stringify(req.order),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async cancelOrder(clobOrderId: string, apiKey: string): Promise<void> {
    await this.withRetryVoid(() =>
      fetch(`${this.clobUrl}/order/${clobOrderId}`, {
        method: "DELETE",
        headers: { "POLY-API-KEY": apiKey },
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async cancelAll(apiKey: string): Promise<void> {
    await this.withRetryVoid(() =>
      fetch(`${this.clobUrl}/cancel-all`, {
        method: "DELETE",
        headers: { "POLY-API-KEY": apiKey },
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async cancelByMarket(apiKey: string, marketId: string): Promise<void> {
    await this.withRetryVoid(() =>
      fetch(
        `${this.clobUrl}/cancel-orders?market=${encodeURIComponent(marketId)}`,
        {
          method: "DELETE",
          headers: { "POLY-API-KEY": apiKey },
          signal: AbortSignal.timeout(15_000),
        },
      ),
    );
  }

  async fetchTrades(
    walletAddress: string,
    limit = 500,
    offset = 0,
  ): Promise<Array<Record<string, string>>> {
    const safeLimit = Math.min(limit, 500);
    const safeOffset = Math.min(offset, 1_000);
    const params = new URLSearchParams({
      user: walletAddress,
      limit: String(safeLimit),
      offset: String(safeOffset),
    });
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/trades?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getBooks(tokenIds: string[]): Promise<
    Array<{
      tokenId: string;
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
    }>
  > {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenIds),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getBatchPricesHistory(
    tokenIds: string[],
    interval?: PriceHistoryIntervalType,
    fidelity?: number,
  ): Promise<Record<string, Array<{ t: number; p: string }>>> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/batch-prices-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds, interval, fidelity }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async submitBatchOrders(
    orders: Array<{
      order: Record<string, unknown>;
      builderHeaders: Record<string, string>;
    }>,
  ): Promise<Array<{ orderID: string; status: string }>> {
    if (orders.length > 15) {
      throw new Error("Batch order limit is 15");
    }

    const firstHeaders = orders[0]?.builderHeaders ?? {};
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...firstHeaders,
        },
        body: JSON.stringify(orders.map((o) => o.order)),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async cancelOrders(
    orderIds: string[],
    apiKey: string,
  ): Promise<{ cancelled: string[] }> {
    if (orderIds.length > 3000) {
      throw new Error("Bulk cancel limit is 3000");
    }

    return this.withRetry(() =>
      fetch(`${this.clobUrl}/orders`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "POLY-API-KEY": apiKey,
        },
        body: JSON.stringify(orderIds),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async sendHeartbeat(
    headers: Record<string, string>,
    orderIds?: string[],
  ): Promise<{ status: string }> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/heartbeats`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: orderIds ? JSON.stringify({ orderIds }) : undefined,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getUserOrders(
    params: ClobUserOrdersParams,
    headers: Record<string, string>,
  ): Promise<ClobUserOrdersResponse> {
    const qs = new URLSearchParams();
    if (params.id) qs.set("id", params.id);
    if (params.market) qs.set("market", params.market);
    if (params.asset_id) qs.set("asset_id", params.asset_id);
    if (params.next_cursor) qs.set("next_cursor", params.next_cursor);

    const query = qs.toString();
    const url = `${this.clobUrl}/data/orders${query ? `?${query}` : ""}`;
    return this.withRetry(() =>
      fetch(url, { headers, signal: AbortSignal.timeout(10_000) }),
    );
  }

  async getOrder(
    orderId: string,
    headers: Record<string, string>,
  ): Promise<OpenOrder> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/order/${encodeURIComponent(orderId)}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getOrderScoring(
    headers: Record<string, string>,
  ): Promise<ClobOrderScoringResponse> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/order-scoring`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getBuilderTrades(
    headers: Record<string, string>,
  ): Promise<Array<Record<string, unknown>>> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/builder-trades`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  // ─── Market Data (batch) — fetch-based (SDK uses BookParams with side) ────

  async getLastTradePrices(tokenIds: string[]): Promise<ClobTokenPrice[]> {
    const params = new URLSearchParams();
    params.set("token_ids", tokenIds.join(","));
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/last-trade-prices?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getLastTradePricesBody(tokenIds: string[]): Promise<ClobTokenPrice[]> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/last-trade-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenIds),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getMarketPrice(tokenId: string): Promise<ClobLastTradePrice> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/price?token_id=${encodeURIComponent(tokenId)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getMarketPrices(tokenIds: string[]): Promise<ClobTokenPrice[]> {
    const params = new URLSearchParams();
    params.set("token_ids", tokenIds.join(","));
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/prices?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getMarketPricesBody(tokenIds: string[]): Promise<ClobTokenPrice[]> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenIds),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getMidpoints(tokenIds: string[]): Promise<ClobTokenMidpoint[]> {
    const params = new URLSearchParams();
    params.set("token_ids", tokenIds.join(","));
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/midpoints?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getMidpointsBody(tokenIds: string[]): Promise<ClobTokenMidpoint[]> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/midpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenIds),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getSpreads(tokenIds: string[]): Promise<ClobTokenSpread[]> {
    const params = new URLSearchParams();
    params.set("token_ids", tokenIds.join(","));
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/spreads?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  // ─── Phase 4: Builder Analytics ───────────────────────────────────────────

  async getBuilderLeaderboard(): Promise<ClobBuilderLeaderboardEntry[]> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/builder-leaderboard`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getDailyBuilderVolume(): Promise<ClobDailyBuilderVolume[]> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/daily-builder-volume`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async withRetry<T>(call: () => Promise<Response>): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const res = await call();

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        this.logger.warn(
          `CLOB 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`CLOB API error ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    }

    throw new Error("CLOB API error 429: rate limit exhausted");
  }

  private async withRetryVoid(call: () => Promise<Response>): Promise<void> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const res = await call();

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        this.logger.warn(
          `CLOB 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`CLOB API error ${res.status}: ${body}`);
      }

      return;
    }

    throw new Error("CLOB API error 429: rate limit exhausted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
