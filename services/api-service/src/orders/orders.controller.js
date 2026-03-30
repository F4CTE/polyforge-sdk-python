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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const shared_auth_1 = require("@polyforge/shared-auth");
const class_validator_1 = require("class-validator");
const orders_service_1 = require("./orders.service");
const close_position_dto_1 = require("./dto/close-position.dto");
const place_order_dto_1 = require("./dto/place-order.dto");
const redeem_position_dto_1 = require("./dto/redeem-position.dto");
const geo_guard_1 = require("../common/guards/geo.guard");
const pagination_dto_1 = require("../common/dto/pagination.dto");
class OrderQueryDto extends pagination_dto_1.PaginationDto {
    status;
    strategyId;
    from;
    to;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderQueryDto.prototype, "strategyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderQueryDto.prototype, "to", void 0);
class SplitPositionDto {
    tokenId;
    amount;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SplitPositionDto.prototype, "tokenId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: "amount must be a valid positive number" }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SplitPositionDto.prototype, "amount", void 0);
class MergePositionDto {
    tokenId;
    amount;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], MergePositionDto.prototype, "tokenId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: "amount must be a valid positive number" }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MergePositionDto.prototype, "amount", void 0);
let OrdersController = class OrdersController {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    list(user, query) {
        return this.orders.list(user.sub, query);
    }
    closePosition(user, dto) {
        return this.orders.closePosition(user.sub, dto);
    }
    redeemPosition(user, dto) {
        return this.orders.redeemPosition(user.sub, dto);
    }
    /** Split USDC.e into Yes + No outcome tokens */
    splitPosition(user, dto) {
        return this.orders.splitPosition(user.sub, dto);
    }
    /** Merge Yes + No outcome tokens back into USDC.e */
    mergePosition(user, dto) {
        return this.orders.mergePosition(user.sub, dto);
    }
    async placeOrder(req, dto) {
        return this.orders.placeOrder(req.user.sub, dto);
    }
    async cancelOrder(req, id) {
        return this.orders.cancelOrder(req.user.sub, id);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, OrderQueryDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("close-position"),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard, geo_guard_1.GeoBlockGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, close_position_dto_1.ClosePositionDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "closePosition", null);
__decorate([
    (0, common_1.Post)("redeem"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard, geo_guard_1.GeoBlockGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, redeem_position_dto_1.RedeemPositionDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "redeemPosition", null);
__decorate([
    (0, common_1.Post)("split"),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard, geo_guard_1.GeoBlockGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SplitPositionDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "splitPosition", null);
__decorate([
    (0, common_1.Post)("merge"),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard, geo_guard_1.GeoBlockGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MergePositionDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "mergePosition", null);
__decorate([
    (0, common_1.Post)('place'),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, place_order_dto_1.PlaceOrderDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "placeOrder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancelOrder", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)("orders"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("orders"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map