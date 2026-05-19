import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RetentionService } from "./retention.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("admin/retention")
export class RetentionController {
  private static readonly DEFAULT_COHORT_MONTHS = 6;
  private static readonly DEFAULT_TREND_DAYS = 30;
  private static readonly MIN_MONTHS = 1;
  private static readonly MAX_MONTHS = 24;
  private static readonly MIN_DAYS = 1;
  private static readonly MAX_DAYS = 365;

  constructor(private readonly retention: RetentionService) {}

  @Get("overview")
  getOverview() {
    return this.retention.getOverview();
  }

  @Get("cohorts")
  getCohorts(@Query("months") months?: string) {
    return this.retention.getCohorts(
      this.parseBoundedInt(
        months,
        RetentionController.DEFAULT_COHORT_MONTHS,
        RetentionController.MIN_MONTHS,
        RetentionController.MAX_MONTHS,
        "months",
      ),
    );
  }

  @Get("trend")
  getTrend(@Query("days") days?: string) {
    return this.retention.getTrend(
      this.parseBoundedInt(
        days,
        RetentionController.DEFAULT_TREND_DAYS,
        RetentionController.MIN_DAYS,
        RetentionController.MAX_DAYS,
        "days",
      ),
    );
  }

  private parseBoundedInt(
    value: string | undefined,
    defaultValue: number,
    min: number,
    max: number,
    fieldName: string,
  ): number {
    if (value === undefined) return defaultValue;

    if (!/^[0-9]+$/.test(value)) {
      throw new BadRequestException(
        `${fieldName} must be an integer between ${min} and ${max}`,
      );
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${fieldName} must be an integer between ${min} and ${max}`,
      );
    }

    return parsed;
  }
}
