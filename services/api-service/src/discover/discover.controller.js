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
exports.DiscoverController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const class_validator_1 = require("class-validator");
const discover_service_1 = require("./discover.service");
const pagination_dto_1 = require("../common/dto/pagination.dto");
class DiscoverQueryDto extends pagination_dto_1.PaginationDto {
    sort = "popular";
    category;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["popular", "newest", "top_pnl", "most_forked"]),
    __metadata("design:type", String)
], DiscoverQueryDto.prototype, "sort", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DiscoverQueryDto.prototype, "category", void 0);
class LeaderboardQueryDto extends pagination_dto_1.PaginationDto {
    period = "30d";
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["7d", "30d", "allTime"]),
    __metadata("design:type", String)
], LeaderboardQueryDto.prototype, "period", void 0);
let DiscoverController = class DiscoverController {
    discover;
    constructor(discover) {
        this.discover = discover;
    }
    getDiscover(user, query) {
        return this.discover.discover(user.sub, query);
    }
    getLeaderboard(query) {
        return this.discover.leaderboard(query);
    }
};
exports.DiscoverController = DiscoverController;
__decorate([
    (0, common_1.Get)("discover"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DiscoverQueryDto]),
    __metadata("design:returntype", void 0)
], DiscoverController.prototype, "getDiscover", null);
__decorate([
    (0, common_1.Get)("leaderboard"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LeaderboardQueryDto]),
    __metadata("design:returntype", void 0)
], DiscoverController.prototype, "getLeaderboard", null);
exports.DiscoverController = DiscoverController = __decorate([
    (0, swagger_1.ApiTags)("discover"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [discover_service_1.DiscoverService])
], DiscoverController);
//# sourceMappingURL=discover.controller.js.map