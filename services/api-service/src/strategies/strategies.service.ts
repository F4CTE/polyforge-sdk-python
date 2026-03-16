import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    UnprocessableEntityException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StrategyStatus } from '.prisma/client';
import { PrismaService } from '@polyforge/shared-db';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { InternalClientService } from '../common/services/internal-client.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { StartStrategyDto } from './dto/start-strategy.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportStrategyDto } from './dto/report-strategy.dto';
import { StrategyQueryDto } from './dto/strategy-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

const MAX_STRATEGIES = 50;

@Injectable()
export class StrategiesService {
    private readonly logger = new Logger(StrategiesService.name);
    private readonly engineUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly client: InternalClientService,
    ) {
        this.engineUrl = this.config.get<string>('STRATEGY_ENGINE_URL', 'http://strategy-engine:3006');
    }

    async list(userId: string, query: StrategyQueryDto): Promise<PaginatedResponse<any>> {
        const { page, limit, status, sort } = query;
        const skip = (page - 1) * limit;

        const where: any = { userId, status: { not: StrategyStatus.ARCHIVED } };
        if (status) where.status = status as StrategyStatus;

        const orderBy = { [sort ?? 'createdAt']: 'desc' as const };

        const [strategies, total] = await Promise.all([
            this.prisma.strategy.findMany({ where, skip, take: limit, orderBy }),
            this.prisma.strategy.count({ where }),
        ]);

        return paginate(strategies, total, page, limit);
    }

    async create(userId: string, dto: CreateStrategyDto): Promise<any> {
        const count = await this.prisma.strategy.count({
            where: { userId, status: { not: StrategyStatus.ARCHIVED } },
        });
        if (count >= MAX_STRATEGIES) {
            throw new UnprocessableEntityException({ code: 'STRATEGY_LIMIT_REACHED', message: 'Strategy limit reached' });
        }

        return this.prisma.strategy.create({
            data: {
                userId,
                name: dto.name,
                description: dto.description,
                visibility: dto.visibility as any ?? 'PRIVATE',
                execMode: dto.execMode as any ?? 'TICK',
                tickMs: dto.tickMs ?? 1000,
                triggers: dto.triggers as any ?? [],
                conditions: dto.conditions as any ?? [],
                actions: dto.actions as any ?? [],
                safety: dto.safety as any ?? [],
                tags: dto.tags ?? [],
                status: StrategyStatus.IDLE,
                version: 1,
                template: false,
            },
        });
    }

    async findOne(id: string, userId: string): Promise<any> {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Strategy not found' });
        }
        if (strategy.visibility === 'PRIVATE' as any && strategy.userId !== userId) {
            throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        return strategy;
    }

    async update(id: string, userId: string, dto: UpdateStrategyDto): Promise<any> {
        const strategy = await this.getOwned(id, userId);
        if (strategy.status === StrategyStatus.RUNNING) {
            const blocksChanged = (dto as any).triggers !== undefined || (dto as any).conditions !== undefined
                || (dto as any).actions !== undefined || (dto as any).safety !== undefined;
            if (blocksChanged) {
                throw new UnprocessableEntityException({ code: 'STRATEGY_IS_RUNNING', message: 'Cannot edit blocks while strategy is running' });
            }
        }

        const data: any = { updatedAt: new Date(), version: { increment: 1 } };
        const d = dto as any;
        if (d.name !== undefined) data.name = d.name;
        if (d.description !== undefined) data.description = d.description;
        if (d.visibility !== undefined) data.visibility = d.visibility;
        if (d.execMode !== undefined) data.execMode = d.execMode;
        if (d.tickMs !== undefined) data.tickMs = d.tickMs;
        if (d.triggers !== undefined) data.triggers = d.triggers;
        if (d.conditions !== undefined) data.conditions = d.conditions;
        if (d.actions !== undefined) data.actions = d.actions;
        if (d.safety !== undefined) data.safety = d.safety;
        if (d.tags !== undefined) data.tags = d.tags;

        return this.prisma.strategy.update({ where: { id }, data });
    }

    async remove(id: string, userId: string): Promise<void> {
        const strategy = await this.getOwned(id, userId);
        if (strategy.status === StrategyStatus.RUNNING) {
            throw new UnprocessableEntityException({ code: 'STRATEGY_IS_RUNNING', message: 'Stop strategy before deleting' });
        }
        await this.prisma.strategy.update({
            where: { id },
            data: { status: StrategyStatus.ARCHIVED },
        });
    }

    async start(id: string, userId: string, dto: StartStrategyDto): Promise<any> {
        const strategy = await this.getOwned(id, userId);

        if (strategy.status === StrategyStatus.RUNNING) {
            throw new UnprocessableEntityException({ code: 'ALREADY_RUNNING', message: 'Strategy is already running' });
        }

        if (dto.mode === 'live') {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { polymarketConnected: true },
            });
            if (!user?.polymarketConnected) {
                throw new UnprocessableEntityException({ code: 'NOT_CONNECTED', message: 'Polymarket credentials required for live mode' });
            }
        }

        const res = await this.client.post(this.engineUrl, 'strategy-engine', `/internal/strategies/${id}/start`);
        if (!res.ok && res.status !== 204) {
            const body: any = await res.json().catch(() => ({}));
            throw new UnprocessableEntityException({ code: body.code ?? 'ENGINE_ERROR', message: body.message ?? 'Failed to start strategy' });
        }

        return { status: 'RUNNING', startedAt: new Date().toISOString() };
    }

    async stop(id: string, userId: string): Promise<any> {
        await this.getOwned(id, userId);
        const res = await this.client.delete(this.engineUrl, 'strategy-engine', `/internal/strategies/${id}`);
        if (!res.ok && res.status !== 204) {
            this.logger.warn(`Engine stop returned ${res.status} for ${id}`);
        }
        await this.prisma.strategy.update({ where: { id }, data: { status: StrategyStatus.IDLE } });
        return { status: 'IDLE', stoppedAt: new Date().toISOString() };
    }

    async pause(id: string, userId: string): Promise<any> {
        await this.getOwned(id, userId);
        await this.client.post(this.engineUrl, 'strategy-engine', `/internal/strategies/${id}/pause`);
        return { status: 'PAUSED' };
    }

    async resume(id: string, userId: string): Promise<any> {
        await this.getOwned(id, userId);
        await this.client.post(this.engineUrl, 'strategy-engine', `/internal/strategies/${id}/resume`);
        return { status: 'RUNNING' };
    }

    async fork(id: string, userId: string): Promise<any> {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Strategy not found' });
        }
        if (strategy.visibility === 'PRIVATE' as any && strategy.userId !== userId) {
            throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot fork a private strategy' });
        }

        const count = await this.prisma.strategy.count({
            where: { userId, status: { not: StrategyStatus.ARCHIVED } },
        });
        if (count >= MAX_STRATEGIES) {
            throw new UnprocessableEntityException({ code: 'STRATEGY_LIMIT_REACHED', message: 'Strategy limit reached' });
        }

        return this.prisma.strategy.create({
            data: {
                userId,
                name: `Fork of ${strategy.name}`,
                description: strategy.description,
                visibility: 'PRIVATE' as any,
                execMode: strategy.execMode,
                tickMs: strategy.tickMs,
                triggers: strategy.triggers as any,
                conditions: strategy.conditions as any,
                actions: strategy.actions as any,
                safety: strategy.safety as any,
                tags: strategy.tags ?? [],
                status: StrategyStatus.IDLE,
                version: 1,
                template: false,
                forkedFromId: id,
            },
        });
    }

    async like(id: string, userId: string): Promise<any> {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.visibility === 'PRIVATE' as any) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Strategy not found' });
        }

        // StrategyLike composite PK: [userId, strategyId]
        const existing = await this.prisma.strategyLike.findUnique({
            where: { userId_strategyId: { userId, strategyId: id } },
        });

        let liked: boolean;
        if (existing) {
            await this.prisma.strategyLike.delete({ where: { userId_strategyId: { userId, strategyId: id } } });
            await this.prisma.strategy.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
            liked = false;
        } else {
            await this.prisma.strategyLike.create({ data: { userId, strategyId: id } });
            await this.prisma.strategy.update({ where: { id }, data: { likeCount: { increment: 1 } } });
            liked = true;
        }

        const updated = await this.prisma.strategy.findUnique({ where: { id }, select: { likeCount: true } });
        return { liked, likeCount: updated?.likeCount ?? 0 };
    }

    async listComments(id: string, query: PaginationDto): Promise<PaginatedResponse<any>> {
        const { page, limit } = query;
        const skip = (page - 1) * limit;

        const [comments, total] = await Promise.all([
            this.prisma.strategyComment.findMany({
                where: { strategyId: id, deleted: false },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, username: true, displayName: true } } },
            }),
            this.prisma.strategyComment.count({ where: { strategyId: id, deleted: false } }),
        ]);

        return paginate(comments, total, page, limit);
    }

    async addComment(id: string, userId: string, dto: CreateCommentDto): Promise<any> {
        await this.findOne(id, userId);
        return this.prisma.strategyComment.create({
            data: { strategyId: id, userId, content: dto.content },
            include: { user: { select: { id: true, username: true, displayName: true } } },
        });
    }

    async deleteComment(strategyId: string, commentId: string, userId: string): Promise<void> {
        const comment = await this.prisma.strategyComment.findUnique({ where: { id: commentId } });
        if (!comment || comment.strategyId !== strategyId) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Comment not found' });
        }
        if (comment.userId !== userId) {
            throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not the comment author' });
        }
        await this.prisma.strategyComment.update({ where: { id: commentId }, data: { deleted: true } });
    }

    async report(id: string, userId: string, dto: ReportStrategyDto): Promise<any> {
        await this.findOne(id, userId);
        // Report model: reporterId, targetType, targetId, strategyId, reason, description
        const report = await this.prisma.report.create({
            data: {
                reporterId: userId,
                targetType: 'STRATEGY',
                targetId: id,
                strategyId: id,
                reason: dto.reason as any,
                description: dto.description,
            },
        });
        return { reportId: report.id };
    }

    async listTemplates(query: PaginationDto): Promise<PaginatedResponse<any>> {
        const { page, limit } = query;
        const skip = (page - 1) * limit;

        const [templates, total] = await Promise.all([
            this.prisma.strategy.findMany({
                where: { template: true, status: { not: StrategyStatus.ARCHIVED } },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.strategy.count({ where: { template: true, status: { not: StrategyStatus.ARCHIVED } } }),
        ]);

        return paginate(templates, total, page, limit);
    }

    private async getOwned(id: string, userId: string): Promise<any> {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'Strategy not found' });
        }
        if (strategy.userId !== userId) {
            throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        return strategy;
    }
}
