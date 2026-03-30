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
exports.MarketsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const markets_service_1 = require("./markets.service");
const market_query_dto_1 = require("./dto/market-query.dto");
let MarketsController = class MarketsController {
    markets;
    constructor(markets) {
        this.markets = markets;
    }
    list(query) {
        return this.markets.list(query);
    }
    findOne(marketId) {
        return this.markets.findOne(marketId);
    }
    priceHistory(tokenId, query) {
        return this.markets.priceHistory(tokenId, query);
    }
    orderBook(tokenId) {
        return this.markets.orderBook(tokenId);
    }
};
exports.MarketsController = MarketsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [market_query_dto_1.MarketQueryDto]),
    __metadata("design:returntype", void 0)
], MarketsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":marketId"),
    __param(0, (0, common_1.Param)("marketId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MarketsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(":tokenId/price-history"),
    __param(0, (0, common_1.Param)("tokenId")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, market_query_dto_1.PriceHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], MarketsController.prototype, "priceHistory", null);
__decorate([
    (0, common_1.Get)(":tokenId/book"),
    __param(0, (0, common_1.Param)("tokenId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MarketsController.prototype, "orderBook", null);
exports.MarketsController = MarketsController = __decorate([
    (0, swagger_1.ApiTags)("markets"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("markets"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [markets_service_1.MarketsService])
], MarketsController);
//# sourceMappingURL=markets.controller.js.map