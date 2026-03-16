import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { paginate, PaginatedResponse, PaginationDto } from '../common/dto/pagination.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { randomUUID } from 'crypto';

export interface OrderQueryDto extends PaginationDto {
    status?: string;
    strategyId?: string;
    from?: string;
    to?: string;
}

@Injectable()
export class OrdersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly config: ConfigService,
    ) {}

    async list(userId: string, query: OrderQueryDto): Promise<PaginatedResponse<any>> {
        const { page, limit, status, strategyId, from, to } = query;
        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (status) where.status = status;
        if (strategyId) where.strategyId = strategyId;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        return paginate(orders, total, page, limit);
    }

    async closePosition(userId: string, dto: ClosePositionDto): Promise<any> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { polymarketConnected: true },
        });
        if (!user?.polymarketConnected) {
            throw new UnprocessableEntityException({ code: 'NOT_CONNECTED', message: 'Polymarket credentials required' });
        }

        // Find open position (unresolved)
        const position = await this.prisma.position.findFirst({
            where: { userId, tokenId: dto.tokenId, resolutionStatus: 'UNRESOLVED' as any },
        });
        if (!position) {
            throw new NotFoundException({ code: 'POSITION_NOT_FOUND', message: 'No open position found for this token' });
        }

        const intentId = randomUUID();
        const size = dto.size ?? String(position.size);

        // Publish close intent to stream:orders
        await this.redis.xadd('stream:orders', {
            intentId,
            userId,
            strategyId: '',
            marketId: position.marketId,
            tokenId: dto.tokenId,
            side: 'SELL',
            outcome: 'YES',
            size,
            price: '0.01',
            orderType: 'FOK',
            expiration: '',
            ts: String(Date.now()),
        });

        // Create a pending order record
        const order = await this.prisma.order.create({
            data: {
                intentId,
                userId,
                strategyId: null,
                marketId: position.marketId,
                tokenId: dto.tokenId,
                side: 'SELL' as any,
                outcome: position.outcome,
                size: size,
                price: '0.01',
                orderType: 'FOK' as any,
                status: 'PENDING' as any,
            },
        });

        return { orderId: order.id, intentId, status: 'PENDING' };
    }
}
