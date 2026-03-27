import { Controller, Get, Post, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { ApiKeysService } from "./api-keys.service";

@ApiTags("api-keys")
@ApiBearerAuth("jwt")
@Controller("api-keys")
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.keys.list(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: any,
    @Body() dto: { name: string; scopes?: string[] },
  ) {
    return this.keys.create(user.sub, dto);
  }

  @Delete(":id")
  revoke(@CurrentUser() user: any, @Param("id") id: string) {
    return this.keys.revoke(user.sub, id);
  }
}
