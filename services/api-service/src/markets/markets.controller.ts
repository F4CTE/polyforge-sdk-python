import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { MarketsService } from "./markets.service";
import { MarketQueryDto, PriceHistoryQueryDto } from "./dto/market-query.dto";
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
}
