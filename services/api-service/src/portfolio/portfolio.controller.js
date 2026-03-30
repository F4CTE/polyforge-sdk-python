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
exports.PortfolioController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const class_validator_1 = require("class-validator");
const portfolio_service_1 = require("./portfolio.service");
class PnlQueryDto {
    period = "30d";
    strategyId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["7d", "30d", "90d", "allTime"]),
    __metadata("design:type", String)
], PnlQueryDto.prototype, "period", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PnlQueryDto.prototype, "strategyId", void 0);
let PortfolioController = class PortfolioController {
    portfolio;
    constructor(portfolio) {
        this.portfolio = portfolio;
    }
    getPortfolio(user) {
        return this.portfolio.getPortfolio(user.sub);
    }
    getPnl(user, query) {
        return this.portfolio.getPnl(user.sub, query.period ?? "30d", query.strategyId);
    }
};
exports.PortfolioController = PortfolioController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortfolioController.prototype, "getPortfolio", null);
__decorate([
    (0, common_1.Get)("pnl"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PnlQueryDto]),
    __metadata("design:returntype", void 0)
], PortfolioController.prototype, "getPnl", null);
exports.PortfolioController = PortfolioController = __decorate([
    (0, swagger_1.ApiTags)("portfolio"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("portfolio"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [portfolio_service_1.PortfolioService])
], PortfolioController);
//# sourceMappingURL=portfolio.controller.js.map