import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { randomUUID } from "crypto";
import { Prisma, StrategyStatus } from "@prisma/client";
import { BETA_LIMITS } from "../common/beta-limits.config";

export class CreateListingDto {
  strategyId!: string;
  title!: string;
  description?: string;
  priceUsdc!: number;
  tags?: string[];
}

export class UpdateListingDto {
  title?: string;
  description?: string;
  priceUsdc?: number;
  tags?: string[];
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "DELISTED";
}

export class RateListingDto {
  rating!: number; // 1-5
  review?: string;
}

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Browse ────────────────────────────────────────────────────────────────

  async browse(params: {
    tag?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const { tag, sort = "newest", limit = 20, offset = 0 } = params;

    const orderBy =
      sort === "popular"
        ? { purchaseCount: "desc" as const }
        : sort === "rating"
          ? { avgRating: "desc" as const }
          : sort === "price_asc"
            ? { priceUsdc: "asc" as const }
            : sort === "price_desc"
              ? { priceUsdc: "desc" as const }
              : { createdAt: "desc" as const };

    const where: Prisma.MarketplaceListingWhereInput = {
      status: "ACTIVE",
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          strategy: { select: { id: true, name: true, description: true } },
        },
        orderBy,
        take: Math.min(limit, 100),
        skip: offset,
      }),
      this.prisma.marketplaceListing.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  // ── Get single listing ────────────────────────────────────────────────────

  async getListing(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        strategy: {
          select: { id: true, name: true, description: true, tags: true },
        },
        purchases: {
          select: { rating: true, review: true, createdAt: true },
          where: { rating: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!listing || listing.status === "DELISTED") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Listing not found",
      });
    }
    return listing;
  }

  // ── Create listing ────────────────────────────────────────────────────────

  async createListing(sellerId: string, dto: CreateListingDto) {
    const strategy = await this.prisma.strategy.findFirst({
      where: { id: dto.strategyId, userId: sellerId },
    });
    if (!strategy) {
      throw new NotFoundException({
        code: "STRATEGY_NOT_FOUND",
        message: "Strategy not found",
      });
    }

    const existing = await this.prisma.marketplaceListing.findUnique({
      where: { strategyId: dto.strategyId },
    });
    if (existing) {
      throw new UnprocessableEntityException({
        code: "ALREADY_LISTED",
        message: "This strategy is already listed",
      });
    }

    // Enforce marketplace listing limit (count non-delisted listings)
    const listingCount = await this.prisma.marketplaceListing.count({
      where: {
        sellerId,
        status: { notIn: ["DELISTED"] },
      },
    });
    if (listingCount >= BETA_LIMITS.maxMarketplaceListings) {
      throw new UnprocessableEntityException({
        code: "MARKETPLACE_LISTING_LIMIT_REACHED",
        message: `Beta limit: maximum ${BETA_LIMITS.maxMarketplaceListings} marketplace listings allowed. Delist an existing listing to publish a new one.`,
      });
    }

    if (dto.priceUsdc < 0) {
      throw new UnprocessableEntityException({
        code: "INVALID_PRICE",
        message: "Price must be 0 or greater",
      });
    }

    return this.prisma.marketplaceListing.create({
      data: {
        id: randomUUID(),
        strategyId: dto.strategyId,
        sellerId,
        title: dto.title,
        description: dto.description,
        priceUsdc: dto.priceUsdc,
        tags: dto.tags ?? [],
        status: "DRAFT",
      },
    });
  }

  // ── Update listing ────────────────────────────────────────────────────────

  async updateListing(
    sellerId: string,
    listingId: string,
    dto: UpdateListingDto,
  ) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });
    if (!listing || listing.sellerId !== sellerId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Listing not found",
      });
    }

    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.priceUsdc !== undefined ? { priceUsdc: dto.priceUsdc } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  // ── Purchase ──────────────────────────────────────────────────────────────

  async purchase(buyerId: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { strategy: true },
    });
    if (!listing || listing.status !== "ACTIVE") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Listing not available",
      });
    }
    if (listing.sellerId === buyerId) {
      throw new UnprocessableEntityException({
        code: "OWN_LISTING",
        message: "You cannot purchase your own listing",
      });
    }

    const alreadyBought = await this.prisma.marketplacePurchase.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
    });
    if (alreadyBought) {
      throw new UnprocessableEntityException({
        code: "ALREADY_PURCHASED",
        message: "You have already purchased this strategy",
      });
    }

    const price = parseFloat(String(listing.priceUsdc));
    const platformFee = parseFloat(String(listing.platformFeePct));
    const platformFeeAmt = price * platformFee;
    const sellerNet = price - platformFeeAmt;

    // Fetch full strategy to fork it
    const sourceStrategy = await this.prisma.strategy.findUnique({
      where: { id: listing.strategyId },
    });
    if (!sourceStrategy) {
      throw new NotFoundException({
        code: "STRATEGY_GONE",
        message: "Strategy no longer available",
      });
    }

    // Fork the strategy for the buyer
    const forkedStrategy = await this.prisma.strategy.create({
      data: {
        id: randomUUID(),
        userId: buyerId,
        name: `${sourceStrategy.name} (fork)`,
        description: sourceStrategy.description,
        triggers: sourceStrategy.triggers as Prisma.InputJsonValue,
        conditions: sourceStrategy.conditions as Prisma.InputJsonValue,
        actions: sourceStrategy.actions as Prisma.InputJsonValue,
        safety: sourceStrategy.safety as Prisma.InputJsonValue,
        tags: sourceStrategy.tags,
        status: StrategyStatus.IDLE,
        forkedFromId: listing.strategyId,
        forkedFromUserId: listing.sellerId,
      },
    });

    const [purchase] = await Promise.all([
      this.prisma.marketplacePurchase.create({
        data: {
          id: randomUUID(),
          listingId,
          buyerId,
          forkedStrategyId: forkedStrategy.id,
          priceUsdc: price,
          platformFee: platformFeeAmt,
          sellerNet,
        },
      }),
      this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          purchaseCount: { increment: 1 },
          forkCount: { increment: 1 },
          totalRevenue: { increment: sellerNet },
        },
      }),
    ]);

    return {
      purchaseId: purchase.id,
      forkedStrategyId: forkedStrategy.id,
      priceUsdc: price,
      platformFee: platformFeeAmt,
      sellerNet,
    };
  }

  // ── Rate / Review ─────────────────────────────────────────────────────────

  async rateListing(buyerId: string, listingId: string, dto: RateListingDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new UnprocessableEntityException({
        code: "INVALID_RATING",
        message: "Rating must be between 1 and 5",
      });
    }

    const purchase = await this.prisma.marketplacePurchase.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
    });
    if (!purchase) {
      throw new ForbiddenException({
        code: "NOT_PURCHASED",
        message: "You must purchase before rating",
      });
    }

    await this.prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { rating: dto.rating, review: dto.review },
    });

    // Recalculate aggregate rating
    const agg = await this.prisma.marketplacePurchase.aggregate({
      where: { listingId, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    return { rated: true };
  }

  // ── My listings ───────────────────────────────────────────────────────────

  async myListings(sellerId: string) {
    return this.prisma.marketplaceListing.findMany({
      where: { sellerId },
      include: {
        strategy: { select: { id: true, name: true } },
        purchases: { select: { id: true, createdAt: true, rating: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── My purchases ──────────────────────────────────────────────────────────

  async myPurchases(buyerId: string) {
    return this.prisma.marketplacePurchase.findMany({
      where: { buyerId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceUsdc: true,
            seller: { select: { username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
