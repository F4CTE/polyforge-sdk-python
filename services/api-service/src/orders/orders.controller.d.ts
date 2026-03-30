import { OrdersService } from "./orders.service";
import { ClosePositionDto } from "./dto/close-position.dto";
import { PlaceOrderDto } from "./dto/place-order.dto";
import { RedeemPositionDto } from "./dto/redeem-position.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
declare class OrderQueryDto extends PaginationDto {
    status?: string;
    strategyId?: string;
    from?: string;
    to?: string;
}
declare class SplitPositionDto {
    tokenId: string;
    amount: string;
}
declare class MergePositionDto {
    tokenId: string;
    amount: string;
}
export declare class OrdersController {
    private readonly orders;
    constructor(orders: OrdersService);
    list(user: any, query: OrderQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<any>>;
    closePosition(user: any, dto: ClosePositionDto): Promise<any>;
    redeemPosition(user: any, dto: RedeemPositionDto): Promise<any>;
    /** Split USDC.e into Yes + No outcome tokens */
    splitPosition(user: any, dto: SplitPositionDto): Promise<any>;
    /** Merge Yes + No outcome tokens back into USDC.e */
    mergePosition(user: any, dto: MergePositionDto): Promise<any>;
    placeOrder(req: {
        user: {
            sub: string;
        };
    }, dto: PlaceOrderDto): Promise<{
        orderId: string;
        intentId: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
    }>;
    cancelOrder(req: {
        user: {
            sub: string;
        };
    }, id: string): Promise<{
        orderId: string;
        status: string;
    }>;
}
export {};
//# sourceMappingURL=orders.controller.d.ts.map