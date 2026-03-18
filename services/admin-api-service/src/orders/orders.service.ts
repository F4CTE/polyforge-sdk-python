import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";

const DLQ_STREAM = "stream:orders:dlq";
const ORDERS_STREAM = "stream:orders";
const DLQ_PREFIX = "dlq:discarded:";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    userId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, userId, status, from, to } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status as any;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) (where.createdAt as any).lte = new Date(to);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          intentId: true,
          userId: true,
          strategyId: true,
          marketId: true,
          tokenId: true,
          side: true,
          size: true,
          price: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          user: { select: { username: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getDlq(): Promise<any[]> {
    const client = this.redis.getClient();
    // Read all entries from the DLQ stream
    const entries = await client.xrange(DLQ_STREAM, "-", "+", "COUNT", 100);
    if (!entries) return [];

    return entries.map(([id, fields]) => {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        try {
          parsed[k] = JSON.parse(v);
        } catch {
          parsed[k] = v;
        }
      }
      return { streamId: id, ...parsed };
    });
  }

  async replayDlqEntry(intentId: string) {
    const client = this.redis.getClient();
    const entries = await client.xrange(DLQ_STREAM, "-", "+");
    if (!entries) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "DLQ entry not found",
      });
    }

    let foundEntry: [string, string[]] | undefined;
    for (const entry of entries) {
      const [streamId, fields] = entry;
      const fieldsMap: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldsMap[fields[i]] = fields[i + 1];
      }
      const intentData =
        fieldsMap["intentId"] ??
        (fieldsMap["intent"]
          ? JSON.parse(fieldsMap["intent"])?.intentId
          : undefined);
      if (intentData === intentId) {
        foundEntry = [streamId, fields];
        break;
      }
    }

    if (!foundEntry) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "DLQ entry not found",
      });
    }

    const [streamId, fields] = foundEntry;
    // Re-publish to orders stream
    const args: string[] = [];
    for (let i = 0; i < fields.length; i++) {
      args.push(fields[i]);
    }
    await (client as any).xadd(ORDERS_STREAM, "*", ...args);

    // Remove from DLQ
    await client.xdel(DLQ_STREAM, streamId);

    return { replayed: true, intentId };
  }

  async discardDlqEntry(intentId: string) {
    const client = this.redis.getClient();
    const entries = await client.xrange(DLQ_STREAM, "-", "+");
    if (!entries) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "DLQ entry not found",
      });
    }

    let streamId: string | undefined;
    for (const entry of entries) {
      const [id, fields] = entry;
      const fieldsMap: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldsMap[fields[i]] = fields[i + 1];
      }
      const intentData =
        fieldsMap["intentId"] ??
        (fieldsMap["intent"]
          ? JSON.parse(fieldsMap["intent"])?.intentId
          : undefined);
      if (intentData === intentId) {
        streamId = id;
        break;
      }
    }

    if (!streamId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "DLQ entry not found",
      });
    }

    await client.xdel(DLQ_STREAM, streamId);
    // Mark as discarded
    await client.set(`${DLQ_PREFIX}${intentId}`, "1", "EX", 86400 * 7);

    return { discarded: true };
  }
}
