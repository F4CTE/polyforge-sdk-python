import { Injectable } from '@nestjs/common';
import { PrismaAdminService } from '@polyforge/shared-db';

@Injectable()
export class AuditService {
    constructor(private readonly adminDb: PrismaAdminService) {}

    async log(params: {
        adminId: string;
        action: string;
        targetType: string;
        targetId?: string;
        payload?: Record<string, unknown>;
        ip: string;
    }) {
        await this.adminDb.auditLog.create({
            data: {
                adminId: params.adminId,
                action: params.action,
                targetType: params.targetType,
                targetId: params.targetId,
                payload: params.payload as any,
                ip: params.ip,
            },
        });
    }
}
