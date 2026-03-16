import {
    Controller,
    Post,
    Body,
    HttpCode,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ClosePositionDto } from './dto/close-position.dto';
import { InternalAuthGuard } from '../common/internal-auth.guard';

/**
 * Internal-only controller.
 * Called by api-service when a user requests manual position close.
 */
@Controller('orders')
@UseGuards(InternalAuthGuard)
export class OrdersController {
    constructor(private readonly orders: OrdersService) {}

    @Post('close')
    @HttpCode(204)
    async closePosition(
        @Body(new ValidationPipe({ whitelist: true }))
        dto: ClosePositionDto,
    ): Promise<void> {
        await this.orders.closePosition(
            dto.userId,
            dto.tokenId,
            dto.marketId,
            dto.size,
            dto.strategyId,
        );
    }
}
