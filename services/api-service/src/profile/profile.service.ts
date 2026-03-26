import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { StrategyStatus } from ".prisma/client";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(username: string, viewerUserId?: string): Promise<any> {
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });

    const [followersCount, followingCount, publicStrategyCount] =
      await Promise.all([
        this.prisma.follow.count({ where: { followingId: user.id } }),
        this.prisma.follow.count({ where: { followerId: user.id } }),
        this.prisma.strategy.count({
          where: {
            userId: user.id,
            visibility: "PUBLIC" as any,
            status: { not: StrategyStatus.ARCHIVED },
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

  async toggleFollow(username: string, viewerUserId: string): Promise<any> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });

    if (viewerUserId === target.id) {
      throw new UnprocessableEntityException({
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
    } else {
      await this.prisma.follow.create({
        data: { followerId: viewerUserId, followingId: target.id },
      });
    }

    const followersCount = await this.prisma.follow.count({
      where: { followingId: target.id },
    });
    return { following: !existing, followersCount };
  }
}
