import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { MarketsService } from "./markets.service";
import {
  MarketQueryDto,
  PriceHistoryQueryDto,
  SearchQueryDto,
  ClobPriceHistoryQueryDto,
} from "./dto/market-query.dto";
import { BETA_LIMITS } from "../common/beta-limits.config";

// Market-data endpoints get a tighter per-user rate limit (beta: 100 req/min)
const MARKET_DATA_THROTTLE = {
  default: { ttl: 60000, limit: BETA_LIMITS.marketDataRateLimitPerMinute },
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
