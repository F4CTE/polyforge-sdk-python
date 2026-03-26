/**
 * Simple token-bucket rate limiter for outbound Polymarket API calls.
 *
 * Polymarket limits (from docs.polymarket.com):
 * - CLOB general: 9,000 req / 10s (900/s)
 * - CLOB /book, /price, /midpoint: 1,500 req / 10s (150/s)
 * - Gamma general: 4,000 req / 10s (400/s)
 * - Gamma /markets: 300 req / 10s (30/s)
 * - Data general: 1,000 req / 10s (100/s)
 * - Relayer /submit: 25 req / 1min
 *
 * We use the per-endpoint limits (not general) at 50% to leave headroom.
 */
export class OutboundRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  /**
   * @param maxPerSecond Maximum requests per second
   */
  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /** Returns true if the request can proceed, false if rate limited */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Waits until a token is available */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}

/** Pre-configured limiters at 50% of Polymarket's per-endpoint limits */
export const CLOB_LIMITER = new OutboundRateLimiter(75);     // 50% of /book 150/s
export const GAMMA_LIMITER = new OutboundRateLimiter(15);    // 50% of /markets 30/s
export const DATA_LIMITER = new OutboundRateLimiter(10);     // 50% of /trades 20/s
export const RELAYER_LIMITER = new OutboundRateLimiter(0.4); // ~25/min
