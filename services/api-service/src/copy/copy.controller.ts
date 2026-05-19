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
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  CurrentUser,
  ApiKeyScopeGuard,
  RequireScopes,
} from "@polyforge/shared-auth";
import { CopyService } from "./copy.service";
import { CreateCopyDto } from "./dto/create-copy.dto";
import { UpdateCopyDto } from "./dto/update-copy.dto";
import { JwtPayload } from "@polyforge/shared-types";
import { GeoBlockGuard } from "../common/guards/geo.guard";

@ApiTags("copy")
@ApiBearerAuth("jwt")
@Controller("copy")
@UseGuards(JwtAuthGuard)
export class CopyController {
  constructor(private readonly copy: CopyService) {}

  @Post()
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCopyDto) {
    return this.copy.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.copy.list(user.sub);
  }

  @Get(":id")
  getDetail(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.copy.getDetail(id, user.sub);
  }

  @Patch(":id")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("TRADE")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCopyDto,
  ) {
    return this.copy.update(id, user.sub, dto);
  }

  @Post(":id/pause")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("TRADE")
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.copy.pause(id, user.sub);
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  resume(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.copy.resume(id, user.sub);
  }

  @Delete(":id")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("TRADE")
  @HttpCode(HttpStatus.OK)
  stop(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.copy.stop(id, user.sub);
  }

  @Get(":id/trades")
  getTrades(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.copy.getTrades(
      id,
      user.sub,
      parseInt(page ?? "1", 10),
      Math.min(parseInt(limit ?? "20", 10), 100),
    );
  }
}
