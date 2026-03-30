import { TicketsService } from "./tickets.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
export declare class TicketsController {
    private readonly tickets;
    constructor(tickets: TicketsService);
    create(user: any, dto: CreateTicketDto): Promise<{
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
    list(user: any, page: number, limit: number): Promise<import("../common/dto/pagination.dto").PaginatedResponse<{
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
    getOne(id: string, user: any): Promise<{
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
    addMessage(id: string, user: any, dto: CreateMessageDto): Promise<{
        body: string;
        id: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        senderName: string;
        isAdmin: boolean;
    }>;
}
//# sourceMappingURL=tickets.controller.d.ts.map