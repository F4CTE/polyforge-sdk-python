import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';
import { GenerateInvitesDto } from './dto/generate-invites.dto';

const INVITE_KEY = (code: string) => `invite:${code.toUpperCase()}`;
const INVITE_INDEX_KEY = 'invites:index'; // Redis set of all active codes

function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
    let code = 'POLY-';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

@Injectable()
export class InvitesService {
    constructor(private readonly redis: RedisService) {}

    // ─── Generate ─────────────────────────────────────────────────────────────

    async generate(dto: GenerateInvitesDto): Promise<{ codes: string[] }> {
        const count = dto.count ?? 1;
        const uses = dto.uses ?? 1;
        const ttlSeconds = dto.ttlDays ? dto.ttlDays * 86_400 : undefined;

        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            const code = generateCode();
            const key = INVITE_KEY(code);
            await this.redis.set(key, String(uses), ttlSeconds);
            await this.redis.getClient().sadd(INVITE_INDEX_KEY, code);
            codes.push(code);
        }
        return { codes };
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    async list(): Promise<{ code: string; remainingUses: number; ttl: number }[]> {
        const codes = await this.redis.getClient().smembers(INVITE_INDEX_KEY);
        const results: { code: string; remainingUses: number; ttl: number }[] = [];

        for (const code of codes) {
            const key = INVITE_KEY(code);
            const [uses, ttl] = await Promise.all([
                this.redis.get(key),
                this.redis.getClient().ttl(key),
            ]);
            if (uses === null) {
                // Expired — clean from index
                await this.redis.getClient().srem(INVITE_INDEX_KEY, code);
                continue;
            }
            results.push({ code, remainingUses: parseInt(uses, 10), ttl });
        }

        return results.sort((a, b) => a.code.localeCompare(b.code));
    }

    // ─── Revoke ───────────────────────────────────────────────────────────────

    async revoke(code: string): Promise<void> {
        const key = INVITE_KEY(code);
        const exists = await this.redis.exists(key);
        if (!exists) {
            throw new HttpException(
                { code: 'INVITE_NOT_FOUND', message: 'Invite code not found or already expired' },
                HttpStatus.NOT_FOUND,
            );
        }
        await Promise.all([
            this.redis.del(key),
            this.redis.getClient().srem(INVITE_INDEX_KEY, code.toUpperCase()),
        ]);
    }
}
