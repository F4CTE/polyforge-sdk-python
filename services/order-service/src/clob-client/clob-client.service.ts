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
    const res = await fetch(`${this.clobUrl}/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...req.builderHeaders,
      },
      body: JSON.stringify(req.order),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CLOB API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<ClobOrderResponse>;
  }

  async cancelOrder(clobOrderId: string, apiKey: string): Promise<void> {
    const res = await fetch(`${this.clobUrl}/order/${clobOrderId}`, {
      method: "DELETE",
      headers: { "POLY-API-KEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CLOB cancel error ${res.status}: ${body}`);
    }
  }

  /**
   * Cancel all open orders for a user via the Polymarket CLOB bulk cancel endpoint.
   */
  async cancelAll(apiKey: string): Promise<void> {
    const res = await fetch(`${this.clobUrl}/cancel-all`, {
      method: "DELETE",
      headers: { "POLY-API-KEY": apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CLOB cancel-all error ${res.status}: ${body}`);
    }
  }

  /**
   * Cancel all open orders for a user in a specific market.
   */
  async cancelByMarket(apiKey: string, marketId: string): Promise<void> {
    const res = await fetch(
      `${this.clobUrl}/cancel-orders?market=${encodeURIComponent(marketId)}`,
      {
        method: "DELETE",
        headers: { "POLY-API-KEY": apiKey },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CLOB cancel-by-market error ${res.status}: ${body}`);
    }
  }

  /**
   * Fetch trades for a user from the Polymarket CLOB API.
   */
  async fetchTrades(
    walletAddress: string,
  ): Promise<Array<Record<string, string>>> {
    const res = await fetch(
      `${this.clobUrl}/trades?user=${encodeURIComponent(walletAddress)}`,
      {
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CLOB fetch-trades error ${res.status}: ${body}`);
    }

    return res.json() as Promise<Array<Record<string, string>>>;
  }
}
