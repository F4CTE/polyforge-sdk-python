import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { CacheAdminService } from './cache.service';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';

@UseGuards(AdminJwtGuard)
@Controller('cache')
export class CacheAdminController {
    constructor(private readonly cacheAdmin: CacheAdminService) {}

    @Get('stats')
    getStats() {
        return this.cacheAdmin.getStats();
    }

    @Delete(':pattern')
    flushPattern(@Param('pattern') pattern: string) {
        return this.cacheAdmin.flushPattern(pattern);
    }
}
