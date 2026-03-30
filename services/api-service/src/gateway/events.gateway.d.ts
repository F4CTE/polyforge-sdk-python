import { Server } from "ws";
export declare class EventsGateway {
    server: Server;
    broadcast(event: string, data: unknown): void;
    sendToUser(_userId: string, event: string, data: unknown): void;
    pushPriceUpdate(tokenId: string, price: number, timestamp: number): void;
    pushStrategyEvent(strategyId: string, userId: string, type: string, data: unknown): void;
    pushOrderEvent(userId: string, type: string, data: unknown): void;
    pushWhaleTrade(data: unknown): void;
    pushNewsSignal(data: unknown): void;
    pushNotification(userId: string, data: unknown): void;
}
//# sourceMappingURL=events.gateway.d.ts.map