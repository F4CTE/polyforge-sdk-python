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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const settings_service_1 = require("./settings.service");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const update_password_dto_1 = require("./dto/update-password.dto");
const update_notifications_dto_1 = require("./dto/update-notifications.dto");
let SettingsController = class SettingsController {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    updateProfile(user, dto) {
        return this.settings.updateProfile(user.sub, dto);
    }
    getNotifications(user) {
        return this.settings.getNotifications(user.sub);
    }
    updateNotifications(user, dto) {
        return this.settings.updateNotifications(user.sub, dto);
    }
    updatePassword(user, dto) {
        return this.settings.updatePassword(user.sub, dto);
    }
    getGasUsage(user) {
        return this.settings.getGasUsage(user.sub);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Patch)("profile"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)("notifications"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Patch)("notifications"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_notifications_dto_1.UpdateNotificationsDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateNotifications", null);
__decorate([
    (0, common_1.Patch)("password"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_password_dto_1.UpdatePasswordDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updatePassword", null);
__decorate([
    (0, common_1.Get)("gas"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getGasUsage", null);
exports.SettingsController = SettingsController = __decorate([
    (0, swagger_1.ApiTags)("settings"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("settings"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map