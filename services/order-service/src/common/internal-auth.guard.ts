import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@polyforge/shared-redis';
import { FastifyRequest } from 'fastify';

@Injectable()
export class InternalAuthGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly redis: RedisService,
    ) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest<FastifyRequest>();
        const auth = req.headers['authorization'];

        if (!auth?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing service token');
        }

        const token = auth.slice(7);
        let payload: any;

        try {
            payload = this.jwt.verify(token, {
                secret: this.config.get<string>('INTERNAL_JWT_SECRET'),
                audience: 'order-service',
            });
        } catch {
            throw new UnauthorizedException('Invalid service token');
        }

        if (!payload.jti) {
            throw new UnauthorizedException('Token missing jti');
        }

        // Redis SET NX — atomic replay protection, survives restarts and scales horizontally.
        // TTL = 60s (2× the max JWT expiry for internal tokens).
        const key = `jti:order:${payload.jti}`;
        const set = await this.redis.getClient().set(key, '1', 'EX', 60, 'NX');
        if (set === null) {
            throw new UnauthorizedException('Token already used');
        }

        return true;
    }
}
