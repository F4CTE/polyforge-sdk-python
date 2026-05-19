import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Logger,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { InternalAuthGuard } from "../common/internal-auth.guard";
import { KalshiRestService } from "./kalshi-rest.service";

@Controller("internal/kalshi/sports")
@SkipThrottle()
@UseGuards(InternalAuthGuard)
export class SportsDataController {
  private readonly logger = new Logger(SportsDataController.name);

  constructor(private readonly kalshi: KalshiRestService) {}

  @Get("filters")
  async getSportsFilters() {
    return this.kalshi.getSportsFilters();
  }

  @Get("series-tags")
  async getSeriesTags() {
    return this.kalshi.getSeriesTags();
  }

  @Get("milestones")
  async getMilestones(
    @Query("event_ticker") eventTicker?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const result = await this.kalshi.getMilestones({
      event_ticker: eventTicker,
      status,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return result;
  }

  @Get("live-data/:milestoneId")
  async getLiveData(@Param("milestoneId") milestoneId: string) {
    try {
      const data = await this.kalshi.getBatchLiveData({
        milestone_ids: [milestoneId],
      });
      return { liveData: data[0] ?? null };
    } catch (err) {
      this.logger.warn(`Live data fetch failed for ${milestoneId}: ${err}`);
      return { liveData: null };
    }
  }

  @Get("game-stats")
  async getGameStats(
    @Query("sport") sport?: string,
    @Query("league") league?: string,
    @Query("game_id") gameId?: string,
    @Query("milestone_id") milestoneId?: string,
  ) {
    return this.kalshi.getGameStats({
      sport,
      league,
      game_id: gameId,
      milestone_id: milestoneId,
    });
  }

  @Get("combos")
  async listComboCollections(
    @Query("series_ticker") seriesTicker?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.kalshi.getMultivariateCollections({
      series_ticker: seriesTicker,
      limit: limit ? parseInt(limit, 10) : 20,
      cursor,
    });
  }

  @Get("combos/:collectionTicker")
  async getComboCollection(
    @Param("collectionTicker") collectionTicker: string,
  ) {
    return this.kalshi.getMultivariateCollection(collectionTicker);
  }

  @Post("combos/lookup")
  async lookupComboTicker(
    @Body()
    body: {
      collectionTicker: string;
      selectedMarkets: Array<{
        marketTicker: string;
        eventTicker: string;
        side: "yes" | "no";
      }>;
    },
  ) {
    const tickerPairs = body.selectedMarkets.map((m) => ({
      market_ticker: m.marketTicker,
      event_ticker: m.eventTicker,
      side: m.side,
    }));
    return this.kalshi.lookupTicker(body.collectionTicker, tickerPairs);
  }

  @Get("structured-targets")
  async getStructuredTargets(
    @Query("type") type?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.kalshi.getStructuredTargets({
      type,
      limit: limit ? parseInt(limit, 10) : 20,
      cursor,
    });
  }
}
