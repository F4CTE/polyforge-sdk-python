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
});
