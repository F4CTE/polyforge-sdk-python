import { Injectable } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { StrategyState } from "../blocks/block.types";

const DEFAULT_STATE: StrategyState = {
  betsToday: 0,
  dailyPnl: 0,
  consecutiveLoss: 0,
  consecutiveWin: 0,
  lastTradeAt: 0,
  tradedTokensToday: [],
  totalOrders: 0,
};

function midnightUtcTtl(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

@Injectable()
export class StateService {
  constructor(private readonly redis: RedisService) {}

  private key(strategyId: string): string {
    return `strategy:${strategyId}:state`;
  }

  async get(strategyId: string): Promise<StrategyState> {
    const raw = await this.redis.get(this.key(strategyId));
    if (!raw) return { ...DEFAULT_STATE };
    try {
      return {
        ...DEFAULT_STATE,
        ...(JSON.parse(raw) as Partial<StrategyState>),
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async set(strategyId: string, state: StrategyState): Promise<void> {
    await this.redis.set(
      this.key(strategyId),
      JSON.stringify(state),
      midnightUtcTtl(),
    );
  }

  async update(
    strategyId: string,
    patch: Partial<StrategyState>,
  ): Promise<StrategyState> {
    const state = await this.get(strategyId);
    const updated = { ...state, ...patch };
    await this.set(strategyId, updated);
    return updated;
  }

  async clear(strategyId: string): Promise<void> {
    await this.redis.del(this.key(strategyId));
  }

  async getPriceAge(tokenId: string): Promise<number> {
    const raw = await this.redis.get(`cache:price:${tokenId}`);
    if (!raw) return Infinity;
    try {
      const { timestamp } = JSON.parse(raw) as {
        price: number;
        timestamp: number;
      };
      return Date.now() - timestamp;
    } catch {
      return Infinity;
    }
  }

  async getPrice(
    tokenId: string,
  ): Promise<{ price: number; timestamp: number } | null> {
    return this.redis.getJson<{ price: number; timestamp: number }>(
      `cache:price:${tokenId}`,
    );
  }

  async getBook(tokenId: string): Promise<{
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    midpoint: string;
    spread: string;
    timestamp: number;
  } | null> {
    return this.redis.getJson(`cache:book:${tokenId}`);
  }
}
