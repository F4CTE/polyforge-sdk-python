import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PolymarketPortfolioEntry {
  asset: string;
  size: string;
  avgPrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
}

export interface PolymarketEarningsEntry {
  date: string;
  earnings: string;
  volume: string;
  winRate: string;
}

@Injectable()
export class PolymarketDataApiService {
  private readonly logger = new Logger(PolymarketDataApiService.name);
  private readonly dataApiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.dataApiUrl =
      this.config.get<string>("POLYMARKET_DATA_API_URL") ??
      "https://data-api.polymarket.com";
  }

  async getPortfolio(
    walletAddress: string,
  ): Promise<PolymarketPortfolioEntry[]> {
    const res = await fetch(
      `${this.dataApiUrl}/v2/portfolio?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) {
      this.logger.warn(
        `Polymarket Data API portfolio returned ${res.status} for ${walletAddress}`,
      );
      return [];
    }

    return (await res.json()) as PolymarketPortfolioEntry[];
  }

  async getEarnings(walletAddress: string): Promise<PolymarketEarningsEntry[]> {
    const res = await fetch(
      `${this.dataApiUrl}/earnings?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) {
      this.logger.warn(
        `Polymarket Data API earnings returned ${res.status} for ${walletAddress}`,
      );
      return [];
    }

    return (await res.json()) as PolymarketEarningsEntry[];
  }
}
