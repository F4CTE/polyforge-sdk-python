import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { CredentialsService } from "./credentials.service";
import { ImportCredentialsDto } from "./dto/import-credentials.dto";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Controller("credentials")
@UseGuards(InternalAuthGuard)
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  @Post()
  @HttpCode(204)
  async import(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: ImportCredentialsDto,
  ): Promise<void> {
    await this.credentials.importCredentials(dto);
  }

  @Delete(":userId")
  @HttpCode(204)
  async delete(@Param("userId", ParseUUIDPipe) userId: string): Promise<void> {
    await this.credentials.deleteCredentials(userId);
  }
}
