import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ClobReadService {
  private readonly logger = new Logger(ClobReadService.name);
  private readonly clobUrl: string;

  constructor(private readonly config: ConfigService) {
    this.clobUrl = this.config.getOrThrow<string>("CLOB_API_URL");
  }

  async getTickSize(tokenId: string): Promise<string> {
    const res = await this.fetch(`/tick-size/${encodeURIComponent(tokenId)}`);
    return res.ok ? String(await res.json()) : "0.01";
  }

  async getFeeRate(tokenId: string): Promise<string> {
    const res = await this.fetch(`/fee-rate/${encodeURIComponent(tokenId)}`);
    return res.ok ? String(await res.json()) : "0";
  }

  async getSpread(tokenId: string): Promise<{ spread: string }> {
    const res = await this.fetch(
      `/spread?token_id=${encodeURIComponent(tokenId)}`,
    );
    if (!res.ok) {
      this.logger.warn(`CLOB spread returned ${res.status}`);
      return { spread: "0" };
    }
    const data = (await res.json()) as { spread: string };
    return { spread: data.spread ?? "0" };
  }

  async getMidpoint(tokenId: string): Promise<{ mid: string }> {
    const res = await this.fetch(
      `/midpoint?token_id=${encodeURIComponent(tokenId)}`,
    );
    if (!res.ok) {
      this.logger.warn(`CLOB midpoint returned ${res.status}`);
      return { mid: "0" };
    }
    const data = (await res.json()) as { mid: string };
    return { mid: data.mid ?? "0" };
  }

  async getBook(tokenId: string): Promise<{
    bids: unknown[];
    asks: unknown[];
    spread: string;
    midpoint: string;
    timestamp: number;
  }> {
    const res = await this.fetch(
      `/book?token_id=${encodeURIComponent(tokenId)}`,
    );
    if (!res.ok) {
      this.logger.warn(`CLOB book returned ${res.status}`);
      return {
        bids: [],
        asks: [],
        spread: "0",
        midpoint: "0",
        timestamp: Date.now(),
      };
    }
    const data = (await res.json()) as {
      bids?: unknown[];
      asks?: unknown[];
      spread?: string;
      midpoint?: string;
      timestamp?: number;
    };
    return {
      bids: data.bids ?? [],
      asks: data.asks ?? [],
      spread: data.spread ?? "0",
      midpoint: data.midpoint ?? "0",
      timestamp: data.timestamp ?? Date.now(),
    };
  }

  async getPricesHistory(
    tokenId: string,
    interval: string,
    fidelity: number,
  ): Promise<{ history: unknown[] }> {
    const params = new URLSearchParams({
      token_id: tokenId,
      interval,
      fidelity: String(fidelity),
    });
    const res = await this.fetch(`/prices-history?${params.toString()}`);
    if (!res.ok) {
      this.logger.warn(`CLOB prices-history returned ${res.status}`);
      return { history: [] };
    }
    const data = (await res.json()) as { history?: unknown[] };
    return { history: data.history ?? [] };
  }

  async getPositions(walletAddress: string): Promise<
    Array<{
      asset: string;
      size: string;
      avgPrice: string;
      realizedPnl: string;
    }>
  > {
    const res = await this.fetch(`/positions?user=${walletAddress}`);
    if (!res.ok) return [];
    return res.json() as Promise<
      Array<{
        asset: string;
        size: string;
        avgPrice: string;
        realizedPnl: string;
      }>
    >;
  }

  private fetch(path: string): Promise<Response> {
    return globalThis.fetch(`${this.clobUrl}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
  }
}
