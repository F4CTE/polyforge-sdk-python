import { Controller, Get, Delete, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { WaitlistAdminService } from './waitlist.service';

@ApiTags('waitlist')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('waitlist')
export class WaitlistAdminController {
    constructor(private readonly waitlist: WaitlistAdminService) {}

    @Get()
    @ApiOperation({ summary: 'List all waitlist entries' })
    async list() {
        const entries = await this.waitlist.list();
        return { total: entries.length, data: entries };
    }

    @Delete(':email')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove email from waitlist' })
    async remove(@Param('email') email: string) {
        await this.waitlist.remove(email);
    }
}
