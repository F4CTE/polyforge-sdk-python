import { Controller, Post, Delete, Param, Get, HttpCode, UseGuards } from '@nestjs/common';
import { StrategyRegistryService } from '../strategy/strategy-registry.service';
import { InternalAuthGuard } from '../common/internal-auth.guard';

/**
 * Internal HTTP endpoints, called by api-service.
 * All require valid internal service JWT.
 */
@Controller('internal/strategies')
@UseGuards(InternalAuthGuard)
export class InternalController {
    constructor(private readonly registry: StrategyRegistryService) {}

    @Post(':id/start')
    @HttpCode(204)
    async start(@Param('id') id: string): Promise<void> {
        await this.registry.start(id);
    }

    @Post(':id/pause')
    @HttpCode(204)
    async pause(@Param('id') id: string): Promise<void> {
        await this.registry.pause(id);
    }

    @Post(':id/resume')
    @HttpCode(204)
    async resume(@Param('id') id: string): Promise<void> {
        await this.registry.resume(id);
    }

    @Delete(':id')
    @HttpCode(204)
    async stop(@Param('id') id: string): Promise<void> {
        await this.registry.stop(id);
    }

    @Get(':id/status')
    getStatus(@Param('id') id: string) {
        const status = this.registry.getStatus(id);
        return { strategyId: id, status: status ?? 'NOT_RUNNING' };
    }
}
