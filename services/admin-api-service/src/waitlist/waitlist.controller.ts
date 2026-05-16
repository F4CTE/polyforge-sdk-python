import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  PipeTransform,
  Injectable,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { isEmail } from "class-validator";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminJwtPayload, AdminRole } from "@polyforge/shared-types";
import { AuditService } from "../common/audit/audit.service";
import {
  CurrentAdmin,
  AdminIp,
} from "../common/decorators/current-admin.decorator";
import { InvitesService } from "../invites/invites.service";
import { AdminMailService } from "../mail/mail.service";
import { WaitlistAdminService } from "./waitlist.service";

@Injectable()
class ParseEmailParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const decoded = decodeURIComponent(value);
    if (!isEmail(decoded))
      throw new BadRequestException("Invalid email address");
    return decoded;
  }
}

@ApiTags("waitlist")
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("waitlist")
export class WaitlistAdminController {
  constructor(
    private readonly waitlist: WaitlistAdminService,
    private readonly invites: InvitesService,
    private readonly mail: AdminMailService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all waitlist entries" })
  async list() {
    const entries = await this.waitlist.list();
    return { total: entries.length, data: entries };
  }

  @Post(":email/send-invite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Generate a single-use invite code and email it to a waitlist entry",
  })
  async sendInvite(
    @Param("email", ParseEmailParamPipe) email: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "SEND_WAITLIST_INVITE",
      targetType: "waitlist",
      targetId: email,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const { codes } = await this.invites.generate({ count: 1, uses: 1 });
    const code = codes[0];
    await this.mail.sendInviteEmail(email, code);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return { code, sentTo: email };
  }

  @Delete(":email")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove email from waitlist" })
  async remove(
    @Param("email", ParseEmailParamPipe) email: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "DELETE_WAITLIST_ENTRY",
      targetType: "waitlist",
      targetId: email,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    await this.waitlist.remove(email);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
  }
}
