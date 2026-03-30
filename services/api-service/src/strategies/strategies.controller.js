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
exports.StrategiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const strategies_service_1 = require("./strategies.service");
const strategy_events_service_1 = require("../gateway/strategy-events.service");
const create_strategy_dto_1 = require("./dto/create-strategy.dto");
const update_strategy_dto_1 = require("./dto/update-strategy.dto");
const start_strategy_dto_1 = require("./dto/start-strategy.dto");
const create_comment_dto_1 = require("./dto/create-comment.dto");
const report_strategy_dto_1 = require("./dto/report-strategy.dto");
const strategy_query_dto_1 = require("./dto/strategy-query.dto");
const import_strategy_dto_1 = require("./dto/import-strategy.dto");
const create_from_description_dto_1 = require("./dto/create-from-description.dto");
const pagination_dto_1 = require("../common/dto/pagination.dto");
let StrategiesController = class StrategiesController {
    strategies;
    strategyEvents;
    constructor(strategies, strategyEvents) {
        this.strategies = strategies;
        this.strategyEvents = strategyEvents;
    }
    listTemplates(query) {
        return this.strategies.listTemplates(query);
    }
    list(user, query) {
        return this.strategies.list(user.sub, query);
    }
    createFromDescription(user, dto) {
        return this.strategies.createFromDescription(user.sub, dto);
    }
    create(user, dto) {
        return this.strategies.create(user.sub, dto);
    }
    findOne(id, user) {
        return this.strategies.findOne(id, user.sub);
    }
    update(id, user, dto) {
        return this.strategies.update(id, user.sub, dto);
    }
    remove(id, user) {
        return this.strategies.remove(id, user.sub);
    }
    /**
     * SSE stream of execution events for a running strategy.
     *
     * Authenticated via API key (Bearer token) with READ scope.
     * Sends `data: <JSON>\n\n` frames; heartbeat comment every 15 s.
     * Subscribes to in-process StrategyEventsService which is fed from stream:events.
     */
    async streamEvents(id, user, res) {
        // Verify the strategy exists and belongs to this user (throws 404/403 otherwise)
        await this.strategies.findOne(id, user.sub);
        const raw = res.raw;
        raw.statusCode = 200;
        raw.setHeader("Content-Type", "text/event-stream");
        raw.setHeader("Cache-Control", "no-cache, no-transform");
        raw.setHeader("X-Accel-Buffering", "no");
        raw.setHeader("Connection", "keep-alive");
        raw.flushHeaders();
        const send = (payload) => {
            raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        // Initial connected event so clients know the stream is live
        send({ type: "CONNECTED", strategyId: id, timestamp: Date.now() });
        const unsub = this.strategyEvents.subscribe(id, (event) => send(event));
        // Keepalive comment every 15 s (prevents proxy timeouts)
        const heartbeat = setInterval(() => {
            raw.write(": heartbeat\n\n");
        }, 15000);
        raw.on("close", () => {
            clearInterval(heartbeat);
            unsub();
        });
    }
    async exportStrategy(id, user, res) {
        const { payload, filename } = await this.strategies.exportStrategy(id, user.sub);
        res.header("Content-Type", "application/json");
        res.header("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(payload);
    }
    importStrategy(user, dto) {
        return this.strategies.importStrategy(dto, user.sub);
    }
    start(id, user, dto) {
        return this.strategies.start(id, user.sub, dto);
    }
    stop(id, user) {
        return this.strategies.stop(id, user.sub);
    }
    pause(id, user) {
        return this.strategies.pause(id, user.sub);
    }
    resume(id, user) {
        return this.strategies.resume(id, user.sub);
    }
    fork(id, user) {
        return this.strategies.fork(id, user.sub);
    }
    like(id, user) {
        return this.strategies.like(id, user.sub);
    }
    listComments(id, query) {
        return this.strategies.listComments(id, query);
    }
    addComment(id, user, dto) {
        return this.strategies.addComment(id, user.sub, dto);
    }
    deleteComment(strategyId, commentId, user) {
        return this.strategies.deleteComment(strategyId, commentId, user.sub);
    }
    listChildren(id, user) {
        return this.strategies.listChildren(id, user.sub);
    }
    report(id, user, dto) {
        return this.strategies.report(id, user.sub, dto);
    }
};
exports.StrategiesController = StrategiesController;
__decorate([
    (0, common_1.Get)("templates"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, strategy_query_dto_1.StrategyQueryDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("from-description"),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)("WRITE"),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_from_description_dto_1.CreateFromDescriptionDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "createFromDescription", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_strategy_dto_1.CreateStrategyDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, update_strategy_dto_1.UpdateStrategyDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('WRITE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(":id/events"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)("READ"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StrategiesController.prototype, "streamEvents", null);
__decorate([
    (0, common_1.Get)(":id/export"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StrategiesController.prototype, "exportStrategy", null);
__decorate([
    (0, common_1.Post)("import"),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, shared_auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, import_strategy_dto_1.ImportStrategyDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "importStrategy", null);
__decorate([
    (0, common_1.Post)(":id/start"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, start_strategy_dto_1.StartStrategyDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(":id/stop"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)(":id/pause"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)(":id/resume"),
    (0, common_1.UseGuards)(shared_auth_1.ApiKeyScopeGuard),
    (0, shared_auth_1.RequireScopes)('TRADE'),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)(":id/fork"),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "fork", null);
__decorate([
    (0, common_1.Post)(":id/like"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "like", null);
__decorate([
    (0, common_1.Get)(":id/comments"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "listComments", null);
__decorate([
    (0, common_1.Post)(":id/comments"),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, create_comment_dto_1.CreateCommentDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "addComment", null);
__decorate([
    (0, common_1.Delete)(":strategyId/comments/:commentId"),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)("strategyId", common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)("commentId", common_1.ParseUUIDPipe)),
    __param(2, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "deleteComment", null);
__decorate([
    (0, common_1.Get)(":id/children"),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "listChildren", null);
__decorate([
    (0, common_1.Post)(":id/report"),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    __param(1, (0, shared_auth_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, report_strategy_dto_1.ReportStrategyDto]),
    __metadata("design:returntype", void 0)
], StrategiesController.prototype, "report", null);
exports.StrategiesController = StrategiesController = __decorate([
    (0, swagger_1.ApiTags)("strategies"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("strategies"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [strategies_service_1.StrategiesService,
        strategy_events_service_1.StrategyEventsService])
], StrategiesController);
//# sourceMappingURL=strategies.controller.js.map