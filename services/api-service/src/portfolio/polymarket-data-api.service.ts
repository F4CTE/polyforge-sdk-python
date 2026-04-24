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

export interface PolymarketRewardsMarket {
  conditionId: string;
  rewardsDaily: string;
  rewardsMaxSpread: string;
  rewardsMinSize: string;
  startDate: string;
  endDate: string;
}

export interface PolymarketUserRewards {
  date: string;
  amount: string;
  market: string;
}

export interface PolymarketActivity {
  id: string;
  type: string;
  amount: string;
  asset: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PolymarketRebate {
  date: string;
  amount: string;
  feesPaid: string;
}

export interface PolymarketPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: string;
  avgPrice: string;
  currentValue: string;
  cashPnl: string;
  percentPnl: string;
  redeemable: boolean;
  mergeable: boolean;
  negativeRisk: boolean;
}

export interface PolymarketPositionsParams {
  market?: string;
  eventId?: string;
  sizeThreshold?: number;
  redeemable?: boolean;
  mergeable?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: string;
  title?: string;
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

  async getRewardsMarkets(): Promise<PolymarketRewardsMarket[]> {
    const res = await fetch(`${this.dataApiUrl}/rewards/markets/current`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`Polymarket rewards/markets returned ${res.status}`);
      return [];
    }
    return (await res.json()) as PolymarketRewardsMarket[];
  }

  async getRewardsForMarket(
    conditionId: string,
  ): Promise<PolymarketRewardsMarket | null> {
    const res = await fetch(
      `${this.dataApiUrl}/rewards/markets/${encodeURIComponent(conditionId)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as PolymarketRewardsMarket;
  }

  async getUserRewards(
    walletAddress: string,
  ): Promise<PolymarketUserRewards[]> {
    const res = await fetch(
      `${this.dataApiUrl}/rewards/user?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(
        `Polymarket rewards/user returned ${res.status} for ${walletAddress}`,
      );
      return [];
    }
    return (await res.json()) as PolymarketUserRewards[];
  }

  async getUserRewardsTotal(
    walletAddress: string,
  ): Promise<{ total: string; byDate: unknown[] }> {
    const res = await fetch(
      `${this.dataApiUrl}/rewards/user/total?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(`Polymarket rewards/user/total returned ${res.status}`);
      return { total: "0", byDate: [] };
    }
    return (await res.json()) as { total: string; byDate: unknown[] };
  }

  async getUserRewardsPerMarket(walletAddress: string): Promise<unknown[]> {
    const res = await fetch(
      `${this.dataApiUrl}/rewards/user/markets?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(
        `Polymarket rewards/user/markets returned ${res.status}`,
      );
      return [];
    }
    return (await res.json()) as unknown[];
  }

  async getUserRewardsPercentages(walletAddress: string): Promise<unknown> {
    const res = await fetch(
      `${this.dataApiUrl}/rewards/user/percentages?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return {};
    return await res.json();
  }

  async getRebates(walletAddress: string): Promise<PolymarketRebate[]> {
    const res = await fetch(
      `${this.dataApiUrl}/rebates/current?user=${encodeURIComponent(walletAddress)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(`Polymarket rebates returned ${res.status}`);
      return [];
    }
    return (await res.json()) as PolymarketRebate[];
  }

  async getActivity(
    walletAddress: string,
    type?: string,
  ): Promise<PolymarketActivity[]> {
    const params = new URLSearchParams({ user: walletAddress });
    if (type) params.set("type", type);

    const res = await fetch(
      `${this.dataApiUrl}/activity?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(`Polymarket activity returned ${res.status}`);
      return [];
    }
    return (await res.json()) as PolymarketActivity[];
  }

  async getPositions(
    walletAddress: string,
    opts?: PolymarketPositionsParams,
  ): Promise<PolymarketPosition[]> {
    const params = new URLSearchParams({
      user: encodeURIComponent(walletAddress),
    });
    if (opts?.market) params.set("market", opts.market);
    if (opts?.eventId) params.set("eventId", opts.eventId);
    if (opts?.sizeThreshold !== undefined)
      params.set("sizeThreshold", String(opts.sizeThreshold));
    if (opts?.redeemable !== undefined)
      params.set("redeemable", String(opts.redeemable));
    if (opts?.mergeable !== undefined)
      params.set("mergeable", String(opts.mergeable));
    if (opts?.limit !== undefined)
      params.set("limit", String(Math.min(opts.limit, 500)));
    if (opts?.offset !== undefined)
      params.set("offset", String(Math.min(opts.offset, 10_000)));
    if (opts?.sortBy) params.set("sortBy", opts.sortBy);
    if (opts?.sortDirection) params.set("sortDirection", opts.sortDirection);
    if (opts?.title) params.set("title", opts.title);

    const res = await fetch(
      `${this.dataApiUrl}/positions?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(
        `Polymarket Data API positions returned ${res.status} for ${walletAddress}`,
      );
      return [];
    }
    return (await res.json()) as PolymarketPosition[];
  }

  async getClosedPositions(
    walletAddress: string,
    opts?: PolymarketPositionsParams,
  ): Promise<PolymarketPosition[]> {
    const params = new URLSearchParams({
      user: encodeURIComponent(walletAddress),
    });
    if (opts?.market) params.set("market", opts.market);
    if (opts?.eventId) params.set("eventId", opts.eventId);
    if (opts?.sizeThreshold !== undefined)
      params.set("sizeThreshold", String(opts.sizeThreshold));
    if (opts?.redeemable !== undefined)
      params.set("redeemable", String(opts.redeemable));
    if (opts?.mergeable !== undefined)
      params.set("mergeable", String(opts.mergeable));
    if (opts?.limit !== undefined)
      params.set("limit", String(Math.min(opts.limit, 500)));
    if (opts?.offset !== undefined)
      params.set("offset", String(Math.min(opts.offset, 10_000)));
    if (opts?.sortBy) params.set("sortBy", opts.sortBy);
    if (opts?.sortDirection) params.set("sortDirection", opts.sortDirection);
    if (opts?.title) params.set("title", opts.title);

    const res = await fetch(
      `${this.dataApiUrl}/closed-positions?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      this.logger.warn(
        `Polymarket Data API closed-positions returned ${res.status} for ${walletAddress}`,
      );
      return [];
    }
    return (await res.json()) as PolymarketPosition[];
  }
}
