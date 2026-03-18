import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { FIXTURE_MARKETS, MockMarket, TOKENS_BY_ID } from "../fixtures/markets";

export type Scenario =
  | "normal"
  | "volatile"
  | "api_down"
  | "rate_limited"
  | "slow";

interface LivePrice {
  price: number; // 0-1
  trend: number; // -1, 0, 1
}

/**
 * Manages scenario behaviour and live price simulation.
 */
@Injectable()
export class ScenarioService implements OnModuleInit {
  private readonly logger = new Logger(ScenarioService.name);
  readonly scenario: Scenario;

  /** Live mid prices tracked per tokenId */
  private readonly prices = new Map<string, LivePrice>();

  /** Per-IP request counters for rate_limited scenario */
  private readonly ipCounters = new Map<string, number>();

  constructor() {
    const raw = (process.env.SCENARIO ?? "normal").toLowerCase() as Scenario;
    const valid: Scenario[] = [
      "normal",
      "volatile",
      "api_down",
      "rate_limited",
      "slow",
    ];
    this.scenario = valid.includes(raw) ? raw : "normal";
  }

  onModuleInit() {
    // Seed initial prices from fixtures
    for (const market of FIXTURE_MARKETS) {
      for (const token of market.tokens) {
        this.prices.set(token.tokenId, {
          price: parseFloat(token.price),
          trend: 0,
        });
      }
    }

    this.logger.log(`mock-polymarket running in scenario: ${this.scenario}`);

    if (this.scenario !== "api_down") {
      this.startPriceSimulation();
    }
  }

  // ─── Middleware helpers ───────────────────────────────────────────────────

  /** Returns true if this request should receive a 503 */
  shouldReturnDown(): boolean {
    return this.scenario === "api_down" && Math.random() < 0.8;
  }

  /** Returns true if this request should receive a 429 */
  shouldRateLimit(ip: string): boolean {
    if (this.scenario !== "rate_limited") return false;
    const count = (this.ipCounters.get(ip) ?? 0) + 1;
    this.ipCounters.set(ip, count);
    // Reset every minute
    setTimeout(() => {
      const c = (this.ipCounters.get(ip) ?? 1) - 1;
      if (c <= 0) this.ipCounters.delete(ip);
      else this.ipCounters.set(ip, c);
    }, 60_000);
    return count > 10;
  }

  /** Returns a delay in ms based on the scenario */
  delayMs(): number {
    if (this.scenario === "slow") return 2000 + Math.random() * 3000;
    if (this.scenario === "volatile") return 50;
    return 0;
  }

  /** Simulated fill delay */
  fillDelayMs(): number {
    if (this.scenario === "volatile") return 100;
    if (this.scenario === "slow") return 5000;
    return 1500 + Math.random() * 1000;
  }

  // ─── Price access ─────────────────────────────────────────────────────────

  getPrice(tokenId: string): number {
    return this.prices.get(tokenId)?.price ?? 0.5;
  }

  getAllPrices(): Map<string, number> {
    const out = new Map<string, number>();
    this.prices.forEach((v, k) => out.set(k, v.price));
    return out;
  }

  getOrderBook(tokenId: string): {
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
  } {
    const mid = this.getPrice(tokenId);
    const spread = this.scenario === "volatile" ? 0.04 : 0.02;
    const half = spread / 2;

    const bids = Array.from({ length: 3 }, (_, i) => ({
      price: Math.max(0.01, mid - half - i * 0.01).toFixed(2),
      size: (300 + Math.random() * 400).toFixed(0),
    }));
    const asks = Array.from({ length: 3 }, (_, i) => ({
      price: Math.min(0.99, mid + half + i * 0.01).toFixed(2),
      size: (300 + Math.random() * 400).toFixed(0),
    }));

    return { bids, asks };
  }

  // ─── Price simulation ─────────────────────────────────────────────────────

  private startPriceSimulation() {
    const intervalMs = this.scenario === "volatile" ? 500 : 2000;

    setInterval(() => {
      this.prices.forEach((live, tokenId) => {
        const token = TOKENS_BY_ID.get(tokenId);
        if (!token) return;

        // YES and NO prices must sum to 1
        if (token.outcome === "NO") return; // derived from YES

        const volatility = this.scenario === "volatile" ? 0.04 : 0.008;
        const drift = (Math.random() - 0.5) * volatility;
        const newPrice = Math.max(0.02, Math.min(0.98, live.price + drift));

        this.prices.set(tokenId, {
          price: newPrice,
          trend: drift > 0 ? 1 : drift < 0 ? -1 : 0,
        });

        // Update complementary NO token
        const noTokenId = tokenId.replace("-yes", "-no");
        if (this.prices.has(noTokenId)) {
          this.prices.set(noTokenId, {
            price: 1 - newPrice,
            trend: -live.trend as -1 | 0 | 1,
          });
        }
      });
    }, intervalMs);
  }

  /** Apply scenario delay — call with await */
  async applyDelay(): Promise<void> {
    const ms = this.delayMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
}
