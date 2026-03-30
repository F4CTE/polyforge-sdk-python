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
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const MAX_ALERTS = 50;
let AlertsService = class AlertsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId) {
        return this.prisma.priceAlert.findMany({
            where: { userId, triggered: false },
            orderBy: { createdAt: "desc" },
        });
    }
    async create(userId, dto) {
        const count = await this.prisma.priceAlert.count({
            where: { userId, triggered: false },
        });
        if (count >= MAX_ALERTS) {
            throw new common_1.UnprocessableEntityException({
                code: "ALERT_LIMIT_REACHED",
                message: "Maximum 50 alerts allowed",
            });
        }
        return this.prisma.priceAlert.create({
            data: {
                userId,
                tokenId: dto.tokenId,
                direction: dto.direction,
                price: dto.price,
                persistent: dto.persistent ?? false,
            },
        });
    }
    async remove(id, userId) {
        const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
        if (!alert)
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Alert not found",
            });
        if (alert.userId !== userId)
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        await this.prisma.priceAlert.delete({ where: { id } });
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map