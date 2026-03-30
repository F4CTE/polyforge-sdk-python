import type { FastifyReply } from "fastify";
type Response = FastifyReply;
import { StrategiesService } from "./strategies.service";
import { StrategyEventsService } from "../gateway/strategy-events.service";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { ImportStrategyDto } from "./dto/import-strategy.dto";
import { CreateFromDescriptionDto } from "./dto/create-from-description.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
export declare class StrategiesController {
    private readonly strategies;
    private readonly strategyEvents;
    constructor(strategies: StrategiesService, strategyEvents: StrategyEventsService);
    listTemplates(query: PaginationDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>>;
    list(user: any, query: StrategyQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>>;
    createFromDescription(user: any, dto: CreateFromDescriptionDto): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>;
    create(user: any, dto: CreateStrategyDto): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>;
    findOne(id: string, user: any): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    } & {
        childCount: number;
    }>;
    update(id: string, user: any, dto: UpdateStrategyDto): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>;
    remove(id: string, user: any): Promise<void>;
    /**
     * SSE stream of execution events for a running strategy.
     *
     * Authenticated via API key (Bearer token) with READ scope.
     * Sends `data: <JSON>\n\n` frames; heartbeat comment every 15 s.
     * Subscribes to in-process StrategyEventsService which is fed from stream:events.
     */
    streamEvents(id: string, user: any, res: Response): Promise<void>;
    exportStrategy(id: string, user: any, res: Response): Promise<void>;
    importStrategy(user: any, dto: ImportStrategyDto): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>;
    start(id: string, user: any, dto: StartStrategyDto): Promise<{
        status: string;
        startedAt: string;
    }>;
    stop(id: string, user: any): Promise<{
        status: string;
        stoppedAt: string;
    }>;
    pause(id: string, user: any): Promise<{
        status: string;
    }>;
    resume(id: string, user: any): Promise<{
        status: string;
    }>;
    fork(id: string, user: any): Promise<{
        tags: string[];
        version: number;
        name: string;
        canvas: import(".prisma/client/runtime/client").JsonValue | null;
        template: boolean;
        id: string;
        status: import(".prisma/client").$Enums.StrategyStatus;
        visibility: import(".prisma/client").$Enums.StrategyVisibility;
        userId: string;
        createdAt: Date;
        execMode: import(".prisma/client").$Enums.ExecMode;
        description: string | null;
        safety: import(".prisma/client/runtime/client").JsonValue;
        triggers: import(".prisma/client/runtime/client").JsonValue;
        conditions: import(".prisma/client/runtime/client").JsonValue;
        actions: import(".prisma/client/runtime/client").JsonValue;
        tickMs: number | null;
        parentStrategyId: string | null;
        forkedFromId: string | null;
        forkCount: number;
        likeCount: number;
        updatedAt: Date;
        errorMessage: string | null;
        forkedFromUserId: string | null;
    }>;
    like(id: string, user: any): Promise<{
        liked: boolean;
        likeCount: number;
    }>;
    listComments(id: string, query: PaginationDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<unknown>>;
    addComment(id: string, user: any, dto: CreateCommentDto): Promise<unknown>;
    deleteComment(strategyId: string, commentId: string, user: any): Promise<void>;
    listChildren(id: string, user: any): Promise<{
        children: Array<{
            id: string;
            name: string;
            status: string;
        }>;
    }>;
    report(id: string, user: any, dto: ReportStrategyDto): Promise<{
        reportId: string;
    }>;
}
export {};
//# sourceMappingURL=strategies.controller.d.ts.map