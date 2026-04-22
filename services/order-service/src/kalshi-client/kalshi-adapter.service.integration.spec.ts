/**
 * Integration tests for the KalshiAdapterService against the Kalshi demo sandbox.
 * Tests the VenueAdapter contract — ensures the adapter correctly maps Kalshi
 * REST responses to the unified PolyForge interfaces.
 *
 * Skipped unless KALSHI_TEST_API_KEY and KALSHI_TEST_KEY_ID are set.
 *
 * To run locally:
 *   KALSHI_TEST_API_KEY=<pem> KALSHI_TEST_KEY_ID=<kid> pnpm test --filter=order-service kalshi-adapter.service.integration
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";
import { KalshiAdapterService } from "./kalshi-adapter.service";
import type {
  VenueAdapter,
  UnifiedMarket,
  VenueOrderRequest,
} from "@polyforge/shared-types";

const KALSHI_TEST_API_KEY = process.env["KALSHI_TEST_API_KEY"];
const KALSHI_TEST_KEY_ID = process.env["KALSHI_TEST_KEY_ID"];
const SANDBOX_URL = "https://demo-api.kalshi.co/trade-api/v2";

const runIntegration =
  KALSHI_TEST_API_KEY && KALSHI_TEST_KEY_ID ? describe : describe.skip;

function buildSandboxAdapter(): KalshiAdapterService {
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
      const map: Record<string, string> = { KALSHI_BASE_URL: SANDBOX_URL };
      if (!(k in map)) throw new Error(`Missing ${k}`);
      return map[k];
    },
  } as any;

  const auth = new KalshiAuthService(jwt, config);

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

  const rest = new KalshiRestService(auth, config);
  return new KalshiAdapterService(rest);
}

runIntegration("KalshiAdapterService (sandbox integration)", () => {
  let adapter: KalshiAdapterService;
  let sampleMarket: UnifiedMarket | null;

  beforeAll(async () => {
    adapter = buildSandboxAdapter();
    const markets = await adapter.getMarkets({ limit: 5 });
    sampleMarket = markets.length > 0 ? markets[0] : null;
  });

  describe("VenueAdapter identity", () => {
    it("has venueId = 'kalshi'", () => {
      expect(adapter.venueId).toBe("kalshi");
    });

    it("satisfies the VenueAdapter interface shape", () => {
      const va: VenueAdapter = adapter;
      expect(typeof va.getMarkets).toBe("function");
      expect(typeof va.getOrderBook).toBe("function");
      expect(typeof va.getPrice).toBe("function");
      expect(typeof va.getPriceHistory).toBe("function");
      expect(typeof va.submitOrder).toBe("function");
      expect(typeof va.cancelOrder).toBe("function");
      expect(typeof va.cancelAllOrders).toBe("function");
      expect(typeof va.getPositions).toBe("function");
      expect(typeof va.getOrderHistory).toBe("function");
      expect(typeof va.healthCheck).toBe("function");
    });
  });

  describe("getMarkets()", () => {
    it("returns UnifiedMarket[] with correct shape", async () => {
      const markets = await adapter.getMarkets({ limit: 3 });
      expect(Array.isArray(markets)).toBe(true);

      for (const m of markets) {
        expect(m.venueId).toBe("kalshi");
        expect(typeof m.externalId).toBe("string");
        expect(m.externalId.length).toBeGreaterThan(0);
        expect(typeof m.title).toBe("string");
        expect(typeof m.closed).toBe("boolean");
        expect(Array.isArray(m.outcomes)).toBe(true);
        expect(m.outcomes).toEqual(["yes", "no"]);
      }
    });

    it("respects limit parameter", async () => {
      const markets = await adapter.getMarkets({ limit: 2 });
      expect(markets.length).toBeLessThanOrEqual(2);
    });

    it("filters by active=false for finalized markets", async () => {
      const markets = await adapter.getMarkets({ limit: 3, active: false });
      expect(Array.isArray(markets)).toBe(true);
      for (const m of markets) {
        expect(m.closed).toBe(true);
      }
    });
  });

  describe("getOrderBook()", () => {
    it("returns OrderBook with normalized prices (0–1 range)", async () => {
      if (!sampleMarket) return;

      const book = await adapter.getOrderBook(sampleMarket.externalId);
      expect(book.tokenId).toBe(sampleMarket.externalId);
      expect(Array.isArray(book.bids)).toBe(true);
      expect(Array.isArray(book.asks)).toBe(true);

      for (const bid of book.bids) {
        const price = parseFloat(bid.price);
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(1);
        expect(typeof bid.size).toBe("string");
      }

      for (const ask of book.asks) {
        const price = parseFloat(ask.price);
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(1);
      }
    });

    it("includes updatedAt timestamp", async () => {
      if (!sampleMarket) return;

      const book = await adapter.getOrderBook(sampleMarket.externalId);
      expect(typeof book.updatedAt).toBe("number");
      expect(book.updatedAt).toBeGreaterThan(0);
    });
  });

  describe("getPrice()", () => {
    it("returns normalized price as string in 0–1 range", async () => {
      if (!sampleMarket) return;

      const price = await adapter.getPrice(sampleMarket.externalId);
      expect(typeof price).toBe("string");
      const numericPrice = parseFloat(price);
      expect(numericPrice).toBeGreaterThanOrEqual(0);
      expect(numericPrice).toBeLessThanOrEqual(1);
    });
  });

  describe("getPriceHistory()", () => {
    it("returns empty array (not supported in Phase 2)", async () => {
      if (!sampleMarket) return;

      const candles = await adapter.getPriceHistory(
        sampleMarket.externalId,
        "1h",
      );
      expect(candles).toEqual([]);
    });
  });

  describe("getPositions()", () => {
    it("returns VenuePosition[] with correct shape", async () => {
      const positions = await adapter.getPositions("integration-test");
      expect(Array.isArray(positions)).toBe(true);

      for (const p of positions) {
        expect(p.venueId).toBe("kalshi");
        expect(typeof p.venueMarketId).toBe("string");
        expect(typeof p.venueOutcomeId).toBe("string");
        expect(p.outcome).toBe("yes");
        expect(typeof p.size).toBe("string");
        expect(typeof p.avgPrice).toBe("string");
        expect(typeof p.currentPrice).toBe("string");
        expect(typeof p.unrealizedPnl).toBe("string");
      }
    });
  });

  describe("getOrderHistory()", () => {
    it("returns VenueOrderHistory[] with correct shape", async () => {
      const history = await adapter.getOrderHistory("integration-test", 10);
      expect(Array.isArray(history)).toBe(true);

      for (const h of history) {
        expect(typeof h.venueOrderId).toBe("string");
        expect(typeof h.venueMarketId).toBe("string");
        expect(["BUY", "SELL"]).toContain(h.side);
        expect(typeof h.size).toBe("string");
        expect(typeof h.price).toBe("string");
        const price = parseFloat(h.price);
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(1);
        expect(typeof h.status).toBe("string");
      }
    });
  });

  describe("healthCheck()", () => {
    it("returns true when sandbox is reachable", async () => {
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe("order lifecycle (VenueAdapter interface)", () => {
    it("submits an order, then cancels it through the adapter", async () => {
      if (!sampleMarket) return;

      const order: VenueOrderRequest = {
        venueMarketId: sampleMarket.externalId,
        venueOutcomeId: sampleMarket.externalId,
        side: "BUY",
        size: "1",
        price: "0.01",
        orderType: "GTC",
        authContext: { userId: "integration-test" },
      };

      const result = await adapter.submitOrder(order);
      expect(result.venueOrderId).toBeTruthy();
      expect(typeof result.venueOrderId).toBe("string");
      expect(typeof result.status).toBe("string");

      await adapter.cancelOrder(result.venueOrderId, {
        userId: "integration-test",
      });

      const history = await adapter.getOrderHistory("integration-test", 20);
      const found = history.find((h) => h.venueOrderId === result.venueOrderId);
      if (found) {
        expect(found.status).not.toBe("resting");
      }
    });
  });
});
