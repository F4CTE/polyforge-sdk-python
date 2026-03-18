import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "@polyforge/shared-db";

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
    // Strip control characters and newlines to prevent log injection.
    // Keep printable ASCII + common IP/IPv6 characters only.

    const safeIp = params.ip.replace(/[^\x20-\x7E]/g, "").slice(0, 64);

    await this.adminDb.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        payload: params.payload as any,
        ip: safeIp,
      },
    });
  }
}
