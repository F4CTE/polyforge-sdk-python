import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { BotChannel } from "@prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { createHash, randomUUID } from "crypto";

const BOT_JWT_EXPIRES = "30d";
const BOT_LINK_FAIL_MAX = 5;
const BOT_LINK_FAIL_WINDOW_SECONDS = 900; // 15 minutes

export type BotChannelType = "TELEGRAM" | "DISCORD" | "WHATSAPP";

@Injectable()
export class LinkingService {
  private readonly logger = new Logger(LinkingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns the userId linked to this chatId, or null if not linked.
   */
  async getUserId(
    channel: BotChannelType,
    chatId: string,
  ): Promise<string | null> {
    const conn = await this.prisma.botConnection.findFirst({
      where: {
        channel: channel as unknown as BotChannel,
        chatId,
        active: true,
      },
      select: { userId: true },
    });
    return conn?.userId ?? null;
  }

  /**
   * /connect <code> handler.
   * Reads bot:link:{code} from Redis, stores BotConnection, issues bot JWT.
   */
  async connect(
    channel: BotChannelType,
    chatId: string,
    code: string,
  ): Promise<string> {
    // Rate-limit invalid attempts per (channel, chatId) to prevent brute-force of 6-digit codes
    const failKey = `bot:link:fail:${channel}:${chatId}`;
    const failCount = await this.redis.getClient().get(failKey);
    if (failCount && parseInt(failCount, 10) >= BOT_LINK_FAIL_MAX) {
      return "❌ Too many invalid attempts — please wait 15 minutes and try again.";
    }

    // Already linked?
    const existing = await this.prisma.botConnection.findFirst({
      where: {
        channel: channel as unknown as BotChannel,
        chatId,
        active: true,
      },
    });
    if (existing) {
      return "✅ This account is already linked. Use /disconnect to unlink first.";
    }

    // Consume the one-time link code from Redis
    const userId = await this.redis.get(`bot:link:${code}`);
    if (!userId) {
      const fails = await this.redis.getClient().incr(failKey);
      if (fails === 1) {
        await this.redis
          .getClient()
          .expire(failKey, BOT_LINK_FAIL_WINDOW_SECONDS);
      }
      return "❌ Invalid or expired code. Generate a new one in Polyforge Settings → Bots.";
    }
    await this.redis.del(`bot:link:${code}`);
    await this.redis.del(failKey);

    // Issue a 30-day bot JWT
    const tokenPayload = {
      sub: userId,
      jti: randomUUID(),
      role: "bot",
      channel: channel.toLowerCase(),
      scopes: ["read:strategies", "read:pnl", "write:strategy:stop"],
    };
    const token = this.jwt.sign(tokenPayload, {
      secret: this.config.getOrThrow<string>("BOT_JWT_SECRET"),
      expiresIn: BOT_JWT_EXPIRES,
      algorithm: "HS256",
    });
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Upsert BotConnection (deactivate any previous connection for this user+channel)
    await this.prisma.botConnection.updateMany({
      where: { userId, channel: channel as unknown as BotChannel },
      data: { active: false },
    });

    await this.prisma.botConnection.create({
      data: {
        userId,
        channel: channel as unknown as BotChannel,
        chatId,
        tokenHash,
        active: true,
      },
    });

    this.logger.log(`User ${userId} linked ${channel} chatId ${chatId}`);
    return "✅ Account linked successfully! Type /help to see available commands.";
  }

  /**
   * /disconnect handler. Deactivates the BotConnection.
   */
  async disconnect(channel: BotChannelType, chatId: string): Promise<string> {
    const result = await this.prisma.botConnection.updateMany({
      where: {
        channel: channel as unknown as BotChannel,
        chatId,
        active: true,
      },
      data: { active: false },
    });

    if (result.count === 0) {
      return "⚠️ No linked account found.";
    }

    this.logger.log(`${channel} chatId ${chatId} disconnected`);
    return "✅ Account unlinked. Your data on Polyforge is unaffected.";
  }
}
