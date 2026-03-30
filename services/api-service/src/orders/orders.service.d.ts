import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PaginatedResponse, PaginationDto } from "../common/dto/pagination.dto";
import { ClosePositionDto } from "./dto/close-position.dto";
import { PlaceOrderDto } from "./dto/place-order.dto";
import { RedeemPositionDto } from "./dto/redeem-position.dto";
export interface OrderQueryDto extends PaginationDto {
    status?: string;
    strategyId?: string;
    from?: string;
    to?: string;
}
export declare class OrdersService {
    private readonly prisma;
    private readonly redis;
    private readonly config;
    private readonly jwtService;
    constructor(prisma: PrismaService, redis: RedisService, config: ConfigService, jwtService: JwtService);
    list(userId: string, query: OrderQueryDto): Promise<PaginatedResponse<any>>;
    closePosition(userId: string, dto: ClosePositionDto): Promise<any>;
    redeemPosition(userId: string, dto: RedeemPositionDto): Promise<any>;
    /**
     * Split USDC.e into Yes + No outcome tokens via signer-service.
     */
    splitPosition(userId: string, dto: {
        tokenId: string;
        amount: string;
    }): Promise<any>;
    /**
     * Merge Yes + No outcome tokens back into USDC.e via signer-service.
     */
    mergePosition(userId: string, dto: {
        tokenId: string;
        amount: string;
    }): Promise<any>;
    placeOrder(userId: string, dto: PlaceOrderDto): Promise<{
        orderId: string;
        intentId: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
    }>;
    cancelOrder(userId: string, orderId: string): Promise<{
        orderId: string;
        status: string;
    }>;
}
//# sourceMappingURL=orders.service.d.ts.map