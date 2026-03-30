import { PrismaService } from "@polyforge/shared-db";
export declare class ProfileService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    updateProfile(userId: string, dto: {
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
    }): Promise<any>;
    changePassword(userId: string, dto: {
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    updateNotifications(userId: string, prefs: Record<string, boolean>): Promise<{
        message: string;
    }>;
    getProfile(username: string, viewerUserId?: string): Promise<any>;
    toggleFollow(username: string, viewerUserId: string): Promise<any>;
}
//# sourceMappingURL=profile.service.d.ts.map