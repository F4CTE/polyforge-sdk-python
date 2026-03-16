import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';

@UseGuards(AdminJwtGuard)
@Controller('orders')
export class OrdersController {
    constructor(private readonly orders: OrdersService) {}

    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('userId') userId?: string,
        @Query('status') status?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.orders.findAll({ page, limit, userId, status, from, to });
    }

    @Get('dlq')
    getDlq() {
        return this.orders.getDlq();
    }

    @Post('dlq/:intentId/replay')
    replayDlqEntry(@Param('intentId') intentId: string) {
        return this.orders.replayDlqEntry(intentId);
    }

    @Post('dlq/:intentId/discard')
    discardDlqEntry(@Param('intentId') intentId: string) {
        return this.orders.discardDlqEntry(intentId);
    }
}
