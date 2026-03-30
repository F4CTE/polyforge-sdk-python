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
exports.WhalesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const shared_auth_1 = require("@polyforge/shared-auth");
const whales_service_1 = require("./whales.service");
const whale_query_dto_1 = require("./dto/whale-query.dto");
let WhalesController = class WhalesController {
    whales;
    constructor(whales) {
        this.whales = whales;
    }
    getFeed(query) {
        return this.whales.getFeed(query);
    }
    getTopWhales(query) {
        return this.whales.getTopWhales(query);
    }
    getFollowing(user) {
        return this.whales.getFollowing(user.sub);
    }
    getProfile(address) {
        return this.whales.getProfile(address);
    }
    toggleFollow(user, address) {
        return this.whales.toggleFollow(user.sub, address);
    }
};
exports.WhalesController = WhalesController;
__decorate([
    (0, common_1.Get)("feed"),
    (0, throttler_1.Throttle)({ default: { ttl: 60000, limit: 30 } }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whale_query_dto_1.WhaleFeedQueryDto]),
    __metadata("design:returntype", void 0)
], WhalesController.prototype, "getFeed", null);
__decorate([
    (0, common_1.Get)("top"),
    (0, throttler_1.Throttle)({ default: { ttl: 60000, limit: 30 } }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whale_query_dto_1.WhaleTopQueryDto]),
    __metadata("design:returntype", void 0)
], WhalesController.prototype, "getTopWhales", null);
__decorate([
    (0, common_1.Get)("following"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WhalesController.prototype, "getFollowing", null);
__decorate([
    (0, common_1.Get)(":address"),
    __param(0, (0, common_1.Param)("address")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhalesController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)(":address/follow"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("address")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WhalesController.prototype, "toggleFollow", null);
exports.WhalesController = WhalesController = __decorate([
    (0, swagger_1.ApiTags)("whales"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("whales"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [whales_service_1.WhalesService])
], WhalesController);
//# sourceMappingURL=whales.controller.js.map