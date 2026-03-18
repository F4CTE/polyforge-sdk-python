import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { GenerateInvitesDto } from './dto/generate-invites.dto';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { AuditService } from '../common/audit/audit.service';
import { CurrentAdmin, AdminIp } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '@polyforge/shared-types';

@ApiTags('invites')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('invites')
export class InvitesController {
    constructor(
        private readonly invites: InvitesService,
        private readonly audit: AuditService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Generate invite codes' })
    async generate(
        @Body() dto: GenerateInvitesDto,
        @CurrentAdmin() admin: AdminJwtPayload,
        @AdminIp() ip: string,
    ) {
        const result = await this.invites.generate(dto);
        await this.audit.log({
            adminId: admin.sub,
            action: 'INVITE_GENERATE',
            targetType: 'invite',
            payload: { count: dto.count ?? 1, uses: dto.uses ?? 1, ttlDays: dto.ttlDays },
            ip,
        });
        return result;
    }

    @Get()
    @ApiOperation({ summary: 'List active invite codes' })
    list() {
        return this.invites.list();
    }

    @Delete(':code')
    @ApiOperation({ summary: 'Revoke an invite code' })
    async revoke(
        @Param('code') code: string,
        @CurrentAdmin() admin: AdminJwtPayload,
        @AdminIp() ip: string,
    ) {
        await this.invites.revoke(code);
        await this.audit.log({
            adminId: admin.sub,
            action: 'INVITE_REVOKE',
            targetType: 'invite',
            targetId: code.toUpperCase(),
            ip,
        });
        return { message: 'Invite code revoked' };
    }
}
