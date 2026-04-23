/**
 * Integration tests against the Kalshi demo sandbox (demo-api.kalshi.co).
 * Skipped unless KALSHI_TEST_API_KEY and KALSHI_TEST_KEY_ID are set.
 *
 * To run locally:
 *   KALSHI_TEST_API_KEY=<pem> KALSHI_TEST_KEY_ID=<kid> pnpm test --filter=order-service kalshi-rest.service.integration
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";

const KALSHI_TEST_API_KEY = process.env["KALSHI_TEST_API_KEY"];
const KALSHI_TEST_KEY_ID = process.env["KALSHI_TEST_KEY_ID"];
const SANDBOX_URL = "https://demo-api.kalshi.co/trade-api/v2";

const runIntegration =
  KALSHI_TEST_API_KEY && KALSHI_TEST_KEY_ID ? describe : describe.skip;

runIntegration("KalshiRestService (sandbox integration)", () => {
  let rest: KalshiRestService;

  beforeAll(() => {
    const jwt: JwtService = {
      sign: vi.fn().mockReturnValue("mock-svc-jwt"),
    } as any;

    const config: ConfigService = {
      get: (k: string, d?: string) => {
        const map: Record<string, string> = {
          SIGNER_SERVICE_URL: "http://signer:3012",
          KALSHI_BASE_URL: SANDBOX_URL,
        };
        return map[k] ?? d ?? "";
      },
      getOrThrow: (k: string) => {
        const map: Record<string, string> = {
          KALSHI_BASE_URL: SANDBOX_URL,
        };
        if (!(k in map)) throw new Error(`Missing ${k}`);
        return map[k];
      },
    } as any;

    const auth = new KalshiAuthService(jwt, config);

    // Build a real JWT directly using the test private key PEM
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 1800;
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: KALSHI_TEST_KEY_ID }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: KALSHI_TEST_KEY_ID, iat: now, exp }),
    ).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const signature = crypto
      .sign("sha256", Buffer.from(signingInput), {
        key: KALSHI_TEST_API_KEY!,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      })
      .toString("base64url");
    const token = `${signingInput}.${signature}`;

    (auth as any).cache = { token, expiresAt: exp };

    rest = new KalshiRestService(auth, config);
  });

  it("lists active markets from demo sandbox", async () => {
    const markets = await rest.getMarkets({ limit: 5, status: "open" });
    expect(Array.isArray(markets)).toBe(true);
  });

  it("fetches a specific market by ticker", async () => {
    const markets = await rest.getMarkets({ limit: 1, status: "open" });
    if (!markets.length) return; // no open markets in sandbox

    const ticker = markets[0].ticker;
    const market = await rest.getMarket(ticker);
    expect(market.ticker).toBe(ticker);
  });

  it("fetches orderbook for a market", async () => {
    const markets = await rest.getMarkets({ limit: 1, status: "open" });
    if (!markets.length) return;

    const ticker = markets[0].ticker;
    const book = await rest.getOrderBook(ticker);
    expect(Array.isArray(book.yes)).toBe(true);
    expect(Array.isArray(book.no)).toBe(true);
  });

  it("fetches portfolio positions (may be empty)", async () => {
    const positions = await rest.getPositions("integration-test");
    expect(Array.isArray(positions)).toBe(true);
  });

  it("fetches order history (may be empty)", async () => {
    const orders = await rest.getOrders("integration-test", 10);
    expect(Array.isArray(orders)).toBe(true);
  });

  it("fetches balance successfully", async () => {
    const result = await rest.getBalance();
    expect(typeof result.balance).toBe("number");
  });

  it("validates market shape from sandbox", async () => {
    const markets = await rest.getMarkets({ limit: 3, status: "open" });
    if (!markets.length) return;

    const m = markets[0];
    expect(typeof m.ticker).toBe("string");
    expect(m.ticker.length).toBeGreaterThan(0);
    expect(typeof m.status).toBe("string");
  });

  it("fetches markets with pagination offset", async () => {
    const page1 = await rest.getMarkets({ limit: 2, status: "open" });
    if (page1.length < 2) return;

    const page2 = await rest.getMarkets({
      limit: 2,
      offset: 2,
      status: "open",
    });
    expect(Array.isArray(page2)).toBe(true);
    if (page2.length > 0) {
      expect(page2[0].ticker).not.toBe(page1[0].ticker);
    }
  });

  it("orderbook contains price and quantity fields", async () => {
    const markets = await rest.getMarkets({ limit: 1, status: "open" });
    if (!markets.length) return;

    const book = await rest.getOrderBook(markets[0].ticker);
    for (const entry of book.yes) {
      expect(typeof entry.price).toBe("number");
      expect(typeof entry.quantity).toBe("number");
      expect(entry.price).toBeGreaterThanOrEqual(1);
      expect(entry.price).toBeLessThanOrEqual(99);
    }
    for (const entry of book.no) {
      expect(typeof entry.price).toBe("number");
      expect(entry.price).toBeGreaterThanOrEqual(1);
      expect(entry.price).toBeLessThanOrEqual(99);
    }
  });

  // ── Phase 2: Events API ────────────────────────────────────────────────

  describe("Events API", () => {
    it("lists events with cursor pagination", async () => {
      const result = await rest.getEvents({ limit: 5 });
      expect(Array.isArray(result.events)).toBe(true);
      expect(typeof result.cursor).toBe("string");
    });

    it("filters events by status", async () => {
      const result = await rest.getEvents({ limit: 3, status: "open" });
      expect(Array.isArray(result.events)).toBe(true);
    });

    it("fetches a single event by ticker", async () => {
      const list = await rest.getEvents({ limit: 1, status: "open" });
      if (!list.events.length) return;

      const ticker = list.events[0].event_ticker;
      const result = await rest.getEvent(ticker);
      expect(result.event.event_ticker).toBe(ticker);
      expect(typeof result.event.title).toBe("string");
    });

    it("fetches event with nested markets", async () => {
      const list = await rest.getEvents({ limit: 1, status: "open" });
      if (!list.events.length) return;

      const result = await rest.getEvent(list.events[0].event_ticker, true);
      expect(result.event.event_ticker).toBeTruthy();
    });

    it("fetches event metadata", async () => {
      const list = await rest.getEvents({ limit: 1, status: "open" });
      if (!list.events.length) return;

      const meta = await rest.getEventMetadata(list.events[0].event_ticker);
      expect(typeof meta.image_url).toBe("string");
      expect(Array.isArray(meta.market_details)).toBe(true);
      expect(Array.isArray(meta.settlement_sources)).toBe(true);
    });
  });

  // ── Phase 2: Portfolio fills & settlements ─────────────────────────────

  describe("Fills and Settlements", () => {
    it("lists fills (may be empty)", async () => {
      const result = await rest.getFills({ limit: 5 });
      expect(Array.isArray(result.fills)).toBe(true);
      expect(typeof result.cursor).toBe("string");
    });

    it("lists settlements (may be empty)", async () => {
      const result = await rest.getSettlements({ limit: 5 });
      expect(Array.isArray(result.settlements)).toBe(true);
      expect(typeof result.cursor).toBe("string");
    });
  });

  // ── Phase 2: Exchange status ───────────────────────────────────────────

  describe("Exchange status", () => {
    it("returns exchange status", async () => {
      const status = await rest.getExchangeStatus();
      expect(typeof status.exchange_active).toBe("boolean");
      expect(typeof status.trading_active).toBe("boolean");
    });

    it("returns exchange schedule", async () => {
      const schedule = await rest.getExchangeSchedule();
      expect(Array.isArray(schedule.standard_hours)).toBe(true);
      expect(Array.isArray(schedule.maintenance_windows)).toBe(true);
    });
  });

  // ── Phase 2: Market trades ─────────────────────────────────────────────

  describe("Market trades", () => {
    it("lists recent trades", async () => {
      const result = await rest.getTrades({ limit: 10 });
      expect(Array.isArray(result.trades)).toBe(true);
      expect(typeof result.cursor).toBe("string");
    });

    it("filters trades by market ticker", async () => {
      const markets = await rest.getMarkets({ limit: 1, status: "open" });
      if (!markets.length) return;

      const result = await rest.getTrades({
        ticker: markets[0].ticker,
        limit: 5,
      });
      expect(Array.isArray(result.trades)).toBe(true);
      for (const t of result.trades) {
        expect(t.ticker).toBe(markets[0].ticker);
      }
    });

    it("validates trade shape", async () => {
      const result = await rest.getTrades({ limit: 3 });
      for (const t of result.trades) {
        expect(typeof t.trade_id).toBe("string");
        expect(typeof t.ticker).toBe("string");
        expect(typeof t.count).toBe("number");
        expect(typeof t.yes_price).toBe("number");
        expect(typeof t.no_price).toBe("number");
        expect(["yes", "no"]).toContain(t.taker_side);
      }
    });
  });

  // ── Phase 2: Multiple orderbooks ───────────────────────────────────────

  describe("Multiple orderbooks", () => {
    it("fetches multiple orderbooks in parallel", async () => {
      const markets = await rest.getMarkets({ limit: 3, status: "open" });
      if (markets.length < 2) return;

      const tickers = markets.map((m) => m.ticker);
      const books = await rest.getOrderBooks(tickers);
      expect(books.size).toBeGreaterThan(0);
      expect(books.size).toBeLessThanOrEqual(tickers.length);
      for (const [, book] of books) {
        expect(Array.isArray(book.yes)).toBe(true);
        expect(Array.isArray(book.no)).toBe(true);
      }
    });
  });

  // ── Phase 1 (existing): order lifecycle ────────────────────────────────

  describe("order lifecycle", () => {
    it("places a limit order, verifies it, then cancels it", async () => {
      const markets = await rest.getMarkets({ limit: 5, status: "open" });
      const market = markets.find((m) => m.yes_bid && m.yes_bid > 0);
      if (!market) return; // no liquid market in sandbox

      const result = await rest.placeOrder({
        ticker: market.ticker,
        side: "yes",
        action: "buy",
        count: 1,
        type: "limit",
        yes_price: 1,
      });

      expect(result.order_id).toBeTruthy();
      expect(typeof result.order_id).toBe("string");

      const orders = await rest.getOrders("integration-test", 10);
      const placed = orders.find((o) => o.order_id === result.order_id);
      if (placed) {
        expect(placed.ticker).toBe(market.ticker);
      }

      await rest.cancelOrder(result.order_id);

      const afterCancel = await rest.getOrders("integration-test", 10);
      const cancelled = afterCancel.find((o) => o.order_id === result.order_id);
      if (cancelled) {
        expect(cancelled.status).not.toBe("resting");
      }
    });
  });
});
