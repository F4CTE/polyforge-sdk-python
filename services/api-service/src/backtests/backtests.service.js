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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestsService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const pagination_dto_1 = require("../common/dto/pagination.dto");
let BacktestsService = class BacktestsService {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async list(userId, query) {
        const { page, limit, strategyId, status } = query;
        const skip = (page - 1) * limit;
        const where = { userId };
        if (strategyId)
            where.strategyId = strategyId;
        if (status)
            where.status = status;
        const [runs, total] = await Promise.all([
            this.prisma.backtestRun.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.backtestRun.count({ where }),
        ]);
        return (0, pagination_dto_1.paginate)(runs, total, page, limit);
    }
    async create(userId, dto) {
        if (dto.quickMode) {
            // Quick mode: return a stub result (backtest-service not yet implemented)
            return {
                totalOrders: 0,
                filledOrders: 0,
                totalPnl: "0.00",
                winRate: "0.00",
                hasDataGaps: false,
            };
        }
        const run = await this.prisma.backtestRun.create({
            data: {
                userId,
                strategyId: dto.strategyId ?? "",
                dateRangeStart: dto.dateRangeStart
                    ? new Date(dto.dateRangeStart)
                    : new Date(0),
                dateRangeEnd: dto.dateRangeEnd
                    ? new Date(dto.dateRangeEnd)
                    : new Date(),
                status: "QUEUED",
            },
        });
        // Publish to stream:backtests so backtest-service picks it up
        await this.redis.xadd("stream:backtests", {
            runId: run.id,
            userId,
            strategyId: dto.strategyId ?? "",
            marketBindings: dto.marketBindings ? JSON.stringify(dto.marketBindings) : "",
            ts: String(Date.now()),
        });
        return { runId: run.id, status: "QUEUED" };
    }
    async findOne(id, userId) {
        const run = await this.prisma.backtestRun.findUnique({ where: { id } });
        if (!run || run.userId !== userId) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Backtest run not found",
            });
        }
        return run;
    }
};
exports.BacktestsService = BacktestsService;
exports.BacktestsService = BacktestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], BacktestsService);
//# sourceMappingURL=backtests.service.js.map