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
exports.ProfileController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const profile_service_1 = require("./profile.service");
let ProfileController = class ProfileController {
    profile;
    constructor(profile) {
        this.profile = profile;
    }
    updateMyProfile(user, dto) {
        return this.profile.updateProfile(user.sub, dto);
    }
    changePassword(user, dto) {
        return this.profile.changePassword(user.sub, dto);
    }
    updateNotifications(user, dto) {
        return this.profile.updateNotifications(user.sub, dto);
    }
    getProfile(username, user) {
        return this.profile.getProfile(username, user?.sub);
    }
    toggleFollow(username, user) {
        return this.profile.toggleFollow(username, user.sub);
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Patch)("me"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Post)("password"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Patch)("notifications"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "updateNotifications", null);
__decorate([
    (0, common_1.Get)(":username"),
    __param(0, (0, common_1.Param)("username")),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)(":username/follow"),
    __param(0, (0, common_1.Param)("username")),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfileController.prototype, "toggleFollow", null);
exports.ProfileController = ProfileController = __decorate([
    (0, swagger_1.ApiTags)("profile"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("profile"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [profile_service_1.ProfileService])
], ProfileController);
//# sourceMappingURL=profile.controller.js.map