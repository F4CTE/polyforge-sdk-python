import { PaginationDto } from "../../common/dto/pagination.dto";
export declare class MarketQueryDto extends PaginationDto {
    search?: string;
    category?: string;
    closed?: boolean;
    sort?: string;
}
export declare class PriceHistoryQueryDto {
    resolution?: string;
    from?: string;
    to?: string;
    limit?: number;
}
//# sourceMappingURL=market-query.dto.d.ts.map