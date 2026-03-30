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
exports.BacktestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const class_validator_1 = require("class-validator");
const backtests_service_1 = require("./backtests.service");
const create_backtest_dto_1 = require("./dto/create-backtest.dto");
const pagination_dto_1 = require("../common/dto/pagination.dto");
class BacktestQueryDto extends pagination_dto_1.PaginationDto {
    strategyId;
    status;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BacktestQueryDto.prototype, "strategyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BacktestQueryDto.prototype, "status", void 0);
let BacktestsController = class BacktestsController {
    backtests;
    constructor(backtests) {
        this.backtests = backtests;
    }
    list(user, query) {
        return this.backtests.list(user.sub, query);
    }
    create(user, dto) {
        return this.backtests.create(user.sub, dto);
    }
    quick(user, dto) {
        return this.backtests.create(user.sub, { ...dto, quickMode: true });
    }
    findOne(id, user) {
        return this.backtests.findOne(id, user.sub);
    }
};
exports.BacktestsController = BacktestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BacktestQueryDto]),
    __metadata("design:returntype", void 0)
], BacktestsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_backtest_dto_1.CreateBacktestDto]),
    __metadata("design:returntype", void 0)
], BacktestsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)("quick"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_backtest_dto_1.CreateBacktestDto]),
    __metadata("design:returntype", void 0)
], BacktestsController.prototype, "quick", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BacktestsController.prototype, "findOne", null);
exports.BacktestsController = BacktestsController = __decorate([
    (0, swagger_1.ApiTags)("backtests"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("backtests"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [backtests_service_1.BacktestsService])
], BacktestsController);
//# sourceMappingURL=backtests.controller.js.map