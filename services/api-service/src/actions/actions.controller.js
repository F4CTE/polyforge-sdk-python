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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const actions_service_1 = require("./actions.service");
/**
 * Public endpoint — no auth required.
 * Returns a structured list of all available API actions so AI agents can
 * discover capabilities programmatically.
 */
let ActionsController = class ActionsController {
    actionsService;
    constructor(actionsService) {
        this.actionsService = actionsService;
    }
    getActions() {
        return this.actionsService.getActions();
    }
};
exports.ActionsController = ActionsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ActionsController.prototype, "getActions", null);
exports.ActionsController = ActionsController = __decorate([
    (0, swagger_1.ApiTags)("actions"),
    (0, common_1.Controller)("actions"),
    __metadata("design:paramtypes", [actions_service_1.ActionsService])
], ActionsController);
//# sourceMappingURL=actions.controller.js.map