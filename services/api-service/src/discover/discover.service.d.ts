import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PaginatedResponse } from "../common/dto/pagination.dto";
export interface DiscoverQueryDto {
    sort?: string;
    category?: string;
    page?: number;
    limit?: number;
}
export interface LeaderboardQueryDto {
    period?: string;
    page?: number;
    limit?: number;
}
export declare class DiscoverService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    discover(userId: string, query: DiscoverQueryDto): Promise<PaginatedResponse<any>>;
    leaderboard(query: LeaderboardQueryDto): Promise<PaginatedResponse<any>>;
}
//# sourceMappingURL=discover.service.d.ts.map