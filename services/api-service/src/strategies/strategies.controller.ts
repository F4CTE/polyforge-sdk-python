import {
    Controller, Get, Post, Patch, Delete, Param, Body, Query,
    UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { StartStrategyDto } from './dto/start-strategy.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportStrategyDto } from './dto/report-strategy.dto';
import { StrategyQueryDto } from './dto/strategy-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategiesController {
    constructor(private readonly strategies: StrategiesService) {}

    @Get('templates')
    listTemplates(@Query() query: PaginationDto) {
        return this.strategies.listTemplates(query);
    }

    @Get()
    list(@CurrentUser() user: any, @Query() query: StrategyQueryDto) {
        return this.strategies.list(user.sub, query);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@CurrentUser() user: any, @Body() dto: CreateStrategyDto) {
        return this.strategies.create(user.sub, dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.findOne(id, user.sub);
    }

    @Patch(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateStrategyDto) {
        return this.strategies.update(id, user.sub, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.remove(id, user.sub);
    }

    @Post(':id/start')
    start(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: StartStrategyDto) {
        return this.strategies.start(id, user.sub, dto);
    }

    @Post(':id/stop')
    stop(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.stop(id, user.sub);
    }

    @Post(':id/pause')
    pause(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.pause(id, user.sub);
    }

    @Post(':id/resume')
    resume(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.resume(id, user.sub);
    }

    @Post(':id/fork')
    @HttpCode(HttpStatus.CREATED)
    fork(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.fork(id, user.sub);
    }

    @Post(':id/like')
    like(@Param('id') id: string, @CurrentUser() user: any) {
        return this.strategies.like(id, user.sub);
    }

    @Get(':id/comments')
    listComments(@Param('id') id: string, @Query() query: PaginationDto) {
        return this.strategies.listComments(id, query);
    }

    @Post(':id/comments')
    @HttpCode(HttpStatus.CREATED)
    addComment(
        @Param('id') id: string,
        @CurrentUser() user: any,
        @Body() dto: CreateCommentDto,
    ) {
        return this.strategies.addComment(id, user.sub, dto);
    }

    @Delete(':strategyId/comments/:commentId')
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteComment(
        @Param('strategyId') strategyId: string,
        @Param('commentId') commentId: string,
        @CurrentUser() user: any,
    ) {
        return this.strategies.deleteComment(strategyId, commentId, user.sub);
    }

    @Post(':id/report')
    @HttpCode(HttpStatus.CREATED)
    report(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ReportStrategyDto) {
        return this.strategies.report(id, user.sub, dto);
    }
}
