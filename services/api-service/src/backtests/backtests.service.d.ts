import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PaginatedResponse, PaginationDto } from "../common/dto/pagination.dto";
import { CreateBacktestDto } from "./dto/create-backtest.dto";
export interface BacktestQueryDto extends PaginationDto {
    strategyId?: string;
    status?: string;
}
export declare class BacktestsService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    list(userId: string, query: BacktestQueryDto): Promise<PaginatedResponse<any>>;
    create(userId: string, dto: CreateBacktestDto): Promise<any>;
    findOne(id: string, userId: string): Promise<any>;
}
//# sourceMappingURL=backtests.service.d.ts.map