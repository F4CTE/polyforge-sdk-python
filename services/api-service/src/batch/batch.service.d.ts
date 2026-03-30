import { BatchItemDto, BatchResponseItem } from "./dto/batch-request.dto";
export declare class BatchService {
    private readonly logger;
    /**
     * Execute a batch of virtual requests against the local API,
     * forwarding the caller's auth token for each sub-request.
     */
    executeBatch(items: BatchItemDto[], authToken: string, port: number): Promise<BatchResponseItem[]>;
    private executeItem;
}
//# sourceMappingURL=batch.service.d.ts.map