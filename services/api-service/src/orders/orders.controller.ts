import { Controller, Get, Post, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { IsOptional, IsString } from 'class-validator';
import { OrdersService } from './orders.service';
import { ClosePositionDto } from './dto/close-position.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

class OrderQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    strategyId?: string;

    @IsOptional()
    @IsString()
    from?: string;

    @IsOptional()
    @IsString()
    to?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly orders: OrdersService) {}

    @Get()
    list(@CurrentUser() user: any, @Query() query: OrderQueryDto) {
        return this.orders.list(user.sub, query);
    }

    @Post('close-position')
    @HttpCode(HttpStatus.ACCEPTED)
    closePosition(@CurrentUser() user: any, @Body() dto: ClosePositionDto) {
        return this.orders.closePosition(user.sub, dto);
    }
}
