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
import { SigningService } from "./signing.service";
import { Ed25519SigningService } from "./ed25519-signing.service";
import { InternalAuthGuard } from "../common/internal-auth.guard";
import {
  RedeemPositionDto,
  SplitPositionDto,
  MergePositionDto,
} from "./dto/ctf-operations.dto";
import { ImportUsCredentialsDto } from "./dto/import-us-credentials.dto";

@Controller("internal")
@UseGuards(InternalAuthGuard)
export class InternalSigningController {
  constructor(
    private readonly signing: SigningService,
    private readonly ed25519: Ed25519SigningService,
  ) {}

  @Post("redeem-position")
  @HttpCode(200)
  async redeemPosition(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: RedeemPositionDto,
  ) {
    return this.signing.redeemPosition(dto);
  }

  @Post("split-position")
  @HttpCode(200)
  async splitPosition(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SplitPositionDto,
  ) {
    return this.signing.splitPosition(dto);
  }

  @Post("merge-position")
  @HttpCode(200)
  async mergePosition(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: MergePositionDto,
  ) {
    return this.signing.mergePosition(dto);
  }

  @Post("us-credentials")
  @HttpCode(204)
  async importUsCredentials(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: ImportUsCredentialsDto,
  ) {
    await this.ed25519.importUsCredentials(dto);
  }

  @Delete("us-credentials/:userId")
  @HttpCode(204)
  async deleteUsCredentials(@Param("userId", ParseUUIDPipe) userId: string) {
    await this.ed25519.deleteUsCredentials(userId);
  }
}
