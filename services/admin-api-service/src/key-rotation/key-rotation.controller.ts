import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { KeyRotationService } from "./key-rotation.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AuditService } from "../common/audit/audit.service";
import {
  CurrentAdmin,
  AdminIp,
} from "../common/decorators/current-admin.decorator";
import { AdminJwtPayload, AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@Controller("key-rotation")
export class KeyRotationController {
  constructor(
    private readonly keyRotation: KeyRotationService,
    private readonly audit: AuditService,
  ) {}

  @Get("status")
  getStatus() {
    return this.keyRotation.getStatus();
  }

  @Post("start")
  @Roles(AdminRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async startRotation(
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "START_KEY_ROTATION",
      targetType: "system",
      targetId: "jwt-secret",
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.keyRotation.startRotation();
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
