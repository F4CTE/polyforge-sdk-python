import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";
export declare class SettingsService {
    private readonly prisma;
    private readonly redis;
    private readonly config;
    private readonly logger;
    private readonly dailyLimitMatic;
    constructor(prisma: PrismaService, redis: RedisService, config: ConfigService);
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<any>;
    getNotifications(userId: string): Promise<any>;
    updateNotifications(userId: string, dto: UpdateNotificationsDto): Promise<any>;
    updatePassword(userId: string, dto: UpdatePasswordDto): Promise<any>;
    getGasUsage(userId: string): Promise<{
        todayUsage: number;
        dailyLimit: number;
        remaining: number;
        sponsorEnabled: boolean;
    }>;
}
//# sourceMappingURL=settings.service.d.ts.map