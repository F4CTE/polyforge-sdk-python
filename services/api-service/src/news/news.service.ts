import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma, NewsSentiment } from "@prisma/client";
import { NewsArticleQueryDto, NewsSignalQueryDto } from "./dto/news-query.dto";

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Articles ─────────────────────────────────────────────────────────────

  async getArticles(query: NewsArticleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NewsArticleWhereInput = {};

    if (query.source) {
      where.source = query.source;
    }
    if (query.sentiment) {
      where.sentiment = query.sentiment as NewsSentiment;
    }

    const [data, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: {
          signals: {
            include: {
              market: {
                select: { id: true, title: true, slug: true },
              },
            },
            orderBy: { confidence: "desc" },
          },
        },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Article Detail ───────────────────────────────────────────────────────

  async getArticleById(id: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id },
      include: {
        signals: {
          include: {
            market: {
              select: { id: true, title: true, slug: true, image: true },
            },
          },
          orderBy: { confidence: "desc" },
        },
      },
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    return article;
  }

  // ─── Signals ──────────────────────────────────────────────────────────────

  async getMarketSentiment(marketId: string): Promise<any> {
    const since = new Date(Date.now() - 7 * 86400_000);
    const signals = await this.prisma.newsSignal.findMany({
      where: {
        marketId,
        createdAt: { gte: since },
      },
      select: { direction: true, confidence: true, createdAt: true },
    });

    if (signals.length === 0) {
      return {
        marketId,
        score: 0,
        direction: "NEUTRAL",
        signalCount: 0,
        avgConfidence: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    let bullishWeight = 0;
    let bearishWeight = 0;
    let totalConf = 0;

    for (const s of signals) {
      totalConf += s.confidence;
      if (s.direction === "BUY") bullishWeight += s.confidence;
      else bearishWeight += s.confidence;
    }

    const score =
      totalConf > 0
        ? Math.round(((bullishWeight - bearishWeight) / totalConf) * 100)
        : 0;
    const direction =
      score > 20 ? "BULLISH" : score < -20 ? "BEARISH" : "NEUTRAL";

    return {
      marketId,
      score,
      direction,
      signalCount: signals.length,
      avgConfidence: Math.round(totalConf / signals.length),
      updatedAt: new Date().toISOString(),
    };
  }

  async getSignals(query: NewsSignalQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NewsSignalWhereInput = {};

    if (query.marketId) {
      where.marketId = query.marketId;
    }
    if (query.minConfidence) {
      where.confidence = { gte: query.minConfidence };
    }
    if (query.direction) {
      where.direction = query.direction;
    }

    const [data, total] = await Promise.all([
      this.prisma.newsSignal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          article: {
            select: {
              id: true,
              title: true,
              source: true,
              url: true,
              imageUrl: true,
              sentiment: true,
              publishedAt: true,
            },
          },
          market: {
            select: { id: true, title: true, slug: true, image: true },
          },
        },
      }),
      this.prisma.newsSignal.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
