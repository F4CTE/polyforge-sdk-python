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

const INCREMENT_ORDER_COUNTERS_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
local state = {}
if raw then
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == "table" then
    state = parsed
  end
end

state.betsToday = (tonumber(state.betsToday) or 0) + tonumber(ARGV[1])
state.dailyPnl = tonumber(state.dailyPnl) or 0
state.consecutiveLoss = tonumber(state.consecutiveLoss) or 0
state.consecutiveWin = tonumber(state.consecutiveWin) or 0
state.lastTradeAt = tonumber(ARGV[2])
if type(state.tradedTokensToday) ~= "table" then
  state.tradedTokensToday = {}
end
state.totalOrders = (tonumber(state.totalOrders) or 0) + tonumber(ARGV[1])

local ttl = tonumber(ARGV[3]) or 1
if ttl < 1 then
  ttl = 1
end

local encoded = cjson.encode(state)
redis.call("SET", KEYS[1], encoded, "EX", ttl)
return encoded
`;

function midnightUtcTtl(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

@Injectable()
export class StateService {
  constructor(private readonly redis: RedisService) {}

  private key(strategyId: string): string {
    return `strategy:${strategyId}:state`;
  }

  private parseState(raw: string): StrategyState {
    return {
      ...DEFAULT_STATE,
      ...(JSON.parse(raw) as Partial<StrategyState>),
    };
  }

  async get(strategyId: string): Promise<StrategyState> {
    const raw = await this.redis.get(this.key(strategyId));
    if (!raw) return { ...DEFAULT_STATE };
    try {
      return this.parseState(raw);
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

  async incrementOrderCounters(
    strategyId: string,
    count: number,
    lastTradeAt: number,
  ): Promise<StrategyState> {
    const raw = (await this.redis
      .getClient()
      .eval(
        INCREMENT_ORDER_COUNTERS_SCRIPT,
        1,
        this.key(strategyId),
        String(count),
        String(lastTradeAt),
        String(midnightUtcTtl()),
      )) as string;

    return this.parseState(raw);
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
