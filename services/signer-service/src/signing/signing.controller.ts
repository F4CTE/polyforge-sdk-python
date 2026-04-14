import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SigningService } from "./signing.service";
import { SignOrderDto } from "./dto/sign-order.dto";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Controller("sign")
@UseGuards(InternalAuthGuard)
@Throttle({
  default: {
    ttl: 60000,
    limit: process.env.NODE_ENV === "production" ? 30 : 10000,
  },
})
export class SigningController {
  constructor(private readonly signing: SigningService) {}

  @Post("order")
  @HttpCode(200)
  async signOrder(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SignOrderDto,
  ) {
    return this.signing.signOrder(dto);
  }
}
