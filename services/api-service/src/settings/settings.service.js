"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const bcrypt = __importStar(require("bcrypt"));
let SettingsService = SettingsService_1 = class SettingsService {
    prisma;
    redis;
    config;
    logger = new common_1.Logger(SettingsService_1.name);
    dailyLimitMatic;
    constructor(prisma, redis, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.config = config;
        this.dailyLimitMatic = parseFloat(this.config.get("GAS_DAILY_LIMIT_MATIC") ?? "0.5");
    }
    async updateProfile(userId, dto) {
        const data = {};
        if (dto.displayName !== undefined)
            data.displayName = dto.displayName;
        if (dto.bio !== undefined)
            data.bio = dto.bio;
        if (dto.avatarUrl !== undefined)
            data.avatarUrl = dto.avatarUrl;
        if (dto.twitterHandle !== undefined)
            data.twitterHandle = dto.twitterHandle;
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
            },
        });
    }
    async getNotifications(userId) {
        const prefs = await this.prisma.notificationPreference.findUnique({
            where: { userId },
        });
        // Return defaults if no row exists yet
        return prefs ?? {
            emailEnabled: true,
            telegramEnabled: false,
            discordEnabled: false,
            onOrderFilled: true,
            onStrategyError: true,
            onBacktestComplete: true,
            onDailyLossLimit: true,
            onMarketResolved: true,
            onSomeoneFelked: false,
            onSomeoneFollowed: false,
            onSomeoneLiked: false,
            onSomeoneCommented: false,
        };
    }
    async updateNotifications(userId, dto) {
        return this.prisma.notificationPreference.upsert({
            where: { userId },
            create: { userId, ...dto },
            update: { ...dto },
        });
    }
    async updatePassword(userId, dto) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { passwordHash: true },
        });
        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException({
                code: "INVALID_CREDENTIALS",
                message: "Current password is incorrect",
            });
        }
        const hash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hash },
        });
        // R5-02: Mark password change timestamp so JWT guard can reject stale tokens
        try {
            await this.redis.set(`pwchange:${userId}`, Math.floor(Date.now() / 1000).toString(), 300);
        }
        catch (err) {
            this.logger.error(`Failed to set pwchange key for user ${userId}`, err);
        }
        // Revoke all refresh tokens + their reverse-lookup keys for this user
        try {
            const client = this.redis.getClient();
            const stream = client.scanStream({ match: `refresh:${userId}:*`, count: 100 });
            stream.on("data", (keys) => {
                if (keys.length > 0) {
                    // Also delete the corresponding refresh_lookup: keys
                    const lookupKeys = keys.map((k) => {
                        const tokenHash = k.split(":").pop();
                        return `refresh_lookup:${tokenHash}`;
                    });
                    void client.del(...keys, ...lookupKeys);
                }
            });
        }
        catch (err) {
            this.logger.error(`Failed to revoke refresh tokens for user ${userId}`, err);
        }
        return { message: "Password updated" };
    }
    async getGasUsage(userId) {
        const today = new Date().toISOString().slice(0, 10);
        const key = `gas:spent:${userId}:${today}`;
        let todayUsage = 0;
        try {
            const val = await this.redis.get(key);
            if (val)
                todayUsage = parseFloat(val);
        }
        catch (err) {
            this.logger.error(`Failed to read gas usage for user ${userId}`, err);
        }
        const sponsorEnabled = (this.config.get("GAS_SPONSOR_ENABLED") ?? "true") === "true";
        return {
            todayUsage,
            dailyLimit: this.dailyLimitMatic,
            remaining: Math.max(0, this.dailyLimitMatic - todayUsage),
            sponsorEnabled,
        };
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService,
        config_1.ConfigService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map