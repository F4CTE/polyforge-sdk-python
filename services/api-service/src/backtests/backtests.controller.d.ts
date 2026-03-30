import { BacktestsService } from "./backtests.service";
import { CreateBacktestDto } from "./dto/create-backtest.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
declare class BacktestQueryDto extends PaginationDto {
    strategyId?: string;
    status?: string;
}
export declare class BacktestsController {
    private readonly backtests;
    constructor(backtests: BacktestsService);
    list(user: any, query: BacktestQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<any>>;
    create(user: any, dto: CreateBacktestDto): Promise<any>;
    quick(user: any, dto: CreateBacktestDto): Promise<any>;
    findOne(id: string, user: any): Promise<any>;
}
export {};
//# sourceMappingURL=backtests.controller.d.ts.map