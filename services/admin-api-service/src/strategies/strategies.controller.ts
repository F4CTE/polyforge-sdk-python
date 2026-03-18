import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
    ParseUUIDPipe,
} from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';
import { AuditService } from '../common/audit/audit.service';
import { CurrentAdmin, AdminIp } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '@polyforge/shared-types';

@UseGuards(AdminJwtGuard)
@Controller('strategies')
export class StrategiesController {
    constructor(
        private readonly strategies: StrategiesService,
        private readonly audit: AuditService,
    ) {}

    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('userId') userId?: string,
        @Query('status') status?: string,
        @Query('visibility') visibility?: string,
    ) {
        return this.strategies.findAll({ page, limit, userId, status, visibility });
    }

    @Post(':id/force-stop')
    async forceStop(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentAdmin() admin: AdminJwtPayload,
        @AdminIp() ip: string,
    ) {
        const result = await this.strategies.forceStop(id);
        await this.audit.log({
            adminId: admin.sub,
            action: 'FORCE_STOP_STRATEGY',
            targetType: 'strategy',
            targetId: id,
            ip,
        });
        return result;
    }

    @Patch(':id/unpublish')
    async unpublish(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentAdmin() admin: AdminJwtPayload,
        @AdminIp() ip: string,
    ) {
        const result = await this.strategies.unpublish(id);
        await this.audit.log({
            adminId: admin.sub,
            action: 'UNPUBLISH_STRATEGY',
            targetType: 'strategy',
            targetId: id,
            ip,
        });
        return result;
    }
}
