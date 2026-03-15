import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaAdminService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { AdminJwtPayload, AdminRole } from '@polyforge/shared-types';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AdminLoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminDb: PrismaAdminService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) { }

  async login(dto: AdminLoginDto) {
    const admin = await this.adminDb.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.active) {
      throw new HttpException(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new HttpException(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        HttpStatus.BAD_REQUEST,
      );
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

    const token = this.jwtService.sign(payload);

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

  async logout(authHeader: string | undefined) {
    if (!authHeader?.startsWith('Bearer ')) return;
    try {
      const token = authHeader.slice(7);
      const payload = this.jwtService.verify<AdminJwtPayload>(token);
      await this.redis.del(`admin:session:${payload.sessionId}`);
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
  }
}
