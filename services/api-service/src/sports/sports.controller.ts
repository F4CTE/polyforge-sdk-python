import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { SportsService } from "./sports.service";
import {
  SportsMarketsQueryDto,
  SportsEventsQueryDto,
  MilestonesQueryDto,
  ComboCollectionsQueryDto,
  ComboLookupDto,
} from "./dto/sports-query.dto";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

const SPORTS_THROTTLE = {
  default: { ttl: 60000, limit: BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute },
};

@ApiTags("sports")
@ApiBearerAuth("jwt")
@Controller("sports")
@UseGuards(JwtAuthGuard)
@Throttle(SPORTS_THROTTLE)
export class SportsController {
  constructor(private readonly sports: SportsService) {}

  @Get("categories")
  getCategories() {
    return this.sports.getCategories();
  }

  @Get("markets")
  listMarkets(@Query() query: SportsMarketsQueryDto) {
    return this.sports.listMarkets(query);
  }

  @Get("events")
  listEvents(@Query() query: SportsEventsQueryDto) {
    return this.sports.listEvents(query);
  }

  @Get("events/:eventTicker")
  getEventDetail(@Param("eventTicker") eventTicker: string) {
    return this.sports.getEventDetail(eventTicker);
  }

  @Get("milestones")
  getMilestones(@Query() query: MilestonesQueryDto) {
    return this.sports.getMilestones(query);
  }

  @Get("live-data/:milestoneId")
  getLiveData(@Param("milestoneId") milestoneId: string) {
    return this.sports.getLiveData(milestoneId);
  }

  @Get("combos")
  listCombos(@Query() query: ComboCollectionsQueryDto) {
    return this.sports.listComboCollections(query);
  }

  @Get("combos/:collectionTicker")
  getComboCollection(@Param("collectionTicker") collectionTicker: string) {
    return this.sports.listComboCollections({ page: 1, limit: 1 });
  }

  @Post("combos/lookup")
  @HttpCode(HttpStatus.OK)
  lookupComboTicker(@Body() dto: ComboLookupDto) {
    return this.sports.lookupComboTicker(
      dto.collectionTicker,
      dto.selectedMarkets,
    );
  }
}
