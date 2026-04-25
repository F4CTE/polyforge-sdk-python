import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import type { JwtPayload } from "@polyforge/shared-types";
import { PrismaService } from "@polyforge/shared-db";
import { ConfigService } from "@nestjs/config";
import { Venue } from "@prisma/client";
import { FeeCalculatorService } from "./fee-calculator.service";
import { OrderPreviewDto } from "./dto/order-preview.dto";
import type { OrderPreviewResponse } from "./dto/order-preview.dto";

@ApiTags("Fees")
@ApiBearerAuth("jwt")
@Controller("fees")
@UseGuards(JwtAuthGuard)
export class FeesController {
  constructor(
    private readonly feeCalculator: FeeCalculatorService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post("preview")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  @ApiOperation({
    summary: "Preview order fees across venues",
    description:
      "Estimates fees on Polymarket and Kalshi for a given order, shows savings and recommended venue.",
  })
  @ApiResponse({ status: 200, description: "Fee comparison preview" })
  async previewOrder(
    @CurrentUser() _user: JwtPayload,
    @Body() dto: OrderPreviewDto,
  ): Promise<OrderPreviewResponse> {
    const token = await this.prisma.token.findUnique({
      where: { id: dto.tokenId },
      include: { market: true },
    });
    if (!token) {
      throw new NotFoundException({
        code: "TOKEN_NOT_FOUND",
        message: "Token not found",
      });
    }

    const kalshiEnabled = this.config.get<string>("KALSHI_ENABLED") === "true";

    let marketMatch: { matchId: string; confidence: number } | null = null;
    let kalshiAvailable = false;

    if (kalshiEnabled && token.market.venue === Venue.POLYMARKET) {
      const match = await this.prisma.marketMatch.findFirst({
        where: { polymarketId: token.market.id },
        orderBy: { confidence: "desc" },
      });
      if (match) {
        kalshiAvailable = true;
        marketMatch = {
          matchId: match.id,
          confidence: Number(match.confidence),
        };
      }
    } else if (kalshiEnabled && token.market.venue === Venue.KALSHI) {
      const match = await this.prisma.marketMatch.findFirst({
        where: { kalshiId: token.market.id },
        orderBy: { confidence: "desc" },
      });
      if (match) {
        kalshiAvailable = true;
        marketMatch = {
          matchId: match.id,
          confidence: Number(match.confidence),
        };
      }
    }

    const isMaker = dto.orderType === "POST_ONLY";
    const comparison = await this.feeCalculator.compareFees({
      price: dto.price,
      size: dto.size,
      side: dto.side,
      category: token.market.category,
      isMaker,
      kalshiAvailable,
    });

    return {
      ...comparison,
      marketMatch,
    };
  }

  @Get("schedules")
  @ApiOperation({
    summary: "List current fee schedules for all venues",
    description:
      "Returns active fee schedules for Polymarket and Kalshi, grouped by venue.",
  })
  async listSchedules() {
    const now = new Date();
    const schedules = await this.prisma.venueFeeSchedule.findMany({
      where: {
        effectiveAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ venue: "asc" }, { role: "asc" }, { minPrice: "asc" }],
    });

    return {
      polymarket: schedules
        .filter((s) => s.venue === Venue.POLYMARKET)
        .map((s) => ({
          category: s.category,
          role: s.role,
          feeBps: s.feeBps,
          effectiveAt: s.effectiveAt,
        })),
      kalshi: schedules
        .filter((s) => s.venue === Venue.KALSHI)
        .map((s) => ({
          role: s.role,
          feeBps: s.feeBps,
          minPrice: s.minPrice ? Number(s.minPrice) : null,
          maxPrice: s.maxPrice ? Number(s.maxPrice) : null,
          effectiveAt: s.effectiveAt,
        })),
    };
  }
}
