export declare class BatchItemDto {
    id: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: any;
}
export declare class BatchRequestDto {
    items: BatchItemDto[];
}
export interface BatchResponseItem {
    id: string;
    status: number;
    body: any;
}
//# sourceMappingURL=batch-request.dto.d.ts.map