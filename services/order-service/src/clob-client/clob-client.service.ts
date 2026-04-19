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

const RETRY_DELAYS_MS = [500, 1000, 2000];

/**
 * HTTP client for the Polymarket CLOB API.
 * In dev, points to mock-polymarket.
 */
@Injectable()
export class ClobClientService {
  private readonly logger = new Logger(ClobClientService.name);
  private readonly clobUrl: string;

  constructor(private readonly config: ConfigService) {
    this.clobUrl =
      this.config.get<string>("CLOB_API_URL") ?? "http://mock-polymarket:3099";
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
