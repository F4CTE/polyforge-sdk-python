import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { CacheAdminService } from "./cache.service";
import { FlushCacheDto } from "./flush-cache.dto";
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
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("cache")
export class CacheAdminController {
  constructor(
    private readonly cacheAdmin: CacheAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get("stats")
  getStats() {
    return this.cacheAdmin.getStats();
  }

  @Get("streams")
  getStreamStats() {
    return this.cacheAdmin.getStreamStats();
  }

  @Delete(":pattern")
  async flushPattern(
    @Param("pattern") pattern: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    // Validate pattern against whitelist
    if (!FlushCacheDto.isAllowed(pattern)) {
      throw new BadRequestException(
        `Pattern "${pattern}" is not allowed. ` +
          `Allowed patterns: ${FlushCacheDto.ALLOWED_PATTERNS.join(", ")}`,
      );
    }
    const auditMeta = {
      adminId: admin.sub,
      action: "FLUSH_CACHE",
      targetType: "cache",
      targetId: pattern,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.cacheAdmin.flushPattern(pattern);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
