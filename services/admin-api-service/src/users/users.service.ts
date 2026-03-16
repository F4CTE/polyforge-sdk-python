import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { SuspendUserDto } from './dto/suspend.dto';
import { UpdateLimitsDto } from './dto/update-limits.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(params: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
        suspended?: boolean;
    }) {
        const { page, limit, search, status, suspended } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            deleted: false,
        };

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (suspended !== undefined) {
            where.suspended = suspended;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    displayName: true,
                    emailVerified: true,
                    polymarketConnected: true,
                    suspended: true,
                    suspendedReason: true,
                    createdAt: true,
                    lastSeen: true,
                    _count: {
                        select: {
                            strategies: true,
                            orders: true,
                        },
                    },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                limits: true,
                loginHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        ip: true,
                        userAgent: true,
                        success: true,
                        createdAt: true,
                    },
                },
                strategies: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        visibility: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                _count: {
                    select: {
                        orders: true,
                        positions: true,
                        strategies: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        }

        // Exclude passwordHash
        const { passwordHash, totpSecret, totpBackupCodes, ...safe } = user as any;
        return safe;
    }

    async suspend(id: string, dto: SuspendUserDto) {
        const user = await this.findUserOrFail(id);

        if (user.suspended) {
            throw new HttpException(
                { code: 'ALREADY_SUSPENDED', message: 'User is already suspended' },
                HttpStatus.CONFLICT,
            );
        }

        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                suspended: true,
                suspendedReason: dto.reason,
            },
        });

        return {
            suspended: true,
            suspendedAt: new Date().toISOString(),
            reason: updated.suspendedReason,
        };
    }

    async unsuspend(id: string) {
        await this.findUserOrFail(id);

        await this.prisma.user.update({
            where: { id },
            data: {
                suspended: false,
                suspendedReason: null,
            },
        });

        return { suspended: false };
    }

    async updateLimits(id: string, dto: UpdateLimitsDto) {
        await this.findUserOrFail(id);

        const limits = await this.prisma.userLimit.upsert({
            where: { userId: id },
            create: {
                userId: id,
                ...dto,
            },
            update: dto,
        });

        return limits;
    }

    private async findUserOrFail(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user || user.deleted) {
            throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        }
        return user;
    }
}
