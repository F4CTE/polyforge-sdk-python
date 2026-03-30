import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@polyforge/shared-db';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.watchlistItem.findMany({
      where: { userId },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            category: true,
            image: true,
            closed: true,
            volume24h: true,
            tokens: { select: { id: true, outcome: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(i => ({ ...i.market, watchlistId: i.id, addedAt: i.createdAt }));
  }

  async add(userId: string, marketId: string) {
    try {
      const item = await this.prisma.watchlistItem.upsert({
        where: { userId_marketId: { userId, marketId } },
        create: { userId, marketId },
        update: {},
      });
      return item;
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new NotFoundException({ code: 'MARKET_NOT_FOUND', message: 'Market not found' });
      }
      throw e;
    }
  }

  async remove(userId: string, marketId: string) {
    await this.prisma.watchlistItem.deleteMany({ where: { userId, marketId } });
  }

  async isWatched(userId: string, marketId: string): Promise<boolean> {
    const item = await this.prisma.watchlistItem.findUnique({
      where: { userId_marketId: { userId, marketId } },
    });
    return !!item;
  }
}
