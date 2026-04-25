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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
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
import {
  JwtAuthGuard,
  AdminJwtGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import type { JwtPayload } from "@polyforge/shared-types";
import { AdminRole } from "@polyforge/shared-types";
import { ArbitrageService } from "./arbitrage.service";
import { MarketMatchService } from "./market-match.service";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";
import { ArbitrageAlertService } from "./arbitrage-alert.service";
import { CreateArbitrageAlertDto } from "./dto/create-arbitrage-alert.dto";

@ApiTags("Arbitrage")
@ApiBearerAuth("jwt")
@Controller("arbitrage")
export class ArbitrageController {
  constructor(
    private readonly arbitrage: ArbitrageService,
    private readonly marketMatch: MarketMatchService,
    private readonly crossVenue: CrossVenueArbitrageService,
    private readonly alertService: ArbitrageAlertService,
  ) {}

  // ─── Single-venue merge arbitrage (existing) ─────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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

  @Get("cross-venue/:marketId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Cross-venue arbitrage opportunities for a specific market",
    description:
      "Returns matched cross-venue opportunities where the given market appears on either side.",
  })
  @ApiParam({ name: "marketId", description: "Market ID from either venue" })
  @ApiQuery({
    name: "minSpread",
    required: false,
    type: Number,
    description: "Minimum price spread % (default 3)",
  })
  getCrossVenueForMarket(
    @Param("marketId") marketId: string,
    @Query("minSpread", new DefaultValuePipe(3), ParseFloatPipe)
    minSpread: number,
  ) {
    return this.crossVenue.getOpportunitiesForMarket(marketId, minSpread);
  }

  @Get("cross-venue/:matchId/comparison")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get detailed price comparison for a matched market pair",
  })
  @ApiParam({ name: "matchId", description: "MarketMatch ID" })
  getComparison(@Param("matchId") matchId: string) {
    return this.crossVenue.getComparison(matchId);
  }

  // ─── Spread comparison ──────────────────────────────────────────────────

  @Get("spread")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Bid/ask spread comparison across all matched venues",
    description:
      "Returns YES and NO spread percentages for every matched market pair with live pricing.",
  })
  getSpreadComparison() {
    return this.crossVenue.getSpreadComparison();
  }

  // ─── Historical arbitrage windows ───────────────────────────────────────

  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Historical arbitrage opportunity snapshots",
    description:
      "Paginated list of past cross-venue arbitrage detections, useful for backtesting.",
  })
  @ApiQuery({ name: "matchId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  getHistory(
    @Query("matchId") matchId?: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.crossVenue.getHistory({ matchId, limit, offset });
  }

  // ─── Arbitrage alerts ───────────────────────────────────────────────────

  @Get("alerts")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "List user's active arbitrage alert subscriptions",
  })
  listAlerts(@CurrentUser() user: JwtPayload) {
    return this.alertService.list(user.sub);
  }

  @Post("alerts")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  @ApiOperation({
    summary: "Create an arbitrage alert subscription",
    description:
      "Subscribe to notifications when cross-venue spread exceeds the given threshold.",
  })
  createAlert(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateArbitrageAlertDto,
  ) {
    return this.alertService.create(user.sub, dto);
  }

  @Delete("alerts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  @ApiOperation({ summary: "Deactivate an arbitrage alert" })
  @ApiParam({ name: "id" })
  removeAlert(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.alertService.remove(id, user.sub);
  }

  // ─── Market matching ─────────────────────────────────────────────────────

  @Get("matches")
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get all matches for a specific market (either venue)",
  })
  @ApiParam({ name: "marketId", description: "Market ID from either venue" })
  getMatchesByMarket(@Param("marketId") marketId: string) {
    return this.marketMatch.getMatchesByMarketId(marketId);
  }

  @Get("matches/:matchId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get a single market match by ID" })
  @ApiParam({ name: "matchId", description: "MarketMatch UUID" })
  @ApiResponse({ status: 200, description: "Match detail" })
  @ApiResponse({ status: 404, description: "Match not found" })
  getMatchById(@Param("matchId") matchId: string) {
    return this.marketMatch.getMatchById(matchId);
  }

  @Post("matches")
  @HttpCode(201)
  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: "Manually match two markets across venues (admin)" })
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
  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: "Verify/confirm an auto-matched market pair (admin)",
  })
  @ApiParam({ name: "matchId" })
  verifyMatch(@Param("matchId") matchId: string) {
    return this.marketMatch.verifyMatch(matchId);
  }

  @Delete("matches/:matchId")
  @HttpCode(204)
  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: "Remove a market match (admin)" })
  @ApiParam({ name: "matchId" })
  deleteMatch(@Param("matchId") matchId: string) {
    return this.marketMatch.manualUnmatch(matchId);
  }

  @Post("matches/sync")
  @HttpCode(200)
  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: "Trigger a manual matching pass (admin)",
    description: "Runs the TF-IDF matching algorithm immediately.",
  })
  triggerSync() {
    return this.marketMatch
      .runMatchingPass()
      .then((count) => ({ matched: count }));
  }
}
