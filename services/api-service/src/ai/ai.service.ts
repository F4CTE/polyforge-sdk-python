import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { StrategyStatus } from ".prisma/client";
import { LlmService } from "../news/llm.service";

export interface QueryResult {
  query: string;
  intent: string;
  filters: Record<string, unknown>;
  data: unknown;
  summary: string;
}

interface QueryPattern {
  pattern: RegExp;
  intent: string;
  action: (userId: string, match: RegExpMatchArray) => Promise<{ data: unknown; summary: string; filters?: Record<string, unknown> }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly patterns: QueryPattern[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {
    this.patterns = [
      {
        pattern: /running|active/i,
        intent: "list_strategies",
        action: async (userId) => {
          const strategies = await this.prisma.strategy.findMany({
            where: { userId, status: StrategyStatus.RUNNING },
            select: { id: true, name: true, status: true, createdAt: true },
          });
          const names = strategies.map((s) => s.name).join(", ");
          return {
            data: strategies,
            summary: strategies.length === 0
              ? "You have no running strategies."
              : `You have ${strategies.length} running ${strategies.length === 1 ? "strategy" : "strategies"}: ${names}`,
            filters: { status: "RUNNING" },
          };
        },
      },
      {
        pattern: /my.*strateg/i,
        intent: "list_strategies",
        action: async (userId) => {
          const strategies = await this.prisma.strategy.findMany({
            where: { userId, status: { not: StrategyStatus.ARCHIVED } },
            select: { id: true, name: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          });
          return {
            data: strategies,
            summary: strategies.length === 0
              ? "You have no strategies yet."
              : `You have ${strategies.length} ${strategies.length === 1 ? "strategy" : "strategies"}. Latest: ${strategies[0].name} (${strategies[0].status})`,
          };
        },
      },
      {
        pattern: /portfolio|positions|pnl/i,
        intent: "get_portfolio",
        action: async (userId) => {
          const positions = await this.prisma.position.findMany({
            where: { userId },
            select: { id: true, tokenId: true, outcome: true, size: true, avgPrice: true, currentPrice: true, unrealizedPnl: true, realizedPnl: true },
          });
          const totalUnrealized = positions.reduce((sum, p) => sum + Number(p.unrealizedPnl), 0);
          const totalRealized = positions.reduce((sum, p) => sum + Number(p.realizedPnl), 0);
          return {
            data: positions,
            summary: positions.length === 0
              ? "Your portfolio is empty."
              : `You have ${positions.length} open ${positions.length === 1 ? "position" : "positions"}. Unrealized P&L: $${totalUnrealized.toFixed(2)}, Realized P&L: $${totalRealized.toFixed(2)}`,
          };
        },
      },
      {
        pattern: /orders?|trades?/i,
        intent: "list_orders",
        action: async (userId) => {
          const orders = await this.prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, side: true, outcome: true, size: true, price: true, status: true, createdAt: true },
          });
          return {
            data: orders,
            summary: orders.length === 0
              ? "You have no recent orders."
              : `Found ${orders.length} recent orders. Latest: ${orders[0].side} ${orders[0].outcome} at $${orders[0].price} (${orders[0].status})`,
          };
        },
      },
      {
        pattern: /whale/i,
        intent: "get_whale_feed",
        action: async () => {
          const alerts = await this.prisma.whaleAlert.findMany({
            orderBy: { detectedAt: "desc" },
            take: 10,
            select: { id: true, walletAddress: true, side: true, outcome: true, size: true, notional: true, detectedAt: true },
          });
          return {
            data: alerts,
            summary: alerts.length === 0
              ? "No recent whale activity."
              : `${alerts.length} recent whale trades. Biggest: $${Math.max(...alerts.map((a) => Number(a.notional))).toFixed(2)}`,
          };
        },
      },
      {
        pattern: /news|signal/i,
        intent: "get_news_signals",
        action: async () => {
          const signals = await this.prisma.newsSignal.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, direction: true, outcome: true, confidence: true, reasoning: true, createdAt: true },
          });
          return {
            data: signals,
            summary: signals.length === 0
              ? "No recent news signals."
              : `${signals.length} recent AI signals. Highest confidence: ${Math.max(...signals.map((s) => s.confidence))}%`,
          };
        },
      },
      {
        pattern: /score|rank|badge/i,
        intent: "get_score",
        action: async (userId) => {
          const score = await this.prisma.traderScore.findUnique({
            where: { userId },
          });
          const badges = await this.prisma.traderBadge.findMany({
            where: { userId },
            select: { name: true, type: true, earnedAt: true },
          });
          return {
            data: { score, badges },
            summary: !score
              ? "You don't have a trader score yet."
              : `Your score: ${score.score}/100, Win rate: ${score.winRate}%, Badges: ${badges.length === 0 ? "none" : badges.map((b) => b.name).join(", ")}`,
          };
        },
      },
      {
        pattern: /alert/i,
        intent: "list_alerts",
        action: async (userId) => {
          const alerts = await this.prisma.priceAlert.findMany({
            where: { userId, triggered: false },
            select: { id: true, tokenId: true, direction: true, price: true, createdAt: true },
          });
          return {
            data: alerts,
            summary: alerts.length === 0
              ? "You have no active price alerts."
              : `You have ${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"}.`,
          };
        },
      },
      {
        pattern: /copy|mirror/i,
        intent: "list_copy_configs",
        action: async (userId) => {
          const configs = await this.prisma.copyConfig.findMany({
            where: { userId },
            select: { id: true, targetWallet: true, mode: true, status: true, totalPnl: true, totalCopied: true },
          });
          return {
            data: configs,
            summary: configs.length === 0
              ? "You have no copy trading configurations."
              : `You have ${configs.length} copy config${configs.length === 1 ? "" : "s"}. Total trades copied: ${configs.reduce((s, c) => s + c.totalCopied, 0)}`,
          };
        },
      },
      {
        pattern: /market.*(\w+)/i,
        intent: "search_markets",
        action: async (_userId, match) => {
          const term = match[1] ?? "";
          const markets = await this.prisma.market.findMany({
            where: {
              closed: false,
              OR: [
                { title: { contains: term, mode: "insensitive" } },
                { category: { contains: term, mode: "insensitive" } },
              ],
            },
            take: 10,
            select: { id: true, title: true, category: true, volume24h: true },
          });
          return {
            data: markets,
            summary: markets.length === 0
              ? `No open markets found matching "${term}".`
              : `Found ${markets.length} markets matching "${term}".`,
            filters: { search: term },
          };
        },
      },
    ];
  }

  async query(userId: string, queryText: string): Promise<QueryResult> {
    for (const { pattern, intent, action } of this.patterns) {
      const match = queryText.match(pattern);
      if (match) {
        try {
          const result = await action(userId, match);
          return {
            query: queryText,
            intent,
            filters: result.filters ?? {},
            data: result.data,
            summary: result.summary,
          };
        } catch (err: any) {
          this.logger.error(`AI query handler failed for intent ${intent}: ${err?.message}`);
          return {
            query: queryText,
            intent,
            filters: {},
            data: null,
            summary: process.env.NODE_ENV === 'production'
              ? 'Sorry, I encountered an error processing your request. Please try again.'
              : `Sorry, I encountered an error processing your request: ${err?.message}`,
          };
        }
      }
    }

    return {
      query: queryText,
      intent: "unknown",
      filters: {},
      data: null,
      summary:
        "I didn't understand that query. Try asking about: strategies, portfolio, orders, whale trades, news signals, scores, alerts, copy trading, or markets.",
    };
  }

  async portfolioReview(userId: string): Promise<any> {
    const [positions, orders] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId, resolutionStatus: 'UNRESOLVED' as any },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { side: true, outcome: true, price: true, status: true, marketId: true },
      }),
    ]);

    const totalUnrealized = positions.reduce((s, p) => s + parseFloat(String(p.unrealizedPnl ?? 0)), 0);
    const totalRealized = positions.reduce((s, p) => s + parseFloat(String(p.realizedPnl ?? 0)), 0);

    const positionSummary = positions.slice(0, 10).map((p) =>
      `${p.outcome} in market ${p.marketId}: size=${p.size}, avgPrice=${p.avgPrice}, unrealizedPnl=${p.unrealizedPnl}`,
    ).join('\n');

    const orderSummary = orders.map((o) =>
      `${o.side} ${o.outcome ?? ''} at $${o.price} (${o.status})`,
    ).join(', ');

    const prompt = `You are a prediction market portfolio advisor. Analyze this trader's portfolio and provide concise, actionable insights.

Portfolio:
- Open positions: ${positions.length}
- Unrealized P&L: $${totalUnrealized.toFixed(2)}
- Realized P&L: $${totalRealized.toFixed(2)}
- Recent orders: ${orderSummary || 'none'}

Positions:
${positionSummary || 'No open positions'}

Return ONLY a JSON object with this structure (no markdown, no explanation):
{"summary":"2-3 sentence overview","riskLevel":"low|medium|high","suggestions":[{"type":"rebalance|hedge|reduce|opportunity","priority":"high|medium|low","description":"actionable suggestion"}]}`;

    let parsed: any = null;
    try {
      const raw = await this.llm.analyze(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      // fall through to fallback
    }

    return {
      summary: parsed?.summary ?? `You have ${positions.length} open positions. Unrealized P&L: $${totalUnrealized.toFixed(2)}.`,
      riskLevel: parsed?.riskLevel ?? (positions.length > 5 ? 'high' : positions.length > 2 ? 'medium' : 'low'),
      suggestions: parsed?.suggestions ?? [],
      generatedAt: new Date().toISOString(),
    };
  }
}
