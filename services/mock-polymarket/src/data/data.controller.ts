import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { ScenarioService } from "../scenario/scenario.service";
import { TOKENS_BY_ID, MARKETS_BY_ID } from "../fixtures/markets";

@Controller()
export class DataController {
  constructor(private readonly scenario: ScenarioService) {}

  private async guard(reply: FastifyReply, ip: string): Promise<boolean> {
    if (this.scenario.shouldReturnDown()) {
      reply.status(503).send({ error: "Service Unavailable" });
      return false;
    }
    if (this.scenario.shouldRateLimit(ip)) {
      reply.status(429).send({ error: "Too Many Requests", retryAfter: 60 });
      return false;
    }
    await this.scenario.applyDelay();
    return true;
  }

  // GET /prices/history/:tokenId
  @Get("prices/history/:tokenId")
  async getPriceHistory(
    @Param("tokenId") tokenId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("interval") interval?: string, // 1m, 5m, 1h, 1d
    @Query("from") from?: string, // unix timestamp
    @Query("to") to?: string,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const tokenInfo = TOKENS_BY_ID.get(tokenId);
    if (!tokenInfo) return reply.status(404).send({ error: "Token not found" });

    const currentPrice = this.scenario.getPrice(tokenId);
    const history = this.generatePriceHistory(currentPrice, interval ?? "1h");

    reply.send({ tokenId, interval: interval ?? "1h", history });
  }

  // GET /prices/current
  @Get("prices/current")
  async getCurrentPrices(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("tokens") tokens?: string, // comma-separated tokenIds
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const tokenIds = tokens ? tokens.split(",") : [...TOKENS_BY_ID.keys()];
    const prices: Record<string, string> = {};

    for (const tokenId of tokenIds) {
      if (TOKENS_BY_ID.has(tokenId)) {
        prices[tokenId] = this.scenario.getPrice(tokenId).toFixed(4);
      }
    }

    reply.send({ prices, timestamp: Date.now() });
  }

  // GET /positions/:walletAddress
  @Get("positions/:walletAddress")
  async getPositions(
    @Param("walletAddress") walletAddress: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    // Return empty positions for all addresses (no real state in mock)
    reply.send({
      walletAddress,
      positions: [],
      updatedAt: new Date().toISOString(),
    });
  }

  // GET /markets/:marketId/trades
  @Get("markets/:marketId/trades")
  async getMarketTrades(
    @Param("marketId") marketId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("limit") limit?: string,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const market = MARKETS_BY_ID.get(marketId);
    if (!market) return reply.status(404).send({ error: "Market not found" });

    const lim = Math.min(parseInt(limit ?? "20", 10), 100);
    const trades = this.generateRecentTrades(market.tokens[0].tokenId, lim);

    reply.send({ marketId, trades });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private generatePriceHistory(
    currentPrice: number,
    interval: string,
  ): Array<{ t: number; p: string }> {
    const now = Date.now();
    const points = 50;
    let intervalMs: number;

    switch (interval) {
      case "1m":
        intervalMs = 60_000;
        break;
      case "5m":
        intervalMs = 300_000;
        break;
      case "1d":
        intervalMs = 86_400_000;
        break;
      default:
        intervalMs = 3_600_000;
        break; // 1h
    }

    const result: Array<{ t: number; p: string }> = [];
    let price = currentPrice;

    for (let i = points; i >= 0; i--) {
      result.push({ t: now - i * intervalMs, p: price.toFixed(4) });
      // Random walk backwards in time
      price = Math.max(
        0.02,
        Math.min(0.98, price + (Math.random() - 0.5) * 0.01),
      );
    }

    return result;
  }

  private generateRecentTrades(
    tokenId: string,
    count: number,
  ): Array<{
    price: string;
    size: string;
    side: "buy" | "sell";
    timestamp: number;
  }> {
    const now = Date.now();
    const currentPrice = this.scenario.getPrice(tokenId);

    return Array.from({ length: count }, (_, i) => ({
      price: Math.max(
        0.01,
        currentPrice + (Math.random() - 0.5) * 0.04,
      ).toFixed(2),
      size: (50 + Math.random() * 450).toFixed(0),
      side: Math.random() > 0.5 ? "buy" : "sell",
      timestamp: now - i * 45_000,
    }));
  }
}
