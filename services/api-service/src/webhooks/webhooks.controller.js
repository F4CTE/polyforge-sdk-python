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
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const webhooks_service_1 = require("./webhooks.service");
const create_webhook_dto_1 = require("./dto/create-webhook.dto");
let WebhooksController = class WebhooksController {
    webhooks;
    constructor(webhooks) {
        this.webhooks = webhooks;
    }
    create(user, dto) {
        return this.webhooks.create(user.sub, dto);
    }
    list(user) {
        return this.webhooks.list(user.sub);
    }
    remove(id, user) {
        return this.webhooks.remove(id, user.sub);
    }
    test(id, user) {
        return this.webhooks.test(id, user.sub);
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)("WRITE"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_webhook_dto_1.CreateWebhookDto]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)("WRITE"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(":id/test"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)("WRITE"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WebhooksController.prototype, "test", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, swagger_1.ApiTags)("webhooks"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("webhooks"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map