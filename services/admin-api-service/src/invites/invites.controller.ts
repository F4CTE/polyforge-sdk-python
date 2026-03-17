import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { GenerateInvitesDto } from './dto/generate-invites.dto';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { AuditService } from '../common/audit/audit.service';

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
    async generate(@Body() dto: GenerateInvitesDto, @Req() req: any) {
        const result = await this.invites.generate(dto);
        await this.audit.log({
            adminId: req.user.sub,
            action: 'INVITE_GENERATE',
            targetType: 'invite',
            payload: { count: dto.count ?? 1, uses: dto.uses ?? 1, ttlDays: dto.ttlDays },
            ip: req.ip,
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
    async revoke(@Param('code') code: string, @Req() req: any) {
        await this.invites.revoke(code);
        await this.audit.log({
            adminId: req.user.sub,
            action: 'INVITE_REVOKE',
            targetType: 'invite',
            targetId: code.toUpperCase(),
            ip: req.ip,
        });
        return { message: 'Invite code revoked' };
    }
}
