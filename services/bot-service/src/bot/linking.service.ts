import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { createHash, randomUUID } from "crypto";

const BOT_JWT_SECRET =
  process.env.BOT_JWT_SECRET ?? "dev-bot-jwt-secret-change-in-production";
const BOT_JWT_EXPIRES = "30d";

export type BotChannelType = "TELEGRAM" | "DISCORD";

@Injectable()
export class LinkingService {
  private readonly logger = new Logger(LinkingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Returns the userId linked to this chatId, or null if not linked.
   */
  async getUserId(
    channel: BotChannelType,
    chatId: string,
  ): Promise<string | null> {
    const conn = await this.prisma.botConnection.findFirst({
      where: { channel: channel as any, chatId, active: true },
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
    // Already linked?
    const existing = await this.prisma.botConnection.findFirst({
      where: { channel: channel as any, chatId, active: true },
    });
    if (existing) {
      return "✅ This account is already linked. Use /disconnect to unlink first.";
    }

    // Consume the one-time link code from Redis
    const userId = await this.redis.get(`bot:link:${code}`);
    if (!userId) {
      return "❌ Invalid or expired code. Generate a new one in Polyforge Settings → Bots.";
    }
    await this.redis.del(`bot:link:${code}`);

    // Issue a 30-day bot JWT
    const tokenPayload = {
      sub: userId,
      jti: randomUUID(),
      role: "bot",
      channel: channel.toLowerCase(),
      scopes: ["read:strategies", "read:pnl", "write:strategy:stop"],
    };
    const token = this.jwt.sign(tokenPayload, {
      secret: BOT_JWT_SECRET,
      expiresIn: BOT_JWT_EXPIRES,
    });
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Upsert BotConnection (deactivate any previous connection for this user+channel)
    await this.prisma.botConnection.updateMany({
      where: { userId, channel: channel as any },
      data: { active: false },
    });

    await this.prisma.botConnection.create({
      data: {
        userId,
        channel: channel as any,
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
      where: { channel: channel as any, chatId, active: true },
      data: { active: false },
    });

    if (result.count === 0) {
      return "⚠️ No linked account found.";
    }

    this.logger.log(`${channel} chatId ${chatId} disconnected`);
    return "✅ Account unlinked. Your data on Polyforge is unaffected.";
  }
}
