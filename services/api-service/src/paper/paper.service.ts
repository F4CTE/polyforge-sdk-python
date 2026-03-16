import { Injectable } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';

@Injectable()
export class PaperService {
    constructor(private readonly prisma: PrismaService) {}

    async getSummary(userId: string): Promise<any> {
        const [orderCount, positions] = await Promise.all([
            this.prisma.paperOrder.count({ where: { userId } }),
            this.prisma.paperPosition.findMany({
                where: { userId },
                select: { tokenId: true, outcome: true, size: true, avgPrice: true, realizedPnl: true },
            }),
        ]);

        const pnl = positions.reduce((acc, p) => acc + parseFloat(String(p.realizedPnl ?? 0)), 0);

        return {
            pnl: pnl.toFixed(2),
            positions: positions.map(p => ({
                tokenId: p.tokenId,
                side: p.outcome,
                size: String(p.size),
                unrealizedPnl: '0',
            })),
            orderCount,
        };
    }

    async reset(userId: string): Promise<any> {
        await Promise.all([
            this.prisma.paperOrder.deleteMany({ where: { userId } }),
            this.prisma.paperPosition.deleteMany({ where: { userId } }),
        ]);
        return { reset: true };
    }
}
