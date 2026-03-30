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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const client_1 = require(".prisma/client");
const bcrypt = __importStar(require("bcrypt"));
let ProfileService = class ProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateProfile(userId, dto) {
        const data = {};
        if (dto.displayName !== undefined)
            data.displayName = dto.displayName.slice(0, 50);
        if (dto.bio !== undefined)
            data.bio = dto.bio.slice(0, 500);
        if (dto.avatarUrl !== undefined)
            data.avatarUrl = dto.avatarUrl.slice(0, 500);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data,
            select: { displayName: true, bio: true, avatarUrl: true },
        });
        return user;
    }
    async changePassword(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });
        if (!user)
            throw new common_1.NotFoundException("User not found");
        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid)
            throw new common_1.BadRequestException("Current password is incorrect");
        if (dto.newPassword.length < 8) {
            throw new common_1.BadRequestException("Password must be at least 8 characters");
        }
        const hash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hash },
        });
        return { message: "Password changed" };
    }
    async updateNotifications(userId, prefs) {
        await this.prisma.notificationPreference.upsert({
            where: { userId },
            create: { userId, ...prefs },
            update: prefs,
        });
        return { message: "Notification preferences updated" };
    }
    async getProfile(username, viewerUserId) {
        const user = await this.prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                createdAt: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "User not found",
            });
        const [followersCount, followingCount, publicStrategyCount] = await Promise.all([
            this.prisma.follow.count({ where: { followingId: user.id } }),
            this.prisma.follow.count({ where: { followerId: user.id } }),
            this.prisma.strategy.count({
                where: {
                    userId: user.id,
                    visibility: "PUBLIC",
                    status: { not: client_1.StrategyStatus.ARCHIVED },
                },
            }),
        ]);
        let isFollowing = false;
        if (viewerUserId && viewerUserId !== user.id) {
            const follow = await this.prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerUserId,
                        followingId: user.id,
                    },
                },
            });
            isFollowing = !!follow;
        }
        return {
            username: user.username,
            displayName: user.displayName,
            bio: user.bio ?? null,
            avatarUrl: user.avatarUrl ?? null,
            followersCount,
            followingCount,
            isFollowing,
            publicStrategyCount,
            joinedAt: user.createdAt,
        };
    }
    async toggleFollow(username, viewerUserId) {
        const target = await this.prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });
        if (!target)
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "User not found",
            });
        if (viewerUserId === target.id) {
            throw new common_1.UnprocessableEntityException({
                code: "CANNOT_FOLLOW_SELF",
                message: "You cannot follow yourself",
            });
        }
        const existing = await this.prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: viewerUserId,
                    followingId: target.id,
                },
            },
        });
        if (existing) {
            await this.prisma.follow.delete({
                where: {
                    followerId_followingId: {
                        followerId: viewerUserId,
                        followingId: target.id,
                    },
                },
            });
        }
        else {
            await this.prisma.follow.create({
                data: { followerId: viewerUserId, followingId: target.id },
            });
        }
        const followersCount = await this.prisma.follow.count({
            where: { followingId: target.id },
        });
        return { following: !existing, followersCount };
    }
};
exports.ProfileService = ProfileService;
exports.ProfileService = ProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], ProfileService);
//# sourceMappingURL=profile.service.js.map