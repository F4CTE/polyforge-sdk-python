"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const pagination_dto_1 = require("../common/dto/pagination.dto");
let TicketsService = class TicketsService {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async create(userId, username, dto) {
        const ticket = await this.prisma.$transaction(async (tx) => {
            const t = await tx.ticket.create({
                data: {
                    userId,
                    subject: dto.subject,
                    category: dto.category ?? "GENERAL",
                    status: "OPEN",
                },
            });
            await tx.ticketMessage.create({
                data: {
                    ticketId: t.id,
                    senderId: userId,
                    senderName: username,
                    isAdmin: false,
                    body: dto.body,
                },
            });
            return t;
        });
        // Emit event for admin notification
        await this.redis.xadd("stream:events", {
            event_type: "TICKET_CREATED",
            userId,
            ticketId: ticket.id,
            subject: ticket.subject,
            timestamp: String(Date.now()),
        });
        return ticket;
    }
    async listMy(userId, page, limit) {
        const skip = (page - 1) * limit;
        const [tickets, total] = await Promise.all([
            this.prisma.ticket.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { updatedAt: "desc" },
                include: {
                    messages: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            body: true,
                            isAdmin: true,
                            senderName: true,
                            createdAt: true,
                        },
                    },
                },
            }),
            this.prisma.ticket.count({ where: { userId } }),
        ]);
        return (0, pagination_dto_1.paginate)(tickets, total, page, limit);
    }
    async getOne(ticketId, userId) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                messages: { orderBy: { createdAt: "asc" } },
            },
        });
        if (!ticket) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Ticket not found",
            });
        }
        if (ticket.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        return ticket;
    }
    async addMessage(ticketId, userId, username, dto) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new common_1.NotFoundException({
                code: "NOT_FOUND",
                message: "Ticket not found",
            });
        }
        if (ticket.userId !== userId) {
            throw new common_1.ForbiddenException({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        if (ticket.status === "CLOSED") {
            throw new common_1.ForbiddenException({
                code: "TICKET_CLOSED",
                message: "Cannot reply to a closed ticket",
            });
        }
        const message = await this.prisma.ticketMessage.create({
            data: {
                ticketId,
                senderId: userId,
                senderName: username,
                isAdmin: false,
                body: dto.body,
            },
        });
        // Update ticket status and clear reminder
        await this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                status: "AWAITING_ADMIN",
                reminderSentAt: null,
            },
        });
        return message;
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map