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
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("cache")
export class CacheAdminController {
  constructor(private readonly cacheAdmin: CacheAdminService) {}

  @Get("stats")
  getStats() {
    return this.cacheAdmin.getStats();
  }

  @Get("streams")
  getStreamStats() {
    return this.cacheAdmin.getStreamStats();
  }

  @Delete(":pattern")
  flushPattern(@Param("pattern") pattern: string) {
    // Validate pattern against whitelist
    if (!FlushCacheDto.isAllowed(pattern)) {
      throw new BadRequestException(
        `Pattern "${pattern}" is not allowed. ` +
        `Allowed patterns: ${FlushCacheDto.ALLOWED_PATTERNS.join(", ")}`,
      );
    }
    return this.cacheAdmin.flushPattern(pattern);
  }
}
