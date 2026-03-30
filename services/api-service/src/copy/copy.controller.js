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
exports.CopyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const copy_service_1 = require("./copy.service");
const create_copy_dto_1 = require("./dto/create-copy.dto");
const update_copy_dto_1 = require("./dto/update-copy.dto");
let CopyController = class CopyController {
    copy;
    constructor(copy) {
        this.copy = copy;
    }
    create(user, dto) {
        return this.copy.create(user.sub, dto);
    }
    list(user) {
        return this.copy.list(user.sub);
    }
    getDetail(user, id) {
        return this.copy.getDetail(id, user.sub);
    }
    update(user, id, dto) {
        return this.copy.update(id, user.sub, dto);
    }
    pause(user, id) {
        return this.copy.pause(id, user.sub);
    }
    resume(user, id) {
        return this.copy.resume(id, user.sub);
    }
    stop(user, id) {
        return this.copy.stop(id, user.sub);
    }
    getTrades(user, id, page, limit) {
        return this.copy.getTrades(id, user.sub, parseInt(page ?? "1", 10), Math.min(parseInt(limit ?? "20", 10), 100));
    }
};
exports.CopyController = CopyController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_copy_dto_1.CreateCopyDto]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Patch)(":id"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_copy_dto_1.UpdateCopyDto]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(":id/pause"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)(":id/resume"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "resume", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "stop", null);
__decorate([
    (0, common_1.Get)(":id/trades"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Query)("page")),
    __param(3, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CopyController.prototype, "getTrades", null);
exports.CopyController = CopyController = __decorate([
    (0, swagger_1.ApiTags)("copy"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("copy"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [copy_service_1.CopyService])
], CopyController);
//# sourceMappingURL=copy.controller.js.map