import { ConfigService } from "@nestjs/config";
import { Strategy } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { PaginatedResponse } from "../common/dto/pagination.dto";
import { InternalClientService } from "../common/services/internal-client.service";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { ImportStrategyDto } from "./dto/import-strategy.dto";
import { CreateFromDescriptionDto } from "./dto/create-from-description.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { LlmService } from "../news/llm.service";
export declare class StrategiesService {
    private readonly prisma;
    private readonly config;
    private readonly client;
    private readonly llm;
    private readonly logger;
    private readonly engineUrl;
    constructor(prisma: PrismaService, config: ConfigService, client: InternalClientService, llm: LlmService);
    list(userId: string, query: StrategyQueryDto): Promise<PaginatedResponse<Strategy>>;
    create(userId: string, dto: CreateStrategyDto): Promise<Strategy>;
    findOne(id: string, userId: string): Promise<Strategy & {
        childCount: number;
    }>;
    update(id: string, userId: string, dto: UpdateStrategyDto): Promise<Strategy>;
    remove(id: string, userId: string): Promise<void>;
    start(id: string, userId: string, dto: StartStrategyDto): Promise<{
        status: string;
        startedAt: string;
    }>;
    stop(id: string, userId: string): Promise<{
        status: string;
        stoppedAt: string;
    }>;
    pause(id: string, userId: string): Promise<{
        status: string;
    }>;
    resume(id: string, userId: string): Promise<{
        status: string;
    }>;
    fork(id: string, userId: string): Promise<Strategy>;
    like(id: string, userId: string): Promise<{
        liked: boolean;
        likeCount: number;
    }>;
    listComments(id: string, query: PaginationDto): Promise<PaginatedResponse<unknown>>;
    addComment(id: string, userId: string, dto: CreateCommentDto): Promise<unknown>;
    deleteComment(strategyId: string, commentId: string, userId: string): Promise<void>;
    report(id: string, userId: string, dto: ReportStrategyDto): Promise<{
        reportId: string;
    }>;
    listChildren(id: string, userId: string): Promise<{
        children: Array<{
            id: string;
            name: string;
            status: string;
        }>;
    }>;
    listTemplates(query: PaginationDto): Promise<PaginatedResponse<Strategy>>;
    exportStrategy(id: string, userId: string): Promise<{
        payload: object;
        filename: string;
    }>;
    importStrategy(dto: ImportStrategyDto, userId: string): Promise<Strategy>;
    createFromDescription(userId: string, dto: CreateFromDescriptionDto): Promise<Strategy>;
    private getOwned;
}
//# sourceMappingURL=strategies.service.d.ts.map