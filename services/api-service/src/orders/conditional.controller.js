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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const class_validator_1 = require("class-validator");
const shared_db_1 = require("@polyforge/shared-db");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const create_conditional_order_dto_1 = require("./dto/create-conditional-order.dto");
class ConditionalOrderQueryDto extends pagination_dto_1.PaginationDto {
    status;
    type;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["PENDING", "TRIGGERED", "CANCELLED", "EXPIRED"]),
    __metadata("design:type", String)
], ConditionalOrderQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["TAKE_PROFIT", "STOP_LOSS", "TRAILING_STOP", "LIMIT", "PEGGED"]),
    __metadata("design:type", String)
], ConditionalOrderQueryDto.prototype, "type", void 0);
let ConditionalController = class ConditionalController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(user, dto) {
        // H-01: Enforce per-user cap on pending conditional orders
        const count = await this.prisma.conditionalOrder.count({
            where: { userId: user.sub, status: 'PENDING' },
        });
        if (count >= 50) {
            throw new common_1.UnprocessableEntityException({
                code: 'CONDITIONAL_ORDER_LIMIT',
                message: 'Maximum 50 pending conditional orders',
            });
        }
        const order = await this.prisma.conditionalOrder.create({
            data: {
                userId: user.sub,
                marketId: dto.marketId,
                tokenId: dto.tokenId,
                type: dto.type,
                side: dto.side,
                outcome: dto.outcome,
                size: dto.size,
                triggerPrice: dto.triggerPrice,
                limitPrice: dto.limitPrice ?? null,
                trailingPct: dto.trailingPct ?? null,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            },
        });
        return order;
    }
    async list(user, query) {
        const { page, limit, status, type } = query;
        const skip = (page - 1) * limit;
        const where = { userId: user.sub };
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const [orders, total] = await Promise.all([
            this.prisma.conditionalOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.conditionalOrder.count({ where }),
        ]);
        return (0, pagination_dto_1.paginate)(orders, total, page, limit);
    }
    async detail(user, id) {
        const order = await this.prisma.conditionalOrder.findUnique({
            where: { id },
        });
        if (!order) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Conditional order not found",
            });
        }
        if (order.userId !== user.sub) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Not your order",
            });
        }
        return order;
    }
    async cancel(user, id) {
        const order = await this.prisma.conditionalOrder.findUnique({
            where: { id },
        });
        if (!order) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Conditional order not found",
            });
        }
        if (order.userId !== user.sub) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Not your order",
            });
        }
        const updated = await this.prisma.conditionalOrder.update({
            where: { id },
            data: { status: "CANCELLED" },
        });
        return updated;
    }
};
exports.ConditionalController = ConditionalController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_conditional_order_dto_1.CreateConditionalOrderDto]),
    __metadata("design:returntype", Promise)
], ConditionalController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ConditionalOrderQueryDto]),
    __metadata("design:returntype", Promise)
], ConditionalController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConditionalController.prototype, "detail", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConditionalController.prototype, "cancel", null);
exports.ConditionalController = ConditionalController = __decorate([
    (0, swagger_1.ApiTags)("orders"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("orders/conditional"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], ConditionalController);
//# sourceMappingURL=conditional.controller.js.map