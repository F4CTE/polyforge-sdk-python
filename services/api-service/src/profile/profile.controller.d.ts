import { ProfileService } from "./profile.service";
export declare class ProfileController {
    private readonly profile;
    constructor(profile: ProfileService);
    updateMyProfile(user: any, dto: {
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
    }): Promise<any>;
    changePassword(user: any, dto: {
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    updateNotifications(user: any, dto: Record<string, boolean>): Promise<{
        message: string;
    }>;
    getProfile(username: string, user: any): Promise<any>;
    toggleFollow(username: string, user: any): Promise<any>;
}
//# sourceMappingURL=profile.controller.d.ts.map