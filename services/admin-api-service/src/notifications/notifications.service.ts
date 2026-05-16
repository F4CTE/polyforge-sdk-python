import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { BroadcastDto } from "./dto/broadcast.dto";

const MAX_BROADCAST_RECIPIENTS = 5000;
const DLQ_STREAM = "stream:events:dlq";
const DEFAULT_STREAM_EVENTS_MAXLEN = 100_000;

function streamEventsMaxLen(): number {
  const env = process.env.REDIS_STREAM_EVENTS_MAXLEN;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_STREAM_EVENTS_MAXLEN;
}

/**
 * Atomically reads a DLQ entry, strips internal fields, republishes to
 * stream:events with MAXLEN trimming, and deletes from DLQ — preventing
 * duplicate replays.  KEYS: [DLQ_STREAM]  ARGV: [msgId, maxLen]
 */
const REPLAY_LUA = `
local results = redis.call('XRANGE', KEYS[1], ARGV[1], ARGV[1], 'COUNT', 1)
if #results == 0 then return nil end

local fields = results[1][2]
-- Build args for XADD, skipping originalId / dlqReason / dlqTs
local args = {}
for i = 1, #fields, 1 do
  args[#args + 1] = fields[i]
end
-- Strip internal DLQ metadata (key-value pairs)
local i = 1
while i <= #args do
  local k = args[i]
  if k == 'originalId' or k == 'dlqReason' or k == 'dlqTs' then
    table.remove(args, i)  -- remove value
    table.remove(args, i)  -- remove key (index shifted after first remove)
  else
    i = i + 2
  end
end
redis.call('XADD', 'stream:events', 'MAXLEN', '~', ARGV[2], '*', unpack(args))
redis.call('XDEL', KEYS[1], ARGV[1])
return ARGV[1]
`;

@Injectable()
export class NotificationsAdminService {
  private readonly logger = new Logger(NotificationsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async broadcast(dto: BroadcastDto) {
    // Resolve target user IDs
    let targetIds: string[];
    if (dto.userIds && dto.userIds.length > 0) {
      targetIds = dto.userIds;
    } else {
      // All active users
      const users = await this.prisma.user.findMany({
        where: { deleted: false, suspended: false, emailVerified: true },
        select: { id: true },
      });
      targetIds = users.map((u) => u.id);
    }

    if (targetIds.length > MAX_BROADCAST_RECIPIENTS) {
      throw new BadRequestException({
        code: "BROADCAST_TOO_LARGE",
        message: `Broadcast exceeds the ${MAX_BROADCAST_RECIPIENTS}-recipient cap. Segment your audience or use multiple batches.`,
      });
    }

    const ts = Date.now();
    let queued = 0;

    for (const userId of targetIds) {
      await this.redis.xadd("stream:events", {
        type: "NOTIFICATION",
        userId,
        channel: dto.channel,
        templateId: dto.templateId,
        subject: dto.subject,
        metadata: JSON.stringify(dto.metadata ?? {}),
        ts: String(ts),
        source: "admin-broadcast",
      });
      queued++;
    }

    this.logger.log(`Broadcast queued for ${queued} users via ${dto.channel}`);
    return { queued, channel: dto.channel };
  }

  async getStats() {
    const [total, last24h, failed] = await Promise.all([
      this.prisma.notificationHistory.count(),
      this.prisma.notificationHistory.count({
        where: { sentAt: { gte: new Date(Date.now() - 86400_000) } },
      }),
      this.prisma.notificationHistory.count({
        where: { success: false },
      }),
    ]);

    return { total, last24h, failed };
  }

  async getDlqEntries(limit?: number, cursor?: string) {
    const client = this.redis.getClient();
    const count = Math.min(Math.max(1, limit ?? 50), 100);

    try {
      const actualStart = cursor && cursor !== "-" ? `(${cursor}` : "-";
      const results: any = await client.xrange(
        DLQ_STREAM,
        actualStart,
        "+",
        "COUNT",
        count,
      );

      const entries = (results ?? []).map(
        ([id, fields]: [string, string[]]) => {
          const parsed: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            parsed[fields[i]] = fields[i + 1];
          }
          return { id, ...parsed };
        },
      );

      const nextCursor =
        entries.length === count ? entries[entries.length - 1].id : null;

      return { entries, nextCursor };
    } catch (err: any) {
      this.logger.error(`Failed to read DLQ: ${err?.message}`);
      throw err;
    }
  }

  async replayDlqEntry(msgId: string) {
    const client = this.redis.getClient();
    const maxLen = streamEventsMaxLen();

    const result = await client.eval(
      REPLAY_LUA,
      1,
      DLQ_STREAM,
      msgId,
      String(maxLen),
    );
    if (!result) {
      throw new BadRequestException({
        code: "DLQ_ENTRY_NOT_FOUND",
        message: `DLQ entry ${msgId} not found.`,
      });
    }

    this.logger.log(`DLQ entry ${msgId} replayed to stream:events`);
    return { replayed: msgId };
  }

  async discardDlqEntry(msgId: string) {
    const client = this.redis.getClient();

    const deleted = await client.xdel(DLQ_STREAM, msgId);
    if (deleted === 0) {
      throw new BadRequestException({
        code: "DLQ_ENTRY_NOT_FOUND",
        message: `DLQ entry ${msgId} not found.`,
      });
    }

    this.logger.log(`DLQ entry ${msgId} discarded`);
    return { discarded: msgId };
  }
}
