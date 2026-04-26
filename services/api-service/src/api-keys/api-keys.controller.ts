import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("api-keys")
@ApiBearerAuth("jwt")
@Controller("api-keys")
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.keys.list(user.sub);
  }

  @Post()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 5 : 10000,
      ttl: 3_600_000,
    },
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiKeyDto) {
    return this.keys.create(user.sub, dto);
  }

  @Delete(":id")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 20 : 10000,
      ttl: 60_000,
    },
  })
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.keys.revoke(user.sub, id);
  }
}
