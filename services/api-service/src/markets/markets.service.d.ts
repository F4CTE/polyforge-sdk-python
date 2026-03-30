import { OnModuleInit } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PaginatedResponse } from "../common/dto/pagination.dto";
import { MarketQueryDto, PriceHistoryQueryDto } from "./dto/market-query.dto";
export declare class MarketsService implements OnModuleInit {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private readonly allowedSortColumns;
    constructor(prisma: PrismaService, redis: RedisService);
    /** Pre-warm the Redis cache with the first page of markets on startup */
    onModuleInit(): Promise<void>;
    list(query: MarketQueryDto): Promise<PaginatedResponse<any>>;
    findOne(marketId: string): Promise<any>;
    priceHistory(tokenId: string, query: PriceHistoryQueryDto): Promise<any>;
    orderBook(tokenId: string): Promise<any>;
}
//# sourceMappingURL=markets.service.d.ts.map