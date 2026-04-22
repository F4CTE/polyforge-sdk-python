import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseFloatPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { ArbitrageService } from "./arbitrage.service";
import { MarketMatchService } from "./market-match.service";
import {
  CrossVenueArbitrageService,
} from "./cross-venue-arbitrage.service";

@ApiTags("Arbitrage")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("arbitrage")
export class ArbitrageController {
  constructor(
    private readonly arbitrage: ArbitrageService,
    private readonly marketMatch: MarketMatchService,
    private readonly crossVenue: CrossVenueArbitrageService,
  ) {}

  // ─── Single-venue merge arbitrage (existing) ─────────────────────────────

  @Get()
  @ApiOperation({
    summary: "Scan live markets for merge arbitrage opportunities",
    description:
      "Returns binary prediction markets where YES_price + NO_price < 1.00.",
  })
  @ApiQuery({
    name: "minMargin",
    required: false,
    type: Number,
    description: "Minimum profit margin % (default 0.5)",
  })
  @ApiResponse({
    status: 200,
    description: "Sorted list of arbitrage opportunities (best margin first)",
  })
  getOpportunities(
    @Query("minMargin", new DefaultValuePipe(0.5), ParseFloatPipe)
    minMargin: number,
  ) {
    return this.arbitrage.getOpportunities(minMargin);
  }

  // ─── Cross-venue arbitrage ────────────────────────────────────────────────

  @Get("cross-venue")
  @ApiOperation({
    summary: "List cross-venue arbitrage opportunities",
    description:
      "Returns matched markets where the YES price differs significantly between Polymarket and Kalshi.",
  })
  @ApiQuery({
    name: "minSpread",
    required: false,
    type: Number,
    description: "Minimum price spread % (default 3)",
  })
  getCrossVenueOpportunities(
    @Query("minSpread", new DefaultValuePipe(3), ParseFloatPipe)
    minSpread: number,
  ) {
    return this.crossVenue.getOpportunities(minSpread);
  }

  @Get("cross-venue/:matchId/comparison")
  @ApiOperation({
    summary: "Get detailed price comparison for a matched market pair",
  })
  @ApiParam({ name: "matchId", description: "MarketMatch ID" })
  getComparison(@Param("matchId") matchId: string) {
    return this.crossVenue.getComparison(matchId);
  }

  // ─── Market matching ─────────────────────────────────────────────────────

  @Get("matches")
  @ApiOperation({ summary: "List market matches across venues" })
  @ApiQuery({ name: "verified", required: false, type: Boolean })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  listMatches(
    @Query("verified") verified?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.marketMatch.listMatches({
      verified: verified !== undefined ? verified === "true" : undefined,
      limit,
      offset,
    });
  }

  @Get("matches/market/:marketId")
  @ApiOperation({
    summary: "Get all matches for a specific market (either venue)",
  })
  @ApiParam({ name: "marketId", description: "Market ID from either venue" })
  getMatchesByMarket(@Param("marketId") marketId: string) {
    return this.marketMatch.getMatchesByMarketId(marketId);
  }

  @Post("matches")
  @HttpCode(201)
  @ApiOperation({ summary: "Manually match two markets across venues" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["polymarketId", "kalshiId"],
      properties: {
        polymarketId: { type: "string" },
        kalshiId: { type: "string" },
      },
    },
  })
  createMatch(
    @Body("polymarketId") polymarketId: string,
    @Body("kalshiId") kalshiId: string,
  ) {
    return this.marketMatch.manualMatch(polymarketId, kalshiId);
  }

  @Post("matches/:matchId/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify/confirm an auto-matched market pair" })
  @ApiParam({ name: "matchId" })
  verifyMatch(@Param("matchId") matchId: string) {
    return this.marketMatch.verifyMatch(matchId);
  }

  @Delete("matches/:matchId")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a market match (unmatch)" })
  @ApiParam({ name: "matchId" })
  deleteMatch(@Param("matchId") matchId: string) {
    return this.marketMatch.manualUnmatch(matchId);
  }

  @Post("matches/sync")
  @HttpCode(200)
  @ApiOperation({
    summary: "Trigger a manual matching pass (admin)",
    description: "Runs the TF-IDF matching algorithm immediately.",
  })
  triggerSync() {
    return this.marketMatch.runMatchingPass().then((count) => ({ matched: count }));
  }
}
