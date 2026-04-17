import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { SigningService } from "./signing.service";
import { InternalAuthGuard } from "../common/internal-auth.guard";
import {
  RedeemPositionDto,
  SplitPositionDto,
  MergePositionDto,
} from "./dto/ctf-operations.dto";

@Controller("internal")
@UseGuards(InternalAuthGuard)
export class InternalSigningController {
  constructor(private readonly signing: SigningService) {}

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
}
