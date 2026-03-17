import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { ConfigFlagsService } from './config-flags.service';

class SetInviteOnlyDto {
    @IsBoolean()
    enabled!: boolean;
}

@ApiTags('config')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('config')
export class ConfigFlagsController {
    constructor(private readonly flags: ConfigFlagsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all runtime config flags' })
    getFlags() {
        return this.flags.getFlags();
    }

    @Patch('invite-only')
    @ApiOperation({ summary: 'Toggle invite-only registration mode' })
    setInviteOnly(@Body() dto: SetInviteOnlyDto) {
        return this.flags.setInviteOnly(dto.enabled);
    }
}
