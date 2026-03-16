import { Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { IsOptional, IsString } from 'class-validator';
import { BacktestsService } from './backtests.service';
import { CreateBacktestDto } from './dto/create-backtest.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

class BacktestQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    strategyId?: string;

    @IsOptional()
    @IsString()
    status?: string;
}

@Controller('backtests')
@UseGuards(JwtAuthGuard)
export class BacktestsController {
    constructor(private readonly backtests: BacktestsService) {}

    @Get()
    list(@CurrentUser() user: any, @Query() query: BacktestQueryDto) {
        return this.backtests.list(user.sub, query);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@CurrentUser() user: any, @Body() dto: CreateBacktestDto) {
        return this.backtests.create(user.sub, dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.backtests.findOne(id, user.sub);
    }
}
