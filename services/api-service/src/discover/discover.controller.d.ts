import { DiscoverService } from "./discover.service";
import { PaginationDto } from "../common/dto/pagination.dto";
declare class DiscoverQueryDto extends PaginationDto {
    sort?: string;
    category?: string;
}
declare class LeaderboardQueryDto extends PaginationDto {
    period?: string;
}
export declare class DiscoverController {
    private readonly discover;
    constructor(discover: DiscoverService);
    getDiscover(user: any, query: DiscoverQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<any>>;
    getLeaderboard(query: LeaderboardQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<any>>;
}
export {};
//# sourceMappingURL=discover.controller.d.ts.map