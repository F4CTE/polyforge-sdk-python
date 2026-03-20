import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandsService } from "./commands.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    strategy: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    position: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { realizedPnl: null } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    paperPosition: {
      count: vi.fn().mockResolvedValue(0),
    },
    paperOrder: {
      count: vi.fn().mockResolvedValue(0),
    },
    priceAlert: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  } as any;
}

function makeJwtMock() {
  return {
    sign: vi.fn().mockReturnValue("mock-jwt-token"),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CommandsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let jwt: ReturnType<typeof makeJwtMock>;
  let svc: CommandsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    jwt = makeJwtMock();
    svc = new CommandsService(prisma, redis, jwt);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── execute (router) ───────────────────────────────────────────────────

  describe("execute — routing", () => {
    it("routes /help to return help text", async () => {
      const result = await svc.execute("user-1", "/help");
      expect(result).toContain("Polyforge Bot Commands");
      expect(result).toContain("/status");
      expect(result).toContain("/pnl");
    });

    it("returns unknown command message for unrecognized command", async () => {
      const result = await svc.execute("user-1", "/foo");
      expect(result).toContain("Unknown command: /foo");
      expect(result).toContain("/help");
    });

    it("is case-insensitive for command matching", async () => {
      const result = await svc.execute("user-1", "/HELP");
      expect(result).toContain("Polyforge Bot Commands");
    });

    it("trims whitespace from input", async () => {
      const result = await svc.execute("user-1", "  /help  ");
      expect(result).toContain("Polyforge Bot Commands");
    });
  });

  // ─── /status ──────────────────────────────────────────────────────────────

  describe("/status", () => {
    it("returns no active strategies message when none found", async () => {
      prisma.strategy.findMany.mockResolvedValue([]);
      const result = await svc.execute("user-1", "/status");
      expect(result).toContain("No active strategies");
    });

    it("lists active strategies with status", async () => {
      prisma.strategy.findMany.mockResolvedValue([
        { name: "Alpha", status: "RUNNING" },
        { name: "Beta", status: "PAUSED" },
      ]);
      const result = await svc.execute("user-1", "/status");
      expect(result).toContain("Alpha [RUNNING]");
      expect(result).toContain("Beta [PAUSED]");
    });

    it("includes paper P&L when available from Redis", async () => {
      prisma.strategy.findMany.mockResolvedValue([
        { name: "Alpha", status: "PAPER" },
      ]);
      redis.get.mockResolvedValue("42.50");
      const result = await svc.execute("user-1", "/status");
      expect(result).toContain("Paper P&L");
      expect(result).toContain("42.50");
    });

    it("omits paper P&L line when Redis returns null", async () => {
      prisma.strategy.findMany.mockResolvedValue([
        { name: "Alpha", status: "RUNNING" },
      ]);
      redis.get.mockResolvedValue(null);
      const result = await svc.execute("user-1", "/status");
      expect(result).not.toContain("Paper P&L");
    });
  });

  // ─── /stop, /pause, /resume ────────────────────────────────────────────────

  describe("/stop, /pause, /resume", () => {
    it("returns usage message when no strategy name provided", async () => {
      const result = await svc.execute("user-1", "/stop");
      expect(result).toContain("Usage: /stop <strategy name>");
    });

    it("returns not found when strategy does not exist", async () => {
      prisma.strategy.findFirst.mockResolvedValue(null);
      const result = await svc.execute("user-1", "/stop NonExistent");
      expect(result).toContain('Strategy "NonExistent" not found');
    });

    it("sends DELETE to engine for /stop and returns success", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "RUNNING",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      );

      const result = await svc.execute("user-1", "/stop Alpha");
      expect(result).toContain('Strategy "Alpha" stopped');

      const fetchCall = (fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("/internal/strategies/strat-1");
      expect(fetchCall[1].method).toBe("DELETE");

      vi.unstubAllGlobals();
    });

    it("sends POST to engine for /pause and returns success", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "RUNNING",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      );

      const result = await svc.execute("user-1", "/pause Alpha");
      expect(result).toContain('Strategy "Alpha" paused');

      const fetchCall = (fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("/internal/strategies/strat-1/pause");
      expect(fetchCall[1].method).toBe("POST");

      vi.unstubAllGlobals();
    });

    it("sends POST to engine for /resume and returns success", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "PAUSED",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      );

      const result = await svc.execute("user-1", "/resume Alpha");
      expect(result).toContain('Strategy "Alpha" resumed');

      vi.unstubAllGlobals();
    });

    it("returns engine error when response is not ok", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "RUNNING",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );

      const result = await svc.execute("user-1", "/stop Alpha");
      expect(result).toContain("could not be stopped");
      expect(result).toContain("engine error 500");

      vi.unstubAllGlobals();
    });

    it("treats 204 as success (not an error)", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "RUNNING",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 204 }),
      );

      const result = await svc.execute("user-1", "/stop Alpha");
      expect(result).toContain('Strategy "Alpha" stopped');

      vi.unstubAllGlobals();
    });

    it("returns unreachable message when fetch throws", async () => {
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
        status: "RUNNING",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      );

      const result = await svc.execute("user-1", "/stop Alpha");
      expect(result).toContain("Could not reach strategy engine");

      vi.unstubAllGlobals();
    });
  });

  // ─── /pnl ─────────────────────────────────────────────────────────────────

  describe("/pnl", () => {
    it("returns overall P&L with realized and paper amounts", async () => {
      prisma.position.aggregate.mockResolvedValue({
        _sum: { realizedPnl: 100.5 },
      });
      redis.get.mockResolvedValue("25.00");

      const result = await svc.execute("user-1", "/pnl");
      expect(result).toContain("Overall P&L");
      expect(result).toContain("+100.50");
      expect(result).toContain("+25.00");
    });

    it("shows negative prefix for negative P&L", async () => {
      prisma.position.aggregate.mockResolvedValue({
        _sum: { realizedPnl: -50 },
      });
      redis.get.mockResolvedValue("-10.00");

      const result = await svc.execute("user-1", "/pnl");
      expect(result).toContain("-50.00");
      expect(result).toContain("-10.00");
    });

    it("defaults to 0 when aggregate returns null", async () => {
      prisma.position.aggregate.mockResolvedValue({
        _sum: { realizedPnl: null },
      });
      redis.get.mockResolvedValue(null);

      const result = await svc.execute("user-1", "/pnl");
      expect(result).toContain("+0.00");
    });

    it("returns strategy-specific P&L when name is provided", async () => {
      prisma.position.aggregate.mockResolvedValue({
        _sum: { realizedPnl: 42 },
      });
      prisma.strategy.findFirst.mockResolvedValue({
        id: "strat-1",
        name: "Alpha",
      });

      const result = await svc.execute("user-1", "/pnl Alpha");
      expect(result).toContain('P&L for "Alpha"');
      expect(result).toContain("+42.00");
    });

    it("returns not found when strategy name does not match", async () => {
      prisma.position.aggregate.mockResolvedValue({
        _sum: { realizedPnl: 0 },
      });
      prisma.strategy.findFirst.mockResolvedValue(null);

      const result = await svc.execute("user-1", "/pnl NoSuch");
      expect(result).toContain('Strategy "NoSuch" not found');
    });
  });

  // ─── /orders ──────────────────────────────────────────────────────────────

  describe("/orders", () => {
    it("returns no orders message when empty", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const result = await svc.execute("user-1", "/orders");
      expect(result).toContain("No orders found");
    });

    it("lists recent orders with details", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          tokenId: "tok-1",
          side: "BUY",
          size: 10,
          fillPrice: 0.5,
          status: "FILLED",
          createdAt: new Date(),
        },
        {
          tokenId: "tok-2",
          side: "SELL",
          size: 5,
          fillPrice: 0.7,
          status: "FILLED",
          createdAt: new Date(),
        },
      ]);

      const result = await svc.execute("user-1", "/orders");
      expect(result).toContain("Last 2 orders");
      expect(result).toContain("BUY 10.00 @ 0.500 [FILLED]");
      expect(result).toContain("SELL 5.00 @ 0.700 [FILLED]");
    });

    it("handles null fillPrice gracefully", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          tokenId: "tok-1",
          side: "BUY",
          size: 10,
          fillPrice: null,
          status: "PENDING",
          createdAt: new Date(),
        },
      ]);

      const result = await svc.execute("user-1", "/orders");
      expect(result).toContain("0.000");
    });

    it("uses singular 'order' for a single result", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          tokenId: "tok-1",
          side: "BUY",
          size: 10,
          fillPrice: 0.5,
          status: "FILLED",
          createdAt: new Date(),
        },
      ]);

      const result = await svc.execute("user-1", "/orders");
      expect(result).toContain("Last 1 order:");
      expect(result).not.toContain("orders:");
    });
  });

  // ─── /positions ───────────────────────────────────────────────────────────

  describe("/positions", () => {
    it("returns no positions message when empty", async () => {
      prisma.position.findMany.mockResolvedValue([]);
      const result = await svc.execute("user-1", "/positions");
      expect(result).toContain("No open positions");
    });

    it("lists open positions with details", async () => {
      prisma.position.findMany.mockResolvedValue([
        {
          tokenId: "abcdef123456ghij",
          outcome: "YES",
          size: 20,
          avgPrice: 0.5,
          unrealizedPnl: 5.0,
        },
      ]);

      const result = await svc.execute("user-1", "/positions");
      expect(result).toContain("Open positions (1)");
      expect(result).toContain("abcdef123456");
      expect(result).toContain("YES");
      expect(result).toContain("20.00 @ 0.500");
      expect(result).toContain("+5.00");
    });

    it("shows negative prefix for negative unrealized P&L", async () => {
      prisma.position.findMany.mockResolvedValue([
        {
          tokenId: "abcdef123456ghij",
          outcome: "YES",
          size: 10,
          avgPrice: 0.5,
          unrealizedPnl: -3.5,
        },
      ]);

      const result = await svc.execute("user-1", "/positions");
      expect(result).toContain("-3.50");
    });
  });

  // ─── /paper ───────────────────────────────────────────────────────────────

  describe("/paper", () => {
    it("returns paper trading summary with defaults", async () => {
      redis.get.mockResolvedValue(null);
      prisma.paperPosition.count.mockResolvedValue(0);
      prisma.paperOrder.count.mockResolvedValue(0);

      const result = await svc.execute("user-1", "/paper");
      expect(result).toContain("Paper trading summary");
      expect(result).toContain("+0.00 USDC");
      expect(result).toContain("Orders:  0");
      expect(result).toContain("Positions: 0");
    });

    it("returns paper trading summary with actual data", async () => {
      redis.get.mockResolvedValue("123.45");
      prisma.paperPosition.count.mockResolvedValue(3);
      prisma.paperOrder.count.mockResolvedValue(15);

      const result = await svc.execute("user-1", "/paper");
      expect(result).toContain("+123.45 USDC");
      expect(result).toContain("Orders:  15");
      expect(result).toContain("Positions: 3");
    });

    it("shows negative paper P&L correctly", async () => {
      redis.get.mockResolvedValue("-50.00");
      prisma.paperPosition.count.mockResolvedValue(0);
      prisma.paperOrder.count.mockResolvedValue(0);

      const result = await svc.execute("user-1", "/paper");
      expect(result).toContain("-50.00 USDC");
    });
  });

  // ─── /alerts ──────────────────────────────────────────────────────────────

  describe("/alerts", () => {
    it("returns no alerts message when empty", async () => {
      prisma.priceAlert.findMany.mockResolvedValue([]);
      const result = await svc.execute("user-1", "/alerts");
      expect(result).toContain("No active price alerts");
    });

    it("lists active alerts with details", async () => {
      prisma.priceAlert.findMany.mockResolvedValue([
        { tokenId: "abcdef123456ghij", direction: "ABOVE", price: 0.75 },
        { tokenId: "xyz123456789abcd", direction: "BELOW", price: 0.25 },
      ]);

      const result = await svc.execute("user-1", "/alerts");
      expect(result).toContain("Active alerts (2)");
      expect(result).toContain("abcdef123456");
      expect(result).toContain("ABOVE 0.750");
      expect(result).toContain("BELOW 0.250");
    });
  });

  // ─── /disconnect (routed via execute) ─────────────────────────────────────

  describe("/disconnect", () => {
    it("routes /disconnect to return unknown command (handled by telegram/discord)", async () => {
      // /disconnect is not handled by CommandsService.execute — it's handled by the platform services
      const result = await svc.execute("user-1", "/disconnect");
      expect(result).toContain("Unknown command");
    });
  });
});
