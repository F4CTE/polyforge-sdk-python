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

const ATOMIC_UPDATE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
local state = {}
if raw then
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == "table" then
    state = parsed
  end
end

local patch = cjson.decode(ARGV[1])
for k, v in pairs(patch) do
  state[k] = v
end

local ttl = tonumber(ARGV[2]) or 1
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
    const raw = (await this.redis
      .getClient()
      .eval(
        ATOMIC_UPDATE_SCRIPT,
        1,
        this.key(strategyId),
        JSON.stringify(patch),
        String(midnightUtcTtl()),
      )) as string;

    return this.parseState(raw);
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

  /**
   * Fetch strategy state + price caches for the given tokenIds in a single
   * Redis pipeline, eliminating the N+1 round-trips of calling get() then
   * getPrice() individually.
   */
  async getStateAndPrices(
    strategyId: string,
    tokenIds: string[],
  ): Promise<{
    state: StrategyState;
    prices: Map<string, { price: number; timestamp: number } | null>;
  }> {
    if (tokenIds.length === 0) {
      return { state: await this.get(strategyId), prices: new Map() };
    }

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.get(this.key(strategyId));
    for (const tokenId of tokenIds) {
      pipeline.get(`cache:price:${tokenId}`);
    }

    const results = await pipeline.exec();
    const prices = new Map<
      string,
      { price: number; timestamp: number } | null
    >();

    if (!results) {
      throw new Error(
        `Redis pipeline execution failed for strategy ${strategyId}`,
      );
    }

    const [stateErr, stateRaw] = results[0];
    if (stateErr) {
      throw stateErr instanceof Error
        ? stateErr
        : new Error(`Redis command failed: ${String(stateErr)}`);
    }
    let state: StrategyState;
    if (!stateRaw) {
      state = { ...DEFAULT_STATE };
    } else {
      try {
        state = this.parseState(stateRaw as string);
      } catch {
        state = { ...DEFAULT_STATE };
      }
    }

    for (let i = 0; i < tokenIds.length; i++) {
      const [, priceRaw] = results[i + 1] ?? [];
      if (!priceRaw) {
        prices.set(tokenIds[i], null);
        continue;
      }
      try {
        prices.set(tokenIds[i], JSON.parse(priceRaw as string));
      } catch {
        prices.set(tokenIds[i], null);
      }
    }

    return { state, prices };
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
