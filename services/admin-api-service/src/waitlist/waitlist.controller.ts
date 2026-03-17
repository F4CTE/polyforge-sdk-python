import { Controller, Get, Delete, Post, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { InvitesService } from '../invites/invites.service';
import { AdminMailService } from '../mail/mail.service';
import { WaitlistAdminService } from './waitlist.service';

@ApiTags('waitlist')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('waitlist')
export class WaitlistAdminController {
    constructor(
        private readonly waitlist: WaitlistAdminService,
        private readonly invites: InvitesService,
        private readonly mail: AdminMailService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'List all waitlist entries' })
    async list() {
        const entries = await this.waitlist.list();
        return { total: entries.length, data: entries };
    }

    @Post(':email/send-invite')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Generate a single-use invite code and email it to a waitlist entry' })
    async sendInvite(@Param('email') email: string) {
        const { codes } = await this.invites.generate({ count: 1, uses: 1 });
        const code = codes[0];
        await this.mail.sendInviteEmail(decodeURIComponent(email), code);
        return { code, sentTo: decodeURIComponent(email) };
    }

    @Delete(':email')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove email from waitlist' })
    async remove(@Param('email') email: string) {
        await this.waitlist.remove(email);
    }
}
