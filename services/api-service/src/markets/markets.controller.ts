import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { MarketsService } from "./markets.service";
import { MarketQueryDto, PriceHistoryQueryDto } from "./dto/market-query.dto";

@ApiTags("markets")
@ApiBearerAuth("jwt")
@Controller("markets")
@UseGuards(JwtAuthGuard)
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
