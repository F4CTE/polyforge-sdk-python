import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { JwtPayload } from "@polyforge/shared-types";
import { MarketsService } from "./markets.service";
import {
  MarketQueryDto,
  PriceHistoryQueryDto,
  SearchQueryDto,
  ClobPriceHistoryQueryDto,
  MarketHistoryQueryDto,
  CreateMarketAlertDto,
} from "./dto/market-query.dto";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

// Market-data endpoints get a tighter per-user rate limit (beta: 100 req/min)
const MARKET_DATA_THROTTLE = {
  default: { ttl: 60000, limit: BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute },
};

@ApiTags("markets")
@ApiBearerAuth("jwt")
@Controller("markets")
@UseGuards(JwtAuthGuard)
@Throttle(MARKET_DATA_THROTTLE)
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  list(@Query() query: MarketQueryDto) {
    return this.markets.list(query);
  }

  @Get("search")
  search(@Query() query: SearchQueryDto) {
    return this.markets.search(query);
  }

  @Get(":marketId")
  findOne(@Param("marketId") marketId: string) {
    return this.markets.findOne(marketId);
  }

  @Get(":marketId/history")
  marketHistory(
    @Param("marketId") marketId: string,
    @Query() query: MarketHistoryQueryDto,
  ) {
    return this.markets.marketHistory(marketId, query.period ?? "7d");
  }

  @Get(":marketId/alerts")
  listMarketAlerts(
    @Param("marketId") marketId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.markets.listMarketAlerts(marketId, user.sub);
  }

  @Post(":marketId/alerts")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  createMarketAlert(
    @Param("marketId") marketId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMarketAlertDto,
  ) {
    return this.markets.createMarketAlert(marketId, user.sub, dto);
  }

  @Delete(":marketId/alerts/:alertId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  deleteMarketAlert(
    @Param("alertId", ParseUUIDPipe) alertId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.markets.deleteMarketAlert(alertId, user.sub);
  }

  @Get(":marketId/sentiment")
  getMarketSentiment(
    @Param("marketId") marketId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.markets.getMarketSentiment(marketId, user.sub);
  }

  @Post(":marketId/sentiment")
  @HttpCode(HttpStatus.OK)
  voteMarketSentiment(
    @Param("marketId") marketId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.markets.getMarketSentiment(marketId, user.sub);
  }

  @Get(":tokenId/price-history")
  priceHistory(
    @Param("tokenId") tokenId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.markets.priceHistory(tokenId, query);
  }

  @Get(":tokenId/book")
  orderBook(@Param("tokenId") tokenId: string) {
    return this.markets.orderBook(tokenId);
  }

  @Get(":tokenId/tick-size")
  tickSize(@Param("tokenId") tokenId: string) {
    return this.markets.tickSize(tokenId);
  }

  @Get(":tokenId/spread")
  spread(@Param("tokenId") tokenId: string) {
    return this.markets.spread(tokenId);
  }

  @Get(":tokenId/midpoint")
  midpoint(@Param("tokenId") tokenId: string) {
    return this.markets.midpoint(tokenId);
  }

  @Get(":tokenId/clob-book")
  clobBook(@Param("tokenId") tokenId: string) {
    return this.markets.clobBook(tokenId);
  }

  @Get(":tokenId/clob-prices-history")
  clobPricesHistory(
    @Param("tokenId") tokenId: string,
    @Query() query: ClobPriceHistoryQueryDto,
  ) {
    return this.markets.clobPricesHistory(tokenId, query);
  }
}
