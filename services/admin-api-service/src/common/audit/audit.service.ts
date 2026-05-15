import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "@polyforge/shared-db";

// SECURITY: Audit logs are append-only. The DB has an INSERT-only rule preventing updates/deletes.
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
    status?: string;
  }) {
    // Strip control characters and newlines to prevent log injection.
    // Keep printable ASCII + common IP/IPv6 characters only.

    const safeIp = params.ip.replace(/[^\x20-\x7E]/g, "").slice(0, 45);

    await this.adminDb.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        status: params.status ?? "success",
        targetType: params.targetType,
        targetId: params.targetId,
        payload: params.payload as any,
        ip: safeIp,
      },
    });
  }

  /**
   * Best-effort audit logging — never throws.
   *
   * Use for the "success" audit row in the two-phase attempt/success pattern
   * when the privileged side effect has already committed and retrying the
   * endpoint would duplicate non-idempotent operations (email sends,
   * notification broadcasts, invite code generation, etc.).
   *
   * The "attempt" row (logged with {@link log}) already provides durable
   * audit evidence. If this call fails, the error is logged server-side so
   * the endpoint can return the committed result without a false 500.
   */
  async logSafe(params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    payload?: Record<string, unknown>;
    ip: string;
    status?: string;
  }) {
    try {
      await this.log(params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      console.error(
        `[AuditService] logSafe failed for action=${params.action} targetId=${params.targetId ?? "<none>"}: ${message}`,
      );
    }
  }
}
