import { PrismaService } from "@polyforge/shared-db";
import { PaginationDto } from "../common/dto/pagination.dto";
import { CreateConditionalOrderDto } from "./dto/create-conditional-order.dto";
declare class ConditionalOrderQueryDto extends PaginationDto {
    status?: string;
    type?: string;
}
export declare class ConditionalController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(user: any, dto: CreateConditionalOrderDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ConditionalOrderStatus;
        type: import(".prisma/client").$Enums.ConditionalOrderType;
        size: Prisma.Decimal;
        userId: string;
        createdAt: Date;
        side: import(".prisma/client").$Enums.OrderSide;
        tokenId: string;
        marketId: string;
        outcome: import(".prisma/client").$Enums.OrderOutcome;
        triggerPrice: Prisma.Decimal;
        limitPrice: Prisma.Decimal | null;
        trailingPct: Prisma.Decimal | null;
        expiresAt: Date | null;
        orderId: string | null;
        triggeredAt: Date | null;
        peakPrice: Prisma.Decimal | null;
    }>;
    list(user: any, query: ConditionalOrderQueryDto): Promise<import("../common/dto/pagination.dto").PaginatedResponse<{
        id: string;
        status: import(".prisma/client").$Enums.ConditionalOrderStatus;
        type: import(".prisma/client").$Enums.ConditionalOrderType;
        size: Prisma.Decimal;
        userId: string;
        createdAt: Date;
        side: import(".prisma/client").$Enums.OrderSide;
        tokenId: string;
        marketId: string;
        outcome: import(".prisma/client").$Enums.OrderOutcome;
        triggerPrice: Prisma.Decimal;
        limitPrice: Prisma.Decimal | null;
        trailingPct: Prisma.Decimal | null;
        expiresAt: Date | null;
        orderId: string | null;
        triggeredAt: Date | null;
        peakPrice: Prisma.Decimal | null;
    }>>;
    detail(user: any, id: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ConditionalOrderStatus;
        type: import(".prisma/client").$Enums.ConditionalOrderType;
        size: Prisma.Decimal;
        userId: string;
        createdAt: Date;
        side: import(".prisma/client").$Enums.OrderSide;
        tokenId: string;
        marketId: string;
        outcome: import(".prisma/client").$Enums.OrderOutcome;
        triggerPrice: Prisma.Decimal;
        limitPrice: Prisma.Decimal | null;
        trailingPct: Prisma.Decimal | null;
        expiresAt: Date | null;
        orderId: string | null;
        triggeredAt: Date | null;
        peakPrice: Prisma.Decimal | null;
    }>;
    cancel(user: any, id: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ConditionalOrderStatus;
        type: import(".prisma/client").$Enums.ConditionalOrderType;
        size: Prisma.Decimal;
        userId: string;
        createdAt: Date;
        side: import(".prisma/client").$Enums.OrderSide;
        tokenId: string;
        marketId: string;
        outcome: import(".prisma/client").$Enums.OrderOutcome;
        triggerPrice: Prisma.Decimal;
        limitPrice: Prisma.Decimal | null;
        trailingPct: Prisma.Decimal | null;
        expiresAt: Date | null;
        orderId: string | null;
        triggeredAt: Date | null;
        peakPrice: Prisma.Decimal | null;
    }>;
}
export {};
//# sourceMappingURL=conditional.controller.d.ts.map