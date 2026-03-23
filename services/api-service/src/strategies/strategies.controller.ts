import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser, RequireScopes, ApiKeyScopeGuard } from "@polyforge/shared-auth";
import { StrategiesService } from "./strategies.service";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { ImportStrategyDto } from "./dto/import-strategy.dto";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("strategies")
@ApiBearerAuth("jwt")
@Controller("strategies")
@UseGuards(JwtAuthGuard)
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get("templates")
  listTemplates(@Query() query: PaginationDto) {
    return this.strategies.listTemplates(query);
  }

  @Get()
  list(@CurrentUser() user: any, @Query() query: StrategyQueryDto) {
    return this.strategies.list(user.sub, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  create(@CurrentUser() user: any, @Body() dto: CreateStrategyDto) {
    return this.strategies.create(user.sub, dto);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.findOne(id, user.sub);
  }

  @Patch(":id")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.strategies.update(id, user.sub, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.remove(id, user.sub);
  }

  @Get(":id/export")
  async exportStrategy(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { payload, filename } = await this.strategies.exportStrategy(
      id,
      user.sub,
    );
    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.json(payload);
  }

  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  importStrategy(@CurrentUser() user: any, @Body() dto: ImportStrategyDto) {
    return this.strategies.importStrategy(dto, user.sub);
  }

  @Post(":id/start")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('TRADE')
  start(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: StartStrategyDto,
  ) {
    return this.strategies.start(id, user.sub, dto);
  }

  @Post(":id/stop")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('TRADE')
  stop(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.stop(id, user.sub);
  }

  @Post(":id/pause")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('TRADE')
  pause(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.pause(id, user.sub);
  }

  @Post(":id/resume")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('TRADE')
  resume(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.resume(id, user.sub);
  }

  @Post(":id/fork")
  @HttpCode(HttpStatus.CREATED)
  fork(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.fork(id, user.sub);
  }

  @Post(":id/like")
  like(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.strategies.like(id, user.sub);
  }

  @Get(":id/comments")
  listComments(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.strategies.listComments(id, query);
  }

  @Post(":id/comments")
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.strategies.addComment(id, user.sub, dto);
  }

  @Delete(":strategyId/comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @Param("strategyId", ParseUUIDPipe) strategyId: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.strategies.deleteComment(strategyId, commentId, user.sub);
  }

  @Get(":id/children")
  listChildren(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.strategies.listChildren(id, user.sub);
  }

  @Post(":id/report")
  @HttpCode(HttpStatus.CREATED)
  report(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: ReportStrategyDto,
  ) {
    return this.strategies.report(id, user.sub, dto);
  }
}
