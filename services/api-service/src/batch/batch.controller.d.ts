import { FastifyRequest } from "fastify";
import { BatchService } from "./batch.service";
import { BatchRequestDto } from "./dto/batch-request.dto";
export declare class BatchController {
    private readonly batchService;
    constructor(batchService: BatchService);
    executeBatch(_user: any, dto: BatchRequestDto, req: FastifyRequest): Promise<{
        results: import("./dto/batch-request.dto").BatchResponseItem[];
    }>;
}
//# sourceMappingURL=batch.controller.d.ts.map