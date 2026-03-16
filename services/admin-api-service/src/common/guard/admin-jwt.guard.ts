import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@polyforge/shared-redis';
import { AdminJwtPayload } from '@polyforge/shared-types';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'dev-admin-secret';

@Injectable()
export class AdminJwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly redis: RedisService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing token');
        }

        const token = authHeader.slice(7);
        let payload: AdminJwtPayload;

        try {
            payload = this.jwtService.verify<AdminJwtPayload>(token, {
                secret: ADMIN_JWT_SECRET,
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // Verify Redis session is still active
        const sessionKey = `admin:session:${payload.sessionId}`;
        const adminId = await this.redis.get(sessionKey);
        if (!adminId) {
            throw new UnauthorizedException('Session expired or revoked');
        }

        request.admin = payload;
        request.adminIp = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown';
        return true;
    }
}
