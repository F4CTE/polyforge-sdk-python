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
exports.EventsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
let EventsGateway = class EventsGateway {
    server;
    broadcast(event, data) {
        if (!this.server?.clients)
            return;
        const message = JSON.stringify({ event, data, timestamp: Date.now() });
        for (const client of this.server.clients) {
            if (client.readyState === 1) {
                client.send(message);
            }
        }
    }
    sendToUser(_userId, event, data) {
        this.broadcast(event, data);
    }
    pushPriceUpdate(tokenId, price, timestamp) {
        this.broadcast("PRICE_UPDATE", { tokenId, price, timestamp });
    }
    pushStrategyEvent(strategyId, userId, type, data) {
        this.sendToUser(userId, type, { strategyId, ...data });
    }
    pushOrderEvent(userId, type, data) {
        this.sendToUser(userId, type, data);
    }
    pushWhaleTrade(data) {
        this.broadcast("WHALE_TRADE", data);
    }
    pushNewsSignal(data) {
        this.broadcast("NEWS_SIGNAL", data);
    }
    pushNotification(userId, data) {
        this.sendToUser(userId, "NOTIFICATION", data);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = __decorate([
    (0, common_1.Injectable)(),
    (0, websockets_1.WebSocketGateway)({ path: "/ws" })
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map