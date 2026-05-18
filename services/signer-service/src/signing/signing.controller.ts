import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  ValidationPipe,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SigningService } from "./signing.service";
import { Ed25519SigningService } from "./ed25519-signing.service";
import { SignOrderDto } from "./dto/sign-order.dto";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { SignKalshiJwtDto } from "./dto/sign-kalshi-jwt.dto";
import { SignPolymarketUsRequestDto } from "./dto/sign-polymarket-us-request.dto";
import { InternalAuthGuard } from "../common/internal-auth.guard";
import { FastifyRequest } from "fastify";

@Controller("sign")
@UseGuards(InternalAuthGuard)
@Throttle({
  default: {
    ttl: 60000,
    limit: process.env.NODE_ENV === "production" ? 30 : 10000,
  },
})
export class SigningController {
  constructor(
    private readonly signing: SigningService,
    private readonly ed25519: Ed25519SigningService,
  ) {}

  @Post("order")
  @HttpCode(200)
  async signOrder(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SignOrderDto,
  ) {
    return this.signing.signOrder(dto);
  }

  @Post("cancel-order")
  @HttpCode(204)
  async cancelOrder(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: CancelOrderDto,
  ) {
    await this.signing.cancelOrder(dto);
  }

  @Post("kalshi-jwt")
  @HttpCode(200)
  async signKalshiJwt(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SignKalshiJwtDto,
  ) {
    return this.signing.signKalshiJwt(dto.userId, dto.requestId);
  }

  @Post("polymarket-us")
  @HttpCode(200)
  async signPolymarketUs(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SignPolymarketUsRequestDto,
    @Req() req: FastifyRequest & { internalAuth?: { iss?: string; sub?: string } },
  ) {
    const auth = req.internalAuth;
    if (auth?.iss !== "order-service") {
      throw new ForbiddenException(
        "Only order-service can request Polymarket US signatures",
      );
    }
    if (auth?.sub !== undefined && auth?.sub !== "order-service") {
      throw new ForbiddenException(
        "Only order-service can request Polymarket US signatures",
      );
    }

    return this.ed25519.signRequest(dto.userId, dto.method, dto.path, dto.body);
  }
}
