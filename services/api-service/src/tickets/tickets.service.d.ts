import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
export declare class TicketsService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    create(userId: string, username: string, dto: CreateTicketDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.TicketStatus;
        priority: import(".prisma/client").$Enums.TicketPriority;
        userId: string;
        subject: string;
        createdAt: Date;
        category: import(".prisma/client").$Enums.TicketCategory;
        assignedTo: string | null;
        updatedAt: Date;
        closedBy: string | null;
        closedAt: Date | null;
        reminderSentAt: Date | null;
    }>;
    listMy(userId: string, page: number, limit: number): Promise<import("../common/dto/pagination.dto").PaginatedResponse<{
        messages: {
            body: string;
            createdAt: Date;
            senderName: string;
            isAdmin: boolean;
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.TicketStatus;
        priority: import(".prisma/client").$Enums.TicketPriority;
        userId: string;
        subject: string;
        createdAt: Date;
        category: import(".prisma/client").$Enums.TicketCategory;
        assignedTo: string | null;
        updatedAt: Date;
        closedBy: string | null;
        closedAt: Date | null;
        reminderSentAt: Date | null;
    }>>;
    getOne(ticketId: string, userId: string): Promise<{
        messages: {
            body: string;
            id: string;
            createdAt: Date;
            ticketId: string;
            senderId: string;
            senderName: string;
            isAdmin: boolean;
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.TicketStatus;
        priority: import(".prisma/client").$Enums.TicketPriority;
        userId: string;
        subject: string;
        createdAt: Date;
        category: import(".prisma/client").$Enums.TicketCategory;
        assignedTo: string | null;
        updatedAt: Date;
        closedBy: string | null;
        closedAt: Date | null;
        reminderSentAt: Date | null;
    }>;
    addMessage(ticketId: string, userId: string, username: string, dto: CreateMessageDto): Promise<{
        body: string;
        id: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        senderName: string;
        isAdmin: boolean;
    }>;
}
//# sourceMappingURL=tickets.service.d.ts.map