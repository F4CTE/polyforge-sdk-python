import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import * as bcrypt from "bcrypt";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";
import { UpdateRiskSettingsDto } from "./dto/update-risk-settings.dto";
import { UpdateEventNotificationsDto } from "./dto/update-event-notifications.dto";
import { UpdateVenuePreferencesDto } from "./dto/update-venue-preferences.dto";
import { BETA_LIMITS } from "../common/beta-limits.config";
import { getMonthlyConfirmedVolume } from "../common/monthly-volume";
import { PaginatedResponse, paginate } from "../common/dto/pagination.dto";

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private readonly dailyLimitMatic: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.dailyLimitMatic = parseFloat(
      this.config.get<string>("GAS_DAILY_LIMIT_MATIC") ?? "0.5",
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName }
          : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.twitterHandle !== undefined
          ? { twitterHandle: dto.twitterHandle }
          : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  async getNotifications(userId: string): Promise<any> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    // Return defaults if no row exists yet
    return (
      prefs ?? {
        emailEnabled: true,
        telegramEnabled: false,
        discordEnabled: false,
        onOrderFilled: true,
        onStrategyError: true,
        onBacktestComplete: true,
        onDailyLossLimit: true,
        onMarketResolved: true,
        onSomeoneForked: false,
        onSomeoneFollowed: false,
        onSomeoneLiked: false,
        onSomeoneCommented: false,
      }
    );
  }

  async updateNotifications(
    userId: string,
    dto: UpdateNotificationsDto,
  ): Promise<any> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  async getEventNotifications(
    userId: string,
  ): Promise<{ preferences: unknown[]; emailDigest: string }> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: { eventPrefs: true, emailDigest: true },
    });
    return {
      preferences: (prefs?.eventPrefs as unknown[]) ?? [],
      emailDigest: prefs?.emailDigest ?? "DAILY",
    };
  }

  async updateEventNotifications(
    userId: string,
    dto: UpdateEventNotificationsDto,
  ): Promise<{ preferences: unknown[]; emailDigest: string }> {
    const data: Record<string, unknown> = {};
    if (dto.preferences !== undefined) data["eventPrefs"] = dto.preferences;
    if (dto.emailDigest !== undefined) data["emailDigest"] = dto.emailDigest;

    const result = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: { eventPrefs: true, emailDigest: true },
    });
    return {
      preferences: (result.eventPrefs as unknown[]) ?? [],
      emailDigest: result.emailDigest,
    };
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<any> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Current password is incorrect",
      });
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    // R5-02: Mark password change timestamp so JWT guard can reject stale tokens.
    // Security-critical: if Redis is unavailable, old access tokens remain valid,
    // so we MUST fail-fast rather than swallow the error.
    try {
      await this.redis.set(
        `pwchange:${userId}`,
        Math.floor(Date.now() / 1000).toString(),
        300,
      );
    } catch (err) {
      this.logger.error(`Failed to set pwchange key for user ${userId}`, err);
      throw new InternalServerErrorException({
        code: "PASSWORD_CHANGE_INCOMPLETE",
        message:
          "Password updated but session invalidation failed; sign out of all devices manually.",
      });
    }

    // Revoke all refresh tokens + their reverse-lookup keys for this user.
    // Security-critical: if any of this fails, old refresh tokens remain valid,
    // so we MUST fail-fast rather than swallow the error.
    try {
      await this.revokeAllRefreshTokens(userId);
    } catch (err) {
      this.logger.error(
        `Failed to revoke refresh tokens for user ${userId}`,
        err,
      );
      throw new InternalServerErrorException({
        code: "PASSWORD_CHANGE_INCOMPLETE",
        message:
          "Password updated but refresh-token revocation failed; sign out of all devices manually.",
      });
    }

    return { message: "Password updated" };
  }

  /**
   * Scan and delete all refresh-token keys for a user, plus their reverse-lookup
   * entries. Returns once the scan stream completes; rejects on any error so
   * security-critical callers (password change) can fail-fast.
   */
  private revokeAllRefreshTokens(userId: string): Promise<void> {
    const client = this.redis.getClient();
    return new Promise((resolve, reject) => {
      const stream = client.scanStream({
        match: `refresh:${userId}:*`,
        count: 100,
      });
      const pendingDels: Promise<unknown>[] = [];
      stream.on("data", (keys: string[]) => {
        if (keys.length === 0) return;
        const lookupKeys = keys.map(
          (k) => `refresh_lookup:${k.split(":").pop()}`,
        );
        pendingDels.push(client.del(...keys, ...lookupKeys));
      });
      stream.on("error", reject);
      stream.on("end", () => {
        Promise.all(pendingDels)
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async getRiskSettings(userId: string): Promise<any> {
    const limits = await this.prisma.userLimit.findUnique({
      where: { userId },
    });
    return {
      drawdownEnabled: limits?.drawdownEnabled ?? false,
      drawdownLookbackHours: limits?.drawdownLookbackHours ?? 24,
      drawdownThresholdPct: parseFloat(
        String(limits?.drawdownThresholdPct ?? "0.1"),
      ),
      circuitBreakerTripped: limits?.circuitBreakerTripped ?? false,
      circuitBreakerTrippedAt: limits?.circuitBreakerTrippedAt ?? null,
    };
  }

  async updateRiskSettings(
    userId: string,
    dto: UpdateRiskSettingsDto,
  ): Promise<any> {
    const data: Record<string, unknown> = {};
    if (dto.drawdownEnabled !== undefined)
      data.drawdownEnabled = dto.drawdownEnabled;
    if (dto.drawdownLookbackHours !== undefined)
      data.drawdownLookbackHours = dto.drawdownLookbackHours;
    if (dto.drawdownThresholdPct !== undefined)
      data.drawdownThresholdPct = dto.drawdownThresholdPct;

    await this.prisma.userLimit.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.getRiskSettings(userId);
  }

  async resetCircuitBreaker(userId: string): Promise<any> {
    await this.prisma.userLimit.upsert({
      where: { userId },
      create: {
        userId,
        circuitBreakerTripped: false,
        circuitBreakerTrippedAt: null,
      },
      update: {
        circuitBreakerTripped: false,
        circuitBreakerTrippedAt: null,
      },
    });

    // Clear the Redis debounce key so the checker can re-trigger if needed
    try {
      await this.redis.getClient().del(`cb:tripped:${userId}`);
    } catch (err) {
      this.logger.error(
        `Failed to clear circuit breaker debounce key for ${userId}`,
        err,
      );
    }

    return { reset: true };
  }

  async getGasUsage(userId: string): Promise<{
    todayUsage: number;
    dailyLimit: number;
    remaining: number;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `gas:spent:${userId}:${today}`;

    let todayUsage = 0;
    try {
      const val = await this.redis.get(key);
      if (val) todayUsage = parseFloat(val);
    } catch (err) {
      this.logger.error(`Failed to read gas usage for user ${userId}`, err);
    }

    return {
      todayUsage,
      dailyLimit: this.dailyLimitMatic,
      remaining: Math.max(0, this.dailyLimitMatic - todayUsage),
    };
  }

  async getBetaUsage(userId: string): Promise<{
    strategies: { used: number; limit: number };
    monthlyVolume: { usedUsdc: number; limitUsdc: number };
    positionSize: { maxUsdc: number };
    backtests: { runningOrQueued: number; maxConcurrent: number };
    marketplaceListings: { used: number; limit: number };
  }> {
    const [
      activeStrategyCount,
      monthlyVolumeUsedUsdc,
      activeBacktestCount,
      activeListingCount,
    ] = await Promise.all([
      this.prisma.strategy.count({
        where: { userId, status: { not: "ARCHIVED" } },
      }),
      getMonthlyConfirmedVolume(this.prisma, this.redis, userId),
      this.prisma.backtestRun.count({
        where: { userId, status: { in: ["RUNNING", "QUEUED"] } },
      }),
      this.prisma.marketplaceListing.count({
        where: { sellerId: userId, status: { notIn: ["DELISTED"] } },
      }),
    ]);

    return {
      strategies: {
        used: activeStrategyCount,
        limit: BETA_LIMITS.maxActiveStrategies,
      },
      monthlyVolume: {
        usedUsdc: monthlyVolumeUsedUsdc,
        limitUsdc: BETA_LIMITS.maxMonthlyVolumeUsdc,
      },
      positionSize: { maxUsdc: BETA_LIMITS.maxPositionSizeUsdc },
      backtests: {
        runningOrQueued: activeBacktestCount,
        maxConcurrent: BETA_LIMITS.maxConcurrentBacktests,
      },
      marketplaceListings: {
        used: activeListingCount,
        limit: BETA_LIMITS.maxMarketplaceListings,
      },
    };
  }

  async getFollowing(
    userId: string,
    page: number,
    limit: number,
  ): Promise<
    PaginatedResponse<{
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    }>
  > {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    const data = follows.map((f) => f.following);
    return paginate(data, total, page, limit);
  }

  private static readonly DEFAULT_VENUE_PREFS = {
    defaultVenue: "polymarket",
    enabledVenues: ["polymarket"],
    singlePlatformMode: true,
  };

  async getVenuePreferences(userId: string): Promise<{
    defaultVenue: string;
    enabledVenues: string[];
    singlePlatformMode: boolean;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { venuePreferences: true },
    });

    const stored = user.venuePreferences as Record<string, unknown> | null;
    if (!stored) return { ...SettingsService.DEFAULT_VENUE_PREFS };

    return {
      defaultVenue:
        typeof stored.defaultVenue === "string"
          ? stored.defaultVenue
          : SettingsService.DEFAULT_VENUE_PREFS.defaultVenue,
      enabledVenues: Array.isArray(stored.enabledVenues)
        ? (stored.enabledVenues as string[])
        : SettingsService.DEFAULT_VENUE_PREFS.enabledVenues,
      singlePlatformMode:
        typeof stored.singlePlatformMode === "boolean"
          ? stored.singlePlatformMode
          : SettingsService.DEFAULT_VENUE_PREFS.singlePlatformMode,
    };
  }

  async updateVenuePreferences(
    userId: string,
    dto: UpdateVenuePreferencesDto,
  ): Promise<{
    defaultVenue: string;
    enabledVenues: string[];
    singlePlatformMode: boolean;
  }> {
    const current = await this.getVenuePreferences(userId);
    const merged = {
      defaultVenue: dto.defaultVenue ?? current.defaultVenue,
      enabledVenues: dto.enabledVenues ?? current.enabledVenues,
      singlePlatformMode: dto.singlePlatformMode ?? current.singlePlatformMode,
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { venuePreferences: merged },
    });

    return merged;
  }
}
