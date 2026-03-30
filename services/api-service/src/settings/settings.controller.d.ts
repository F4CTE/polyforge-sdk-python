import { SettingsService } from "./settings.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";
export declare class SettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
    updateProfile(user: any, dto: UpdateProfileDto): Promise<any>;
    getNotifications(user: any): Promise<any>;
    updateNotifications(user: any, dto: UpdateNotificationsDto): Promise<any>;
    updatePassword(user: any, dto: UpdatePasswordDto): Promise<any>;
    getGasUsage(user: any): Promise<{
        todayUsage: number;
        dailyLimit: number;
        remaining: number;
        sponsorEnabled: boolean;
    }>;
}
//# sourceMappingURL=settings.controller.d.ts.map