import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';

@UseGuards(AdminJwtGuard)
@Controller('health')
export class DashboardController {
    constructor(private readonly dashboard: DashboardService) {}

    @Get()
    getHealth() {
        return this.dashboard.getHealth();
    }
}
