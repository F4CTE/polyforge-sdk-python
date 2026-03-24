/**
 * Simple token-bucket rate limiter for outbound Polymarket API calls.
 *
 * Polymarket limits:
 * - CLOB: 15,000 req / 10s (1,500/s)
 * - Gamma: 4,000 req / 10s (400/s)
 * - Data: 1,000 req / 10s (100/s)
 * - Relayer: 25 req / 1min
 *
 * We use conservative limits (50% of max) to leave headroom.
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

/** Pre-configured limiters at 50% of Polymarket's limits */
export const CLOB_LIMITER = new OutboundRateLimiter(750);   // 50% of 1500/s
export const GAMMA_LIMITER = new OutboundRateLimiter(200);   // 50% of 400/s
export const DATA_LIMITER = new OutboundRateLimiter(50);     // 50% of 100/s
export const RELAYER_LIMITER = new OutboundRateLimiter(0.4); // ~25/min
