import { CopyService } from "./copy.service";
import { CreateCopyDto } from "./dto/create-copy.dto";
import { UpdateCopyDto } from "./dto/update-copy.dto";
export declare class CopyController {
    private readonly copy;
    constructor(copy: CopyService);
    create(user: any, dto: CreateCopyDto): Promise<{
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    list(user: any): Promise<({
        _count: {
            trades: number;
        };
    } & {
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    })[]>;
    getDetail(user: any, id: string): Promise<{
        trades: {
            id: string;
            status: string;
            createdAt: Date;
            side: import(".prisma/client").$Enums.OrderSide;
            tokenId: string;
            pnl: Prisma.Decimal | null;
            marketId: string;
            outcome: import(".prisma/client").$Enums.OrderOutcome;
            orderId: string | null;
            configId: string;
            sourceWallet: string;
            sourceTxHash: string | null;
            sourceSize: Prisma.Decimal;
            sourcePrice: Prisma.Decimal;
            copiedSize: Prisma.Decimal;
            copiedPrice: Prisma.Decimal | null;
        }[];
    } & {
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    update(user: any, id: string, dto: UpdateCopyDto): Promise<{
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    pause(user: any, id: string): Promise<{
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    resume(user: any, id: string): Promise<{
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    stop(user: any, id: string): Promise<{
        mode: import(".prisma/client").$Enums.CopyMode;
        id: string;
        status: import(".prisma/client").$Enums.CopyStatus;
        userId: string;
        createdAt: Date;
        totalPnl: Prisma.Decimal;
        sizeValue: Prisma.Decimal;
        maxExposure: Prisma.Decimal;
        maxDailyLoss: Prisma.Decimal;
        priceOffset: Prisma.Decimal;
        targetWallet: string;
        updatedAt: Date;
        totalCopied: number;
        stoppedAt: Date | null;
    }>;
    getTrades(user: any, id: string, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            status: string;
            createdAt: Date;
            side: import(".prisma/client").$Enums.OrderSide;
            tokenId: string;
            pnl: Prisma.Decimal | null;
            marketId: string;
            outcome: import(".prisma/client").$Enums.OrderOutcome;
            orderId: string | null;
            configId: string;
            sourceWallet: string;
            sourceTxHash: string | null;
            sourceSize: Prisma.Decimal;
            sourcePrice: Prisma.Decimal;
            copiedSize: Prisma.Decimal;
            copiedPrice: Prisma.Decimal | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=copy.controller.d.ts.map