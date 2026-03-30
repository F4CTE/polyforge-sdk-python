import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
import { CreateCopyDto } from "./dto/create-copy.dto";
import { UpdateCopyDto } from "./dto/update-copy.dto";
export declare class CopyService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateCopyDto): Promise<{
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
    list(userId: string): Promise<({
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
    getDetail(id: string, userId: string): Promise<{
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
    update(id: string, userId: string, dto: UpdateCopyDto): Promise<{
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
    pause(id: string, userId: string): Promise<{
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
    resume(id: string, userId: string): Promise<{
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
    stop(id: string, userId: string): Promise<{
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
    getTrades(id: string, userId: string, page: number, limit: number): Promise<{
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
    private findOwnedConfig;
}
//# sourceMappingURL=copy.service.d.ts.map