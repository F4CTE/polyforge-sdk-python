import { MarketsService } from "./markets.service";
import { MarketQueryDto, PriceHistoryQueryDto } from "./dto/market-query.dto";
export declare class MarketsController {
    private readonly markets;
    constructor(markets: MarketsService);
    list(query: MarketQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<any>>;
    findOne(marketId: string): Promise<any>;
    priceHistory(tokenId: string, query: PriceHistoryQueryDto): Promise<any>;
    orderBook(tokenId: string): Promise<any>;
}
//# sourceMappingURL=markets.controller.d.ts.map