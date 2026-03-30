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
exports.PaperController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const paper_service_1 = require("./paper.service");
let PaperController = class PaperController {
    paper;
    constructor(paper) {
        this.paper = paper;
    }
    getSummary(user) {
        return this.paper.getSummary(user.sub);
    }
    reset(user) {
        return this.paper.reset(user.sub);
    }
};
exports.PaperController = PaperController;
__decorate([
    (0, common_1.Get)("summary"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaperController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Post)("reset"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaperController.prototype, "reset", null);
exports.PaperController = PaperController = __decorate([
    (0, swagger_1.ApiTags)("paper"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("paper"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [paper_service_1.PaperService])
], PaperController);
//# sourceMappingURL=paper.controller.js.map