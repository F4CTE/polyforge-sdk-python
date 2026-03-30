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
exports.StrategyEventsService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
/**
 * In-process fan-out for strategy execution events.
 *
 * EventsService feeds this emitter whenever a relevant event arrives from
 * the Redis stream. StrategiesController SSE endpoints subscribe here and
 * forward payloads to connected clients.
 */
let StrategyEventsService = class StrategyEventsService {
    emitter = new events_1.EventEmitter();
    constructor() {
        // Allow many concurrent SSE subscribers per strategy
        this.emitter.setMaxListeners(500);
    }
    /** Emit an event for a specific strategy (called from EventsService). */
    emit(strategyId, type, data) {
        const payload = {
            type,
            strategyId,
            data: data ?? null,
            timestamp: Date.now(),
        };
        this.emitter.emit(`s:${strategyId}`, payload);
    }
    /**
     * Subscribe to events for a strategy.
     * Returns an unsubscribe function — call it when the SSE connection closes.
     */
    subscribe(strategyId, handler) {
        const key = `s:${strategyId}`;
        this.emitter.on(key, handler);
        return () => this.emitter.off(key, handler);
    }
};
exports.StrategyEventsService = StrategyEventsService;
exports.StrategyEventsService = StrategyEventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StrategyEventsService);
//# sourceMappingURL=strategy-events.service.js.map