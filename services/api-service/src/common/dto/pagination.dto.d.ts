export declare class PaginationDto {
    page: number;
    limit: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
}
export declare function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T>;
//# sourceMappingURL=pagination.dto.d.ts.map