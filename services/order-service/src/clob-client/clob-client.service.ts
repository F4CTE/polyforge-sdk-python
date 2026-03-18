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
}
