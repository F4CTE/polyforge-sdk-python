import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { AdminJwtGuard, RolesGuard, Roles } from "@polyforge/shared-auth";
import { AdminRole } from "@polyforge/shared-types";
import { MarketMatchService } from "./market-match.service";
import { ArbitrageService } from "./arbitrage.service";

@Controller()
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
export class MarketMatchController {
  constructor(
    private readonly matchService: MarketMatchService,
    private readonly arbitrageService: ArbitrageService,
  ) {}

  // ─── Market Matching Admin API ────────────────────────────────────────────

  @Get("api/v1/market-matches")
  async listMatches(
    @Query("verifiedOnly") verifiedOnly?: string,
    @Query("minConfidence") minConfidence?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.matchService.listMatches({
      verifiedOnly: verifiedOnly === "true",
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("api/v1/market-matches/market/:marketId")
  async matchesForMarket(@Param("marketId") marketId: string) {
    return this.matchService.getMatchesForMarket(marketId);
  }

  @Post("api/v1/market-matches")
  @HttpCode(HttpStatus.CREATED)
  async createManualMatch(
    @Body() body: { polymarketId: string; kalshiId: string },
  ) {
    if (!body.polymarketId || !body.kalshiId) {
      throw new BadRequestException(
        "polymarketId and kalshiId are both required",
      );
    }
    return this.matchService.createManualMatch(
      body.polymarketId,
      body.kalshiId,
    );
  }

  @Patch("api/v1/market-matches/:id/verify")
  async verifyMatch(@Param("id") id: string) {
    try {
      return await this.matchService.verifyMatch(id);
    } catch {
      throw new NotFoundException(`Match ${id} not found`);
    }
  }

  @Delete("api/v1/market-matches/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMatch(@Param("id") id: string) {
    try {
      await this.matchService.deleteMatch(id);
    } catch {
      throw new NotFoundException(`Match ${id} not found`);
    }
  }

  @Post("api/v1/market-matches/auto-match")
  @HttpCode(HttpStatus.OK)
  async triggerAutoMatch() {
    return this.matchService.runAutoMatch();
  }

  // ─── Cross-Venue Price Comparison ─────────────────────────────────────────

  @Get("api/v1/markets/:matchGroupId/comparison")
  async priceComparison(@Param("matchGroupId") matchGroupId: string) {
    const result = await this.arbitrageService.getPriceComparison(matchGroupId);
    if (!result) {
      throw new NotFoundException(`Match group ${matchGroupId} not found`);
    }
    return result;
  }

  // ─── Arbitrage Opportunities ──────────────────────────────────────────────

  @Get("api/v1/arbitrage/opportunities")
  async arbitrageOpportunities(
    @Query("threshold") threshold?: string,
    @Query("limit") limit?: string,
  ) {
    return this.arbitrageService.findOpportunities({
      thresholdPct: threshold ? parseFloat(threshold) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
