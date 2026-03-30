"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StrategiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategiesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require(".prisma/client");
const shared_db_1 = require("@polyforge/shared-db");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const internal_client_service_1 = require("../common/services/internal-client.service");
const llm_service_1 = require("../news/llm.service");
const MAX_STRATEGIES = 50;
let StrategiesService = StrategiesService_1 = class StrategiesService {
    prisma;
    config;
    client;
    llm;
    logger = new common_1.Logger(StrategiesService_1.name);
    engineUrl;
    constructor(prisma, config, client, llm) {
        this.prisma = prisma;
        this.config = config;
        this.client = client;
        this.llm = llm;
        this.engineUrl = this.config.get("STRATEGY_ENGINE_URL", "http://strategy-engine:3006");
    }
    async list(userId, query) {
        const { page, limit, status, sort } = query;
        const skip = (page - 1) * limit;
        const where = {
            userId,
            status: { not: client_1.StrategyStatus.ARCHIVED },
        };
        if (status)
            where.status = status;
        const orderBy = { [sort ?? "createdAt"]: "desc" };
        const [strategies, total] = await Promise.all([
            this.prisma.strategy.findMany({ where, skip, take: limit, orderBy }),
            this.prisma.strategy.count({ where }),
        ]);
        return (0, pagination_dto_1.paginate)(strategies, total, page, limit);
    }
    async create(userId, dto) {
        const count = await this.prisma.strategy.count({
            where: { userId, status: { not: client_1.StrategyStatus.ARCHIVED } },
        });
        if (count >= MAX_STRATEGIES) {
            throw new common_1.UnprocessableEntityException({
                code: "STRATEGY_LIMIT_REACHED",
                message: "Strategy limit reached",
            });
        }
        return this.prisma.strategy.create({
            data: {
                userId,
                name: dto.name,
                description: dto.description,
                visibility: dto.visibility ?? client_1.StrategyVisibility.PRIVATE,
                execMode: dto.execMode ?? client_1.ExecMode.TICK,
                tickMs: dto.tickMs ?? 1000,
                triggers: (dto.triggers ?? []),
                conditions: (dto.conditions ?? []),
                actions: (dto.actions ?? []),
                safety: (dto.safety ?? []),
                tags: dto.tags ?? [],
                canvas: dto.canvas,
                status: client_1.StrategyStatus.IDLE,
                version: 1,
                template: false,
            },
        });
    }
    async findOne(id, userId) {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Strategy not found",
            });
        }
        if (strategy.visibility === client_1.StrategyVisibility.PRIVATE &&
            strategy.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        const childCount = await this.prisma.strategy.count({
            where: { parentStrategyId: id, status: { not: client_1.StrategyStatus.ARCHIVED } },
        });
        return { ...strategy, childCount };
    }
    async update(id, userId, dto) {
        const strategy = await this.getOwned(id, userId);
        if (strategy.status === client_1.StrategyStatus.RUNNING) {
            const blocksChanged = dto.triggers !== undefined ||
                dto.conditions !== undefined ||
                dto.actions !== undefined ||
                dto.safety !== undefined;
            if (blocksChanged) {
                throw new common_1.UnprocessableEntityException({
                    code: "STRATEGY_IS_RUNNING",
                    message: "Cannot edit blocks while strategy is running",
                });
            }
        }
        const data = {
            updatedAt: new Date(),
            version: { increment: 1 },
        };
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.description !== undefined)
            data.description = dto.description;
        if (dto.visibility !== undefined)
            data.visibility = dto.visibility;
        if (dto.execMode !== undefined)
            data.execMode = dto.execMode;
        if (dto.tickMs !== undefined)
            data.tickMs = dto.tickMs;
        if (dto.triggers !== undefined)
            data.triggers = dto.triggers;
        if (dto.conditions !== undefined)
            data.conditions = dto.conditions;
        if (dto.actions !== undefined)
            data.actions = dto.actions;
        if (dto.safety !== undefined)
            data.safety = dto.safety;
        if (dto.tags !== undefined)
            data.tags = dto.tags;
        if (dto.canvas !== undefined)
            data.canvas = dto.canvas;
        return this.prisma.strategy.update({ where: { id }, data });
    }
    async remove(id, userId) {
        const strategy = await this.getOwned(id, userId);
        if (strategy.status === client_1.StrategyStatus.RUNNING) {
            throw new common_1.UnprocessableEntityException({
                code: "STRATEGY_IS_RUNNING",
                message: "Stop strategy before deleting",
            });
        }
        // Detach children (don't delete them)
        await this.prisma.strategy.updateMany({
            where: { parentStrategyId: id },
            data: { parentStrategyId: null },
        });
        await this.prisma.strategy.update({
            where: { id },
            data: { status: client_1.StrategyStatus.ARCHIVED },
        });
    }
    async start(id, userId, dto) {
        // R4-01: Atomic check-and-update to prevent race conditions
        const newStatus = dto.mode === "paper" ? client_1.StrategyStatus.PAPER : client_1.StrategyStatus.RUNNING;
        const updated = await this.prisma.strategy.updateMany({
            where: { id, userId, status: client_1.StrategyStatus.IDLE },
            data: { status: newStatus },
        });
        if (updated.count === 0) {
            // Either not found, not owned, or not in IDLE state
            const strategy = await this.prisma.strategy.findUnique({ where: { id } });
            if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
                throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Strategy not found" });
            }
            if (strategy.userId !== userId) {
                throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
            }
            throw new common_1.ConflictException({ code: "ALREADY_RUNNING", message: "Strategy is already running or not in IDLE state" });
        }
        if (dto.mode === "live") {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { polymarketConnected: true },
            });
            if (!user?.polymarketConnected) {
                // Roll back status since we already set it
                await this.prisma.strategy.update({
                    where: { id },
                    data: { status: client_1.StrategyStatus.IDLE },
                });
                throw new common_1.UnprocessableEntityException({
                    code: "NOT_CONNECTED",
                    message: "Polymarket credentials required for live mode",
                });
            }
        }
        const res = await this.client.post(this.engineUrl, "strategy-engine", `/internal/strategies/${id}/start`);
        if (!res.ok && res.status !== 204) {
            // Roll back status on engine failure
            await this.prisma.strategy.update({
                where: { id },
                data: { status: client_1.StrategyStatus.IDLE },
            });
            const body = (await res.json().catch(() => ({})));
            throw new common_1.UnprocessableEntityException({
                code: body.code ?? "ENGINE_ERROR",
                message: body.message ?? "Failed to start strategy",
            });
        }
        return { status: "RUNNING", startedAt: new Date().toISOString() };
    }
    async stop(id, userId) {
        // R4-01: Atomic check-and-update — only stop if currently RUNNING or PAPER
        const updated = await this.prisma.strategy.updateMany({
            where: { id, userId, status: { in: [client_1.StrategyStatus.RUNNING, client_1.StrategyStatus.PAPER] } },
            data: { status: client_1.StrategyStatus.IDLE },
        });
        if (updated.count === 0) {
            const strategy = await this.prisma.strategy.findUnique({ where: { id } });
            if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
                throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Strategy not found" });
            }
            if (strategy.userId !== userId) {
                throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
            }
            throw new common_1.ConflictException({ code: "NOT_RUNNING", message: "Strategy is not in a running state" });
        }
        // Stop managed children first
        const children = await this.prisma.strategy.findMany({
            where: { parentStrategyId: id, status: { in: [client_1.StrategyStatus.RUNNING, client_1.StrategyStatus.PAPER] } },
            select: { id: true },
        });
        for (const child of children) {
            try {
                await this.client.delete(this.engineUrl, "strategy-engine", `/internal/strategies/${child.id}`);
            }
            catch {
                this.logger.warn(`Failed to stop child strategy ${child.id}`);
            }
        }
        const res = await this.client.delete(this.engineUrl, "strategy-engine", `/internal/strategies/${id}`);
        if (!res.ok && res.status !== 204) {
            this.logger.warn(`Engine stop returned ${res.status} for ${id}`);
        }
        return { status: "IDLE", stoppedAt: new Date().toISOString() };
    }
    async pause(id, userId) {
        // R4-01: Atomic check-and-update — only pause if currently RUNNING or PAPER
        const updated = await this.prisma.strategy.updateMany({
            where: { id, userId, status: { in: [client_1.StrategyStatus.RUNNING, client_1.StrategyStatus.PAPER] } },
            data: { status: client_1.StrategyStatus.PAUSED },
        });
        if (updated.count === 0) {
            const strategy = await this.prisma.strategy.findUnique({ where: { id } });
            if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
                throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Strategy not found" });
            }
            if (strategy.userId !== userId) {
                throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
            }
            throw new common_1.ConflictException({ code: "NOT_RUNNING", message: "Strategy is not in a running state" });
        }
        await this.client.post(this.engineUrl, "strategy-engine", `/internal/strategies/${id}/pause`);
        return { status: "PAUSED" };
    }
    async resume(id, userId) {
        // R4-01: Atomic check-and-update — only resume if currently PAUSED
        const updated = await this.prisma.strategy.updateMany({
            where: { id, userId, status: client_1.StrategyStatus.PAUSED },
            data: { status: client_1.StrategyStatus.RUNNING },
        });
        if (updated.count === 0) {
            const strategy = await this.prisma.strategy.findUnique({ where: { id } });
            if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
                throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Strategy not found" });
            }
            if (strategy.userId !== userId) {
                throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
            }
            throw new common_1.ConflictException({ code: "NOT_PAUSED", message: "Strategy is not in PAUSED state" });
        }
        await this.client.post(this.engineUrl, "strategy-engine", `/internal/strategies/${id}/resume`);
        return { status: "RUNNING" };
    }
    async fork(id, userId) {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Strategy not found",
            });
        }
        if (strategy.visibility === client_1.StrategyVisibility.PRIVATE &&
            strategy.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Cannot fork a private strategy",
            });
        }
        const count = await this.prisma.strategy.count({
            where: { userId, status: { not: client_1.StrategyStatus.ARCHIVED } },
        });
        if (count >= MAX_STRATEGIES) {
            throw new common_1.UnprocessableEntityException({
                code: "STRATEGY_LIMIT_REACHED",
                message: "Strategy limit reached",
            });
        }
        return this.prisma.strategy.create({
            data: {
                userId,
                name: `Fork of ${strategy.name}`,
                description: strategy.description,
                visibility: client_1.StrategyVisibility.PRIVATE,
                execMode: strategy.execMode,
                tickMs: strategy.tickMs,
                triggers: strategy.triggers,
                conditions: strategy.conditions,
                actions: strategy.actions,
                safety: strategy.safety,
                tags: strategy.tags ?? [],
                status: client_1.StrategyStatus.IDLE,
                version: 1,
                template: false,
                forkedFromId: id,
            },
        });
    }
    async like(id, userId) {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.visibility === client_1.StrategyVisibility.PRIVATE) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Strategy not found",
            });
        }
        // StrategyLike composite PK: [userId, strategyId]
        const existing = await this.prisma.strategyLike.findUnique({
            where: { userId_strategyId: { userId, strategyId: id } },
        });
        // Use transaction to consolidate 4-5 DB calls into 2
        return this.prisma.$transaction(async (tx) => {
            if (existing) {
                await tx.strategyLike.delete({
                    where: { userId_strategyId: { userId, strategyId: id } },
                });
                const updated = await tx.strategy.update({
                    where: { id },
                    data: { likeCount: { decrement: 1 } },
                    select: { likeCount: true },
                });
                return { liked: false, likeCount: updated.likeCount };
            }
            else {
                await tx.strategyLike.create({
                    data: { userId, strategyId: id },
                });
                const updated = await tx.strategy.update({
                    where: { id },
                    data: { likeCount: { increment: 1 } },
                    select: { likeCount: true },
                });
                return { liked: true, likeCount: updated.likeCount };
            }
        });
    }
    async listComments(id, query) {
        const { page, limit } = query;
        const skip = (page - 1) * limit;
        const [comments, total] = await Promise.all([
            this.prisma.strategyComment.findMany({
                where: { strategyId: id, deleted: false },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, username: true, displayName: true } },
                },
            }),
            this.prisma.strategyComment.count({
                where: { strategyId: id, deleted: false },
            }),
        ]);
        return (0, pagination_dto_1.paginate)(comments, total, page, limit);
    }
    async addComment(id, userId, dto) {
        await this.findOne(id, userId);
        // R5-03: Strip HTML tags from comment content to prevent XSS
        const sanitizedContent = dto.content.replace(/<[^>]*>/g, '');
        return this.prisma.strategyComment.create({
            data: { strategyId: id, userId, content: sanitizedContent },
            include: {
                user: { select: { id: true, username: true, displayName: true } },
            },
        });
    }
    async deleteComment(strategyId, commentId, userId) {
        const comment = await this.prisma.strategyComment.findUnique({
            where: { id: commentId },
        });
        if (!comment || comment.strategyId !== strategyId) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Comment not found",
            });
        }
        if (comment.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Not the comment author",
            });
        }
        await this.prisma.strategyComment.update({
            where: { id: commentId },
            data: { deleted: true },
        });
    }
    async report(id, userId, dto) {
        await this.findOne(id, userId);
        // Report model: reporterId, targetType, targetId, strategyId, reason, description
        const report = await this.prisma.report.create({
            data: {
                reporterId: userId,
                targetType: "STRATEGY",
                targetId: id,
                strategyId: id,
                reason: dto.reason,
                description: dto.description,
            },
        });
        return { reportId: report.id };
    }
    async listChildren(id, userId) {
        await this.getOwned(id, userId);
        const children = await this.prisma.strategy.findMany({
            where: { parentStrategyId: id, status: { not: client_1.StrategyStatus.ARCHIVED } },
            select: { id: true, name: true, status: true },
            orderBy: { createdAt: "desc" },
        });
        return { children };
    }
    async listTemplates(query) {
        const { page, limit } = query;
        const skip = (page - 1) * limit;
        const [templates, total] = await Promise.all([
            this.prisma.strategy.findMany({
                where: { template: true, status: { not: client_1.StrategyStatus.ARCHIVED } },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.strategy.count({
                where: { template: true, status: { not: client_1.StrategyStatus.ARCHIVED } },
            }),
        ]);
        return (0, pagination_dto_1.paginate)(templates, total, page, limit);
    }
    async exportStrategy(id, userId) {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Strategy not found",
            });
        }
        const isOwner = strategy.userId === userId;
        if (strategy.visibility === client_1.StrategyVisibility.PRIVATE &&
            !isOwner) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        const payload = {
            polyforge: "1.0",
            exportedAt: new Date().toISOString(),
            strategy: {
                name: strategy.name,
                description: strategy.description ?? "",
                execMode: strategy.execMode,
                tickMs: strategy.tickMs,
                visibility: strategy.visibility,
                tags: strategy.tags ?? [],
                variables: strategy.variables ?? [],
                blocks: {
                    safety: strategy.safety ?? [],
                    triggers: strategy.triggers ?? [],
                    conditions: strategy.conditions ?? [],
                    actions: strategy.actions ?? [],
                },
                // Only include canvas layout for the owner
                ...(isOwner && strategy.canvas
                    ? { canvas: strategy.canvas }
                    : {}),
            },
        };
        const safeName = strategy.name
            .replace(/[^a-zA-Z0-9_-]/g, "-")
            .replace(/-+/g, "-")
            .toLowerCase();
        const filename = `${safeName}.polyforge`;
        return { payload, filename };
    }
    async importStrategy(dto, userId) {
        const count = await this.prisma.strategy.count({
            where: { userId, status: { not: client_1.StrategyStatus.ARCHIVED } },
        });
        if (count >= MAX_STRATEGIES) {
            throw new common_1.UnprocessableEntityException({
                code: "STRATEGY_LIMIT_REACHED",
                message: "Strategy limit reached",
            });
        }
        const s = dto.strategy;
        const blocks = s.blocks ?? {};
        // ── Import validation (R3-M3) ──────────────────────────────────────────
        // Max total block count: 100
        const totalBlocks = (Array.isArray(blocks.triggers) ? blocks.triggers.length : 0) +
            (Array.isArray(blocks.conditions) ? blocks.conditions.length : 0) +
            (Array.isArray(blocks.actions) ? blocks.actions.length : 0) +
            (Array.isArray(blocks.safety) ? blocks.safety.length : 0);
        if (totalBlocks > 100) {
            throw new common_1.UnprocessableEntityException({
                code: "IMPORT_TOO_MANY_BLOCKS",
                message: `Import exceeds maximum block count (${totalBlocks} > 100)`,
            });
        }
        // Validate variables: max expression length 200 chars
        const variables = Array.isArray(s.variables) ? s.variables : [];
        for (const v of variables) {
            if (typeof v.expression === "string" && v.expression.length > 200) {
                throw new common_1.UnprocessableEntityException({
                    code: "IMPORT_EXPRESSION_TOO_LONG",
                    message: `Variable "${v.name}" expression exceeds 200 characters`,
                });
            }
        }
        // Validate block types against known types
        const KNOWN_BLOCK_TYPES = new Set([
            // Safety (engine registry names)
            "DAILY_LOSS_LIMIT", "CONSECUTIVE_LOSS", "MAX_POSITION_SIZE",
            "EXPOSURE_EXCEEDS", "LOSS_STREAK", "WIN_STREAK", "ORDERS_PER_MIN",
            "BETS_TODAY_LESS_THAN",
            // Safety (UI names)
            "STOP_IF_DAILY_LOSS", "STOP_IF_CONSECUTIVE_LOSSES", "STOP_IF_DRAWDOWN",
            "STOP_IF_POSITION_SIZE", "MAX_DAILY_BETS",
            // Triggers
            "PRICE_ABOVE", "PRICE_BELOW", "PRICE_CROSSES_UP", "PRICE_CROSSES_DOWN",
            "PRICE_IN_RANGE", "SPREAD_ABOVE", "TICK", "WAIT", "PAUSE_AFTER_FILL",
            "PRICE_CHANGE_PCT", "VOLUME_SPIKE", "TIME_WINDOW", "TIME_IN_WINDOW",
            // Conditions
            "POSITION_OPEN", "NO_POSITION", "POSITION_SIZE_BELOW", "NO_RECENT_BET",
            "LIQUIDITY_ABOVE", "MIN_LIQUIDITY", "MIN_PRICE", "MAX_PRICE",
            "MAX_SPREAD", "SPREAD_BELOW", "MARKET_OPEN", "MARKET_RESOLVED",
            "MARKET_RESOLVING", "DAILY_LOSS_BELOW", "TIME_BETWEEN",
            // Actions
            "BUY", "SELL", "BUY_YES", "BUY_NO", "SELL_YES", "SELL_NO",
            "CLOSE_POSITION", "SET_STOP_LOSS", "SET_TAKE_PROFIT", "TAKE_PROFIT",
            "SCALE_IN", "SCALE_OUT", "CANCEL_ALL_ORDERS", "NOTIFY", "RUN_STRATEGY",
            // Logic
            "IF_THEN_ELSE", "AND_GATE", "OR_GATE", "NOT_GATE", "DELAY",
            // Calc
            "MATH", "AGGREGATION", "COMPARISON", "ABS_ROUND",
        ]);
        const allBlocks = [
            ...(Array.isArray(blocks.triggers) ? blocks.triggers : []),
            ...(Array.isArray(blocks.conditions) ? blocks.conditions : []),
            ...(Array.isArray(blocks.actions) ? blocks.actions : []),
            ...(Array.isArray(blocks.safety) ? blocks.safety : []),
        ];
        for (const block of allBlocks) {
            if (block && typeof block.type === "string" && !KNOWN_BLOCK_TYPES.has(block.type) && !KNOWN_BLOCK_TYPES.has(block.type.toUpperCase())) {
                throw new common_1.UnprocessableEntityException({
                    code: "IMPORT_UNKNOWN_BLOCK_TYPE",
                    message: `Unknown block type: ${block.type}`,
                });
            }
        }
        // Strip HTML from name/description
        const stripHtml = (str) => str.replace(/<[^>]*>/g, "");
        if (s.name)
            s.name = stripHtml(s.name);
        if (s.description)
            s.description = stripHtml(s.description);
        // ── End import validation ──────────────────────────────────────────────
        return this.prisma.strategy.create({
            data: {
                userId,
                name: s.name,
                description: s.description ?? "",
                visibility: client_1.StrategyVisibility.PRIVATE,
                execMode: s.execMode ?? client_1.ExecMode.TICK,
                tickMs: s.tickMs ?? 1000,
                triggers: (blocks.triggers ?? []),
                conditions: (blocks.conditions ??
                    []),
                actions: (blocks.actions ?? []),
                safety: (blocks.safety ?? []),
                tags: s.tags ?? [],
                canvas: s.canvas,
                status: client_1.StrategyStatus.IDLE,
                version: 1,
                template: false,
            },
        });
    }
    async createFromDescription(userId, dto) {
        const blockTypes = [
            "Safety: DAILY_LOSS_LIMIT, CONSECUTIVE_LOSS, MAX_POSITION_SIZE, STOP_IF_DRAWDOWN, MAX_DAILY_BETS",
            "Triggers: PRICE_ABOVE, PRICE_BELOW, PRICE_CROSSES_UP, PRICE_CROSSES_DOWN, PRICE_IN_RANGE, SPREAD_ABOVE, TICK, WAIT, PAUSE_AFTER_FILL, PRICE_CHANGE_PCT, VOLUME_SPIKE, TIME_WINDOW",
            "Conditions: POSITION_OPEN, NO_POSITION, POSITION_SIZE_BELOW, NO_RECENT_BET, LIQUIDITY_ABOVE, MIN_LIQUIDITY, MIN_PRICE, MAX_PRICE, MAX_SPREAD, SPREAD_BELOW, MARKET_OPEN, DAILY_LOSS_BELOW",
            "Actions: BUY, SELL, BUY_YES, BUY_NO, SELL_YES, SELL_NO, CLOSE_POSITION, SET_STOP_LOSS, SET_TAKE_PROFIT, SCALE_IN, SCALE_OUT, CANCEL_ALL_ORDERS, NOTIFY, RUN_STRATEGY",
            "Logic: IF_THEN_ELSE, AND_GATE, OR_GATE, NOT_GATE, DELAY",
            "Calc: MATH, AGGREGATION, COMPARISON, ABS_ROUND",
        ].join("\n");
        const prompt = [
            `Given this trading strategy description: "${dto.description}"`,
            "",
            "Generate a Polyforge strategy configuration with blocks.",
            `Available block types:\n${blockTypes}`,
            "",
            "Return ONLY valid JSON (no markdown, no explanation):",
            '{ "name": "string", "description": "string", "execMode": "TICK"|"EVENT"|"HYBRID",',
            '  "safety": [{ "type": "BLOCK_TYPE", "config": {...} }],',
            '  "triggers": [{ "type": "BLOCK_TYPE", "config": {...} }],',
            '  "conditions": [{ "type": "BLOCK_TYPE", "config": {...} }],',
            '  "actions": [{ "type": "BLOCK_TYPE", "config": {...} }] }',
        ].join("\n");
        const raw = await this.llm.analyze(prompt);
        // Extract JSON from response (handle potential markdown wrapping)
        let jsonStr = raw.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch)
            jsonStr = jsonMatch[1].trim();
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        }
        catch {
            throw new common_1.UnprocessableEntityException({
                code: "LLM_PARSE_ERROR",
                message: "Failed to parse LLM response as valid strategy JSON",
            });
        }
        // Validate block types against known types
        const KNOWN = new Set([
            "DAILY_LOSS_LIMIT", "CONSECUTIVE_LOSS", "MAX_POSITION_SIZE",
            "EXPOSURE_EXCEEDS", "LOSS_STREAK", "WIN_STREAK", "ORDERS_PER_MIN",
            "BETS_TODAY_LESS_THAN", "STOP_IF_DAILY_LOSS", "STOP_IF_CONSECUTIVE_LOSSES",
            "STOP_IF_DRAWDOWN", "STOP_IF_POSITION_SIZE", "MAX_DAILY_BETS",
            "PRICE_ABOVE", "PRICE_BELOW", "PRICE_CROSSES_UP", "PRICE_CROSSES_DOWN",
            "PRICE_IN_RANGE", "SPREAD_ABOVE", "TICK", "WAIT", "PAUSE_AFTER_FILL",
            "PRICE_CHANGE_PCT", "VOLUME_SPIKE", "TIME_WINDOW", "TIME_IN_WINDOW",
            "POSITION_OPEN", "NO_POSITION", "POSITION_SIZE_BELOW", "NO_RECENT_BET",
            "LIQUIDITY_ABOVE", "MIN_LIQUIDITY", "MIN_PRICE", "MAX_PRICE",
            "MAX_SPREAD", "SPREAD_BELOW", "MARKET_OPEN", "MARKET_RESOLVED",
            "MARKET_RESOLVING", "DAILY_LOSS_BELOW", "TIME_BETWEEN",
            "BUY", "SELL", "BUY_YES", "BUY_NO", "SELL_YES", "SELL_NO",
            "CLOSE_POSITION", "SET_STOP_LOSS", "SET_TAKE_PROFIT", "TAKE_PROFIT",
            "SCALE_IN", "SCALE_OUT", "CANCEL_ALL_ORDERS", "NOTIFY", "RUN_STRATEGY",
            "IF_THEN_ELSE", "AND_GATE", "OR_GATE", "NOT_GATE", "DELAY",
            "MATH", "AGGREGATION", "COMPARISON", "ABS_ROUND",
        ]);
        const allBlocks = [
            ...(parsed.safety ?? []),
            ...(parsed.triggers ?? []),
            ...(parsed.conditions ?? []),
            ...(parsed.actions ?? []),
        ];
        const invalidTypes = allBlocks
            .filter((b) => b?.type && !KNOWN.has(b.type))
            .map((b) => b.type);
        if (invalidTypes.length > 0) {
            throw new common_1.UnprocessableEntityException({
                code: "LLM_INVALID_BLOCKS",
                message: `LLM generated unknown block types: ${invalidTypes.join(", ")}`,
            });
        }
        // Create the strategy via existing create method
        return this.create(userId, {
            name: parsed.name ?? "AI-Generated Strategy",
            description: parsed.description ?? dto.description,
            execMode: (["TICK", "EVENT", "HYBRID"].includes(parsed.execMode ?? "") ? parsed.execMode : "TICK"),
            safety: parsed.safety ?? [],
            triggers: parsed.triggers ?? [],
            conditions: parsed.conditions ?? [],
            actions: parsed.actions ?? [],
        });
    }
    async getOwned(id, userId) {
        const strategy = await this.prisma.strategy.findUnique({ where: { id } });
        if (!strategy || strategy.status === client_1.StrategyStatus.ARCHIVED) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Strategy not found",
            });
        }
        if (strategy.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        return strategy;
    }
};
exports.StrategiesService = StrategiesService;
exports.StrategiesService = StrategiesService = StrategiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        config_1.ConfigService,
        internal_client_service_1.InternalClientService,
        llm_service_1.LlmService])
], StrategiesService);
//# sourceMappingURL=strategies.service.js.map