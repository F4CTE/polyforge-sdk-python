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
var CopyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const client_1 = require("@prisma/client");
const MAX_ACTIVE_CONFIGS = 10;
let CopyService = CopyService_1 = class CopyService {
    prisma;
    logger = new common_1.Logger(CopyService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ─── Create ──────────────────────────────────────────────────────────────────
    async create(userId, dto) {
        // Check active config limit
        const activeCount = await this.prisma.copyConfig.count({
            where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        });
        if (activeCount >= MAX_ACTIVE_CONFIGS) {
            throw new common_1.BadRequestException(`Maximum of ${MAX_ACTIVE_CONFIGS} active copy configs allowed`);
        }
        // Check duplicate wallet
        const existing = await this.prisma.copyConfig.findUnique({
            where: { userId_targetWallet: { userId, targetWallet: dto.targetWallet } },
        });
        if (existing && existing.status !== "STOPPED") {
            throw new common_1.ConflictException("You already have an active copy config for this wallet");
        }
        const data = {
            user: { connect: { id: userId } },
            targetWallet: dto.targetWallet,
            mode: dto.mode ?? "PERCENTAGE",
            ...(dto.sizeValue && { sizeValue: new client_1.Prisma.Decimal(dto.sizeValue) }),
            ...(dto.maxExposure && { maxExposure: new client_1.Prisma.Decimal(dto.maxExposure) }),
            ...(dto.maxDailyLoss && { maxDailyLoss: new client_1.Prisma.Decimal(dto.maxDailyLoss) }),
            ...(dto.priceOffset && { priceOffset: new client_1.Prisma.Decimal(dto.priceOffset) }),
        };
        // If there was a STOPPED config for the same wallet, delete it first
        if (existing && existing.status === "STOPPED") {
            await this.prisma.copyTrade.deleteMany({ where: { configId: existing.id } });
            await this.prisma.copyConfig.delete({ where: { id: existing.id } });
        }
        const config = await this.prisma.copyConfig.create({ data });
        this.logger.log(`Copy config created: ${config.id} for wallet ${dto.targetWallet}`);
        return config;
    }
    // ─── List ────────────────────────────────────────────────────────────────────
    async list(userId) {
        const configs = await this.prisma.copyConfig.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { trades: true } },
            },
        });
        return configs;
    }
    // ─── Detail ──────────────────────────────────────────────────────────────────
    async getDetail(id, userId) {
        const config = await this.prisma.copyConfig.findUnique({
            where: { id },
            include: {
                trades: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
            },
        });
        if (!config)
            throw new common_1.NotFoundException("Copy config not found");
        if (config.userId !== userId)
            throw new common_1.ForbiddenException();
        return config;
    }
    // ─── Update ──────────────────────────────────────────────────────────────────
    async update(id, userId, dto) {
        const config = await this.findOwnedConfig(id, userId);
        const data = {};
        if (dto.mode)
            data.mode = dto.mode;
        if (dto.sizeValue)
            data.sizeValue = new client_1.Prisma.Decimal(dto.sizeValue);
        if (dto.maxExposure)
            data.maxExposure = new client_1.Prisma.Decimal(dto.maxExposure);
        if (dto.maxDailyLoss)
            data.maxDailyLoss = new client_1.Prisma.Decimal(dto.maxDailyLoss);
        if (dto.priceOffset !== undefined)
            data.priceOffset = new client_1.Prisma.Decimal(dto.priceOffset);
        return this.prisma.copyConfig.update({ where: { id }, data });
    }
    // ─── Pause ───────────────────────────────────────────────────────────────────
    async pause(id, userId) {
        const config = await this.findOwnedConfig(id, userId);
        if (config.status !== "ACTIVE") {
            throw new common_1.BadRequestException("Only ACTIVE configs can be paused");
        }
        return this.prisma.copyConfig.update({
            where: { id },
            data: { status: "PAUSED" },
        });
    }
    // ─── Resume ──────────────────────────────────────────────────────────────────
    async resume(id, userId) {
        const config = await this.findOwnedConfig(id, userId);
        if (config.status !== "PAUSED") {
            throw new common_1.BadRequestException("Only PAUSED configs can be resumed");
        }
        return this.prisma.copyConfig.update({
            where: { id },
            data: { status: "ACTIVE" },
        });
    }
    // ─── Stop ────────────────────────────────────────────────────────────────────
    async stop(id, userId) {
        const config = await this.findOwnedConfig(id, userId);
        if (config.status === "STOPPED") {
            throw new common_1.BadRequestException("Config is already stopped");
        }
        return this.prisma.copyConfig.update({
            where: { id },
            data: { status: "STOPPED", stoppedAt: new Date() },
        });
    }
    // ─── Trades ──────────────────────────────────────────────────────────────────
    async getTrades(id, userId, page, limit) {
        await this.findOwnedConfig(id, userId);
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.copyTrade.findMany({
                where: { configId: id },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            this.prisma.copyTrade.count({ where: { configId: id } }),
        ]);
        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // ─── Helpers ─────────────────────────────────────────────────────────────────
    async findOwnedConfig(id, userId) {
        const config = await this.prisma.copyConfig.findUnique({ where: { id } });
        if (!config)
            throw new common_1.NotFoundException("Copy config not found");
        if (config.userId !== userId)
            throw new common_1.ForbiddenException();
        return config;
    }
};
exports.CopyService = CopyService;
exports.CopyService = CopyService = CopyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], CopyService);
//# sourceMappingURL=copy.service.js.map