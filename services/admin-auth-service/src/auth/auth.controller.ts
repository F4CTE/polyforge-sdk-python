import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service";
import { AdminLoginDto } from "./dto/login.dto";
import { TotpConfirmDto } from "./dto/totp-confirm.dto";
import { TotpDisableDto } from "./dto/totp-disable.dto";
import { throttleLimit } from "../common/throttle-limit";

const ADMIN_COOKIE = "pf_admin_token";

// Default Secure=true so staging over HTTPS always uses Secure cookies.
// Set COOKIE_SECURE=false only for local HTTP dev (see .env.example).
function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60, // 1 hour — matches JWT expiry
  };
}

function extractAdminId(req: FastifyRequest, authService: AuthService): string {
  const token = req.cookies[ADMIN_COOKIE];
  if (!token) throw new UnauthorizedException("Not authenticated");
  // Cryptographically verify the JWT and extract admin ID
  const payload = authService.verifyToken(token);
  return payload.sub;
}

@ApiTags("Admin Auth")
@Controller("")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 10 : 10000,
      ttl: 900000,
    },
  })
  @ApiOperation({
    summary: "Admin login — sets HttpOnly JWT cookie + returns admin profile",
  })
  @ApiResponse({ status: 200, description: "Login successful." })
  @ApiResponse({ status: 401, description: "INVALID_CREDENTIALS" })
  @ApiResponse({
    status: 403,
    description: "TOTP_REQUIRED or ACCOUNT_INACTIVE",
  })
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto);
    reply.setCookie(ADMIN_COOKIE, result.token, cookieOpts());
    return result.admin;
  }

  @Get("me")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({
    summary: "Get current admin profile (requires valid session cookie)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the authenticated admin profile.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async me(@Req() req: FastifyRequest) {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) throw new UnauthorizedException("Not authenticated");
    return this.authService.getMe(token);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Admin logout — clears session cookie and revokes Redis session",
  })
  @ApiResponse({ status: 204, description: "Session revoked." })
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookieToken = req.cookies[ADMIN_COOKIE];
    const bearerHeader = req.headers["authorization"];
    await this.authService.logout(
      cookieToken ? `Bearer ${cookieToken}` : bearerHeader,
    );
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
  }

  // ─── TOTP Endpoints ──────────────────────────────────────────────────────────

  @Post("totp/setup")
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: throttleLimit(10), ttl: 3_600_000 },
  })
  @ApiOperation({ summary: "Setup TOTP 2FA — returns QR code URL + secret" })
  @ApiResponse({ status: 200, description: "QR code and secret returned." })
  @ApiResponse({ status: 409, description: "TOTP_ALREADY_ENABLED" })
  @ApiResponse({ status: 429, description: "Too many setup attempts." })
  async setupTotp(@Req() req: FastifyRequest) {
    const adminId = extractAdminId(req, this.authService);
    return this.authService.setupTotp(adminId);
  }

  @Post("totp/confirm")
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: throttleLimit(5), ttl: 900_000 },
  })
  @ApiOperation({ summary: "Confirm TOTP setup — enables 2FA" })
  @ApiResponse({ status: 200, description: "2FA enabled." })
  @ApiResponse({
    status: 400,
    description: "TOTP_INVALID or TOTP_SETUP_EXPIRED",
  })
  @ApiResponse({ status: 429, description: "Too many TOTP attempts." })
  async confirmTotp(@Req() req: FastifyRequest, @Body() body: TotpConfirmDto) {
    const adminId = extractAdminId(req, this.authService);
    return this.authService.confirmTotp(adminId, body.code);
  }

  @Delete("totp")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: { limit: throttleLimit(5), ttl: 900_000 },
  })
  @ApiOperation({
    summary:
      "Disable TOTP 2FA — requires password + current TOTP code for re-authentication",
  })
  @ApiResponse({ status: 204, description: "2FA disabled." })
  @ApiResponse({ status: 400, description: "TOTP_NOT_ENABLED" })
  @ApiResponse({
    status: 401,
    description: "RE_AUTH_FAILED — invalid password or TOTP code",
  })
  @ApiResponse({
    status: 429,
    description: "Too many disable attempts — wait 15 minutes.",
  })
  async disableTotp(@Req() req: FastifyRequest, @Body() body: TotpDisableDto) {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) throw new UnauthorizedException("Not authenticated");
    const payload = this.authService.verifyToken(token);
    await this.authService.disableTotp(
      payload.sub,
      payload.sessionId as string,
      body.password,
      body.totpCode,
    );
  }
}
