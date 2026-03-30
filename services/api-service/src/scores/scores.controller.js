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
exports.ScoresController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const scores_service_1 = require("./scores.service");
let ScoresController = class ScoresController {
    scores;
    constructor(scores) {
        this.scores = scores;
    }
    getMyScore(user) {
        return this.scores.getMyScore(user.sub);
    }
    getTopTraders() {
        return this.scores.getTopTraders();
    }
    getMyBadges(user) {
        return this.scores.getMyBadges(user.sub);
    }
    getUserScore(userId) {
        return this.scores.getUserScore(userId);
    }
    getUserBadges(userId) {
        return this.scores.getUserBadges(userId);
    }
};
exports.ScoresController = ScoresController;
__decorate([
    (0, common_1.Get)("me"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoresController.prototype, "getMyScore", null);
__decorate([
    (0, common_1.Get)("top"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ScoresController.prototype, "getTopTraders", null);
__decorate([
    (0, common_1.Get)("me/badges"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoresController.prototype, "getMyBadges", null);
__decorate([
    (0, common_1.Get)(":userId"),
    __param(0, (0, common_1.Param)("userId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScoresController.prototype, "getUserScore", null);
__decorate([
    (0, common_1.Get)(":userId/badges"),
    __param(0, (0, common_1.Param)("userId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ScoresController.prototype, "getUserBadges", null);
exports.ScoresController = ScoresController = __decorate([
    (0, swagger_1.ApiTags)("scores"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("scores"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [scores_service_1.ScoresService])
], ScoresController);
//# sourceMappingURL=scores.controller.js.map