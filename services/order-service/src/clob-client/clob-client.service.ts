import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ClobSubmitRequest {
  order: Record<string, unknown>;
  builderHeaders: Record<string, string>;
}

export interface ClobOrderResponse {
  orderID: string;
  status: string;
  transactionHash?: string;
}

export interface ClobOrder {
  id: string;
  market: string;
  asset_id: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  status: string;
  type: string;
  created_at: string;
  expiration: string;
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
  data: ClobOrder[];
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

const RETRY_DELAYS_MS = [500, 1000, 2000];

/**
 * HTTP client for the Polymarket CLOB API.
 */
@Injectable()
export class ClobClientService {
  private readonly logger = new Logger(ClobClientService.name);
  private readonly clobUrl: string;

  constructor(private readonly config: ConfigService) {
    this.clobUrl = this.config.getOrThrow<string>("CLOB_API_URL");
  }

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

  /**
   * Cancel all open orders for a user via the Polymarket CLOB bulk cancel endpoint.
   */
  async cancelAll(apiKey: string): Promise<void> {
    await this.withRetryVoid(() =>
      fetch(`${this.clobUrl}/cancel-all`, {
        method: "DELETE",
        headers: { "POLY-API-KEY": apiKey },
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  /**
   * Cancel all open orders for a user in a specific market.
   */
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

  /**
   * Fetch trades for a user from the Polymarket CLOB API.
   * limit capped at 500, offset capped at 1,000 per API enforcement.
   */
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

  async getBook(tokenId: string): Promise<{
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    spread: string;
    midpoint: string;
    timestamp: number;
  }> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/book?token_id=${encodeURIComponent(tokenId)}`, {
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

  async getSpread(tokenId: string): Promise<{ spread: string }> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/spread?token_id=${encodeURIComponent(tokenId)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getMidpoint(tokenId: string): Promise<{ mid: string }> {
    return this.withRetry(() =>
      fetch(
        `${this.clobUrl}/midpoint?token_id=${encodeURIComponent(tokenId)}`,
        { signal: AbortSignal.timeout(10_000) },
      ),
    );
  }

  async getPricesHistory(
    tokenId: string,
    interval?: string,
    fidelity?: number,
  ): Promise<{ history: Array<{ t: number; p: string }> }> {
    const params = new URLSearchParams({ token_id: tokenId });
    if (interval) params.set("interval", interval);
    if (fidelity !== undefined) params.set("fidelity", String(fidelity));

    return this.withRetry(() =>
      fetch(`${this.clobUrl}/prices-history?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getBatchPricesHistory(
    tokenIds: string[],
    interval?: string,
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

  async getTickSize(tokenId: string): Promise<string> {
    return this.withRetry<string>(() =>
      fetch(`${this.clobUrl}/tick-size/${encodeURIComponent(tokenId)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getFeeRate(tokenId: string): Promise<string> {
    return this.withRetry<string>(() =>
      fetch(`${this.clobUrl}/fee-rate/${encodeURIComponent(tokenId)}`, {
        signal: AbortSignal.timeout(10_000),
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
  ): Promise<ClobOrder> {
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

  // ─── Market Data (Phase 2) ─────────────────────────────────────────────────

  async getLastTradePrice(tokenId: string): Promise<ClobLastTradePrice> {
    return this.withRetry(() =>
      fetch(
        `${this.clobUrl}/last-trade-price?token_id=${encodeURIComponent(tokenId)}`,
        { signal: AbortSignal.timeout(10_000) },
      ),
    );
  }

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

  async getServerTime(): Promise<ClobServerTime> {
    return this.withRetry(() =>
      fetch(`${this.clobUrl}/server-time`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getClobMarketInfo(conditionId: string): Promise<ClobMarketInfo> {
    return this.withRetry(() =>
      fetch(
        `${this.clobUrl}/clob-market-info?condition_id=${encodeURIComponent(conditionId)}`,
        { signal: AbortSignal.timeout(10_000) },
      ),
    );
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Execute a fetch call with exponential backoff on 429 responses.
   * Retries up to RETRY_DELAYS_MS.length times (max 3 attempts total).
   * Only 429 triggers a retry — other errors propagate immediately.
   */
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
