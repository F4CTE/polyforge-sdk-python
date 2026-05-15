import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateService } from "./state.service";

const DEFAULT_STATE = {
  betsToday: 0,
  dailyPnl: 0,
  consecutiveLoss: 0,
  consecutiveWin: 0,
  lastTradeAt: 0,
  tradedTokensToday: [],
  totalOrders: 0,
};

function makeRedisMock(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue({
      eval: vi.fn().mockResolvedValue(JSON.stringify(DEFAULT_STATE)),
    }),
    ...overrides,
  } as any;
}

describe("StateService", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let svc: StateService;

  beforeEach(() => {
    redis = makeRedisMock();
    svc = new StateService(redis);
  });

  describe("get()", () => {
    it("returns default state when Redis has no key", async () => {
      const state = await svc.get("strat-1");
      expect(state).toEqual(DEFAULT_STATE);
    });

    it("merges stored state with defaults", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ betsToday: 3, dailyPnl: -5 }),
      );
      const state = await svc.get("strat-1");
      expect(state.betsToday).toBe(3);
      expect(state.dailyPnl).toBe(-5);
      expect(state.consecutiveLoss).toBe(0); // from defaults
    });

    it("returns default state when JSON is malformed", async () => {
      redis.get.mockResolvedValue("not-valid-json{{{");
      const state = await svc.get("strat-1");
      expect(state).toEqual(DEFAULT_STATE);
    });

    it("uses the correct Redis key", async () => {
      await svc.get("my-strategy");
      expect(redis.get).toHaveBeenCalledWith("strategy:my-strategy:state");
    });
  });

  describe("set()", () => {
    it("serialises state to JSON and stores it", async () => {
      const state = { ...DEFAULT_STATE, betsToday: 5 };
      await svc.set("strat-1", state);
      const [key, value] = redis.set.mock.calls[0];
      expect(key).toBe("strategy:strat-1:state");
      expect(JSON.parse(value).betsToday).toBe(5);
    });

    it("passes a positive TTL (seconds until midnight UTC)", async () => {
      await svc.set("strat-1", DEFAULT_STATE);
      const ttl = redis.set.mock.calls[0][2];
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it("clamps TTL to at least one second at the midnight boundary", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-05-06T23:59:59.999Z"));
        await svc.set("strat-1", DEFAULT_STATE);
        expect(redis.set.mock.calls[0][2]).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("update()", () => {
    it("atomically merges a partial patch into the existing state via Lua script", async () => {
      const mergedState = {
        ...DEFAULT_STATE,
        betsToday: 5,
        dailyPnl: -3,
      };
      const redisClient = {
        eval: vi.fn().mockResolvedValue(JSON.stringify(mergedState)),
      };
      redis = makeRedisMock({
        getClient: vi.fn().mockReturnValue(redisClient),
      });
      svc = new StateService(redis);

      const updated = await svc.update("strat-1", { betsToday: 5 });
      expect(updated.betsToday).toBe(5);
      expect(updated.dailyPnl).toBe(-3); // from mock response
    });

    it("passes patch as JSON and TTL to the atomic Lua script", async () => {
      const redisClient = {
        eval: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify({ ...DEFAULT_STATE, totalOrders: 10 }),
          ),
      };
      redis = makeRedisMock({
        getClient: vi.fn().mockReturnValue(redisClient),
      });
      svc = new StateService(redis);

      await svc.update("strat-1", { totalOrders: 10 });

      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "strategy:strat-1:state",
        expect.stringContaining("totalOrders"),
        expect.any(String),
      );
      const patchArg = redisClient.eval.mock.calls[0][3];
      const parsedPatch = JSON.parse(patchArg);
      expect(parsedPatch.totalOrders).toBe(10);
    });

    it("handles patch on missing key (returns defaults merged with patch)", async () => {
      const redisClient = {
        eval: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify({ ...DEFAULT_STATE, betsToday: 1 }),
          ),
      };
      redis = makeRedisMock({
        getClient: vi.fn().mockReturnValue(redisClient),
      });
      svc = new StateService(redis);

      const updated = await svc.update("strat-new", { betsToday: 1 });
      expect(updated.betsToday).toBe(1);
      expect(updated.totalOrders).toBe(0); // defaults filled
    });
  });

  describe("incrementOrderCounters()", () => {
    it("increments order counters with a single Redis script", async () => {
      const redisClient = {
        eval: vi.fn().mockResolvedValue(
          JSON.stringify({
            ...DEFAULT_STATE,
            betsToday: 3,
            totalOrders: 7,
            lastTradeAt: 12345,
          }),
        ),
      };
      redis = makeRedisMock({
        getClient: vi.fn().mockReturnValue(redisClient),
      });
      svc = new StateService(redis);

      const updated = await svc.incrementOrderCounters("strat-1", 2, 12345);

      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "strategy:strat-1:state",
        "2",
        "12345",
        expect.any(String),
      );
      expect(updated).toMatchObject({
        betsToday: 3,
        totalOrders: 7,
        lastTradeAt: 12345,
      });
    });
  });

  describe("clear()", () => {
    it("deletes the state key", async () => {
      await svc.clear("strat-1");
      expect(redis.del).toHaveBeenCalledWith("strategy:strat-1:state");
    });
  });

  describe("getPrice()", () => {
    it("delegates to redis.getJson with cache:price key", async () => {
      redis.getJson.mockResolvedValue({ price: 0.72, timestamp: 12345 });
      const result = await svc.getPrice("tok-abc");
      expect(result).toEqual({ price: 0.72, timestamp: 12345 });
      expect(redis.getJson).toHaveBeenCalledWith("cache:price:tok-abc");
    });

    it("returns null when price is not cached", async () => {
      const result = await svc.getPrice("unknown");
      expect(result).toBeNull();
    });
  });

  describe("getBook()", () => {
    it("delegates to redis.getJson with cache:book key", async () => {
      const book = {
        bids: [],
        asks: [],
        midpoint: "0.5",
        spread: "0.02",
        timestamp: 111,
      };
      redis.getJson.mockResolvedValue(book);
      const result = await svc.getBook("tok-abc");
      expect(result).toEqual(book);
      expect(redis.getJson).toHaveBeenCalledWith("cache:book:tok-abc");
    });

    it("returns null when book is not cached", async () => {
      const result = await svc.getBook("unknown");
      expect(result).toBeNull();
    });
  });

  describe("getPriceAge()", () => {
    it("returns Infinity when key is missing", async () => {
      const age = await svc.getPriceAge("tok-1");
      expect(age).toBe(Infinity);
    });

    it("returns approximate age when timestamp is stored", async () => {
      const ts = Date.now() - 3_000; // 3 seconds ago
      redis.get.mockResolvedValue(
        JSON.stringify({ price: 0.5, timestamp: ts }),
      );
      const age = await svc.getPriceAge("tok-1");
      expect(age).toBeGreaterThanOrEqual(3_000);
      expect(age).toBeLessThan(5_000); // should not be too old
    });

    it("returns Infinity when JSON is malformed", async () => {
      redis.get.mockResolvedValue("{bad json");
      const age = await svc.getPriceAge("tok-1");
      expect(age).toBe(Infinity);
    });

    it("uses the correct Redis key", async () => {
      await svc.getPriceAge("token-abc");
      expect(redis.get).toHaveBeenCalledWith("cache:price:token-abc");
    });
  });
});
