import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) {}

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
        const data: any = {};
        if (dto.displayName !== undefined) data.displayName = dto.displayName;
        if (dto.bio !== undefined) data.bio = dto.bio;
        if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
        if (dto.twitterHandle !== undefined) data.twitterHandle = dto.twitterHandle;

        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true },
        });
    }

    async updateNotifications(userId: string, dto: Record<string, boolean>): Promise<any> {
        return this.prisma.notificationPreference.upsert({
            where: { userId },
            create: { userId, ...dto },
            update: { ...dto },
        });
    }

    async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<any> {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { passwordHash: true },
        });

        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });
        }

        const hash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

        return { message: 'Password updated' };
    }
}
