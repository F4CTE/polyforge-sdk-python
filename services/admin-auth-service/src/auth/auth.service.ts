import { Injectable, HttpException, HttpStatus, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaAdminService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { AdminJwtPayload, AdminRole } from "@polyforge/shared-types";
import * as bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from "crypto";
import { AdminLoginDto } from "./dto/login.dto";

const PENDING_TOTP_TTL = 300; // 5 minutes
const ALGORITHM = "aes-256-gcm";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private encryptionKey!: Buffer;

  constructor(
    private readonly adminDb: PrismaAdminService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const keyHex = this.config.getOrThrow<string>("TOTP_ENCRYPTION_KEY");
    this.encryptionKey = Buffer.from(keyHex, "hex");
    if (this.encryptionKey.length !== 32) {
      throw new Error(
        "TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
      );
    }
  }

  // ─── TOTP Setup ──────────────────────────────────────────────────────────────

  async setupTotp(
    adminId: string,
  ): Promise<{ secret: string; uri: string; qrCode: string }> {
    const admin = await this.adminDb.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.active) {
      throw new HttpException(
        { code: "ADMIN_NOT_FOUND", message: "Admin not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    if ((admin as any).totpEnabled) {
      throw new HttpException(
        {
          code: "TOTP_ALREADY_ENABLED",
          message: "2FA is already enabled on this account",
        },
        HttpStatus.CONFLICT,
      );
    }

    // Dynamic import to match user-facing auth service pattern
    const otplib = await import("otplib"); const authenticator = (otplib as any).authenticator ?? (otplib as any).default?.authenticator ?? otplib;
    const QRCode = await import("qrcode");

    const secret = authenticator.generateSecret(20);
    const uri = authenticator.keyuri(admin.email, "Polyforge Admin", secret);
    const qrCode = await QRCode.toDataURL(uri);

    // Store pending secret in Redis with TTL — not yet committed to DB
    await this.redis.set(`totp:pending:admin:${adminId}`, secret, PENDING_TOTP_TTL);

    return { secret, uri, qrCode };
  }

  // ─── TOTP Confirm ────────────────────────────────────────────────────────────

  async confirmTotp(adminId: string, code: string): Promise<{ enabled: boolean }> {
    const pendingSecret = await this.redis.get(`totp:pending:admin:${adminId}`);

    if (!pendingSecret) {
      throw new HttpException(
        {
          code: "TOTP_SETUP_EXPIRED",
          message: "TOTP setup session expired. Please start again.",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const otplib = await import("otplib"); const authenticator = (otplib as any).authenticator ?? (otplib as any).default?.authenticator ?? otplib;
    let isValid = false;
    try {
      isValid = authenticator.check(code, pendingSecret);
    } catch {
      // malformed code — treat as invalid
    }

    if (!isValid) {
      throw new HttpException(
        { code: "TOTP_INVALID", message: "Invalid 2FA code" },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Encrypt the TOTP secret for storage
    const encryptedSecret = this.encrypt(pendingSecret);

    await this.adminDb.admin.update({
      where: { id: adminId },
      data: {
        totpSecret: encryptedSecret,
        totpEnabled: true,
      } as any,
    });

    await this.redis.del(`totp:pending:admin:${adminId}`);

    return { enabled: true };
  }

  // ─── TOTP Disable ────────────────────────────────────────────────────────────

  async disableTotp(adminId: string): Promise<void> {
    const admin = await this.adminDb.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new HttpException(
        { code: "ADMIN_NOT_FOUND", message: "Admin not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!(admin as any).totpEnabled) {
      throw new HttpException(
        {
          code: "TOTP_NOT_ENABLED",
          message: "2FA is not enabled on this account",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.adminDb.admin.update({
      where: { id: adminId },
      data: {
        totpSecret: null,
        totpEnabled: false,
      } as any,
    });
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: AdminLoginDto) {
    const admin = await this.adminDb.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.active) {
      throw new HttpException(
        { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new HttpException(
        { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        HttpStatus.BAD_REQUEST,
      );
    }

    // If TOTP is enabled, require a valid code
    if ((admin as any).totpEnabled) {
      if (!dto.totpCode) {
        throw new HttpException(
          { code: "TOTP_REQUIRED", message: "2FA code is required" },
          HttpStatus.FORBIDDEN,
        );
      }

      const secret = this.decrypt((admin as any).totpSecret);
      const otplib = await import("otplib"); const authenticator = (otplib as any).authenticator ?? (otplib as any).default?.authenticator ?? otplib;
      let totpValid = false;
      try {
        totpValid = authenticator.check(dto.totpCode, secret);
      } catch {
        // malformed code
      }

      if (!totpValid) {
        throw new HttpException(
          { code: "TOTP_INVALID", message: "Invalid 2FA code" },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const sessionId = randomUUID();

    // Store session in Redis — TTL matches JWT expiry (1h = 3600s)
    await this.redis.set(`admin:session:${sessionId}`, admin.id, 3600);

    const payload: AdminJwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role as AdminRole,
      sessionId,
    };

    const token = this.jwtService.sign(payload, { expiresIn: "1h" });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        displayName: admin.displayName,
      },
    };
  }

  async getMe(token: string) {
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: process.env.ADMIN_JWT_SECRET!,
      });
    } catch {
      throw new HttpException(
        { code: "UNAUTHORIZED", message: "Invalid or expired session" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sessionValid = await this.redis.get(
      `admin:session:${payload.sessionId}`,
    );
    if (!sessionValid) {
      throw new HttpException(
        { code: "SESSION_EXPIRED", message: "Session expired or revoked" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const admin = await this.adminDb.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        active: true,
      },
    });

    if (!admin || !admin.active) {
      throw new HttpException(
        { code: "ACCOUNT_INACTIVE", message: "Account is inactive" },
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      displayName: admin.displayName,
    };
  }

  async logout(authHeader: string | undefined) {
    if (!authHeader?.startsWith("Bearer ")) return;
    try {
      const token = authHeader.slice(7);
      const payload = this.jwtService.verify<AdminJwtPayload>(token);
      await this.redis.del(`admin:session:${payload.sessionId}`);
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
  }

  // ─── Encryption helpers ───────────────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  private decrypt(stored: string): string {
    const [ivHex, tagHex, ciphertextHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  }
}
