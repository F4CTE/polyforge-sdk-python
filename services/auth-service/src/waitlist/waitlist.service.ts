import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

const KEY = 'waitlist:emails';

@Injectable()
export class WaitlistService {
    constructor(private readonly redis: RedisService) {}

    async join(dto: JoinWaitlistDto): Promise<{ joined: boolean }> {
        const email = dto.email.toLowerCase().trim();
        const client = this.redis.getClient();
        // zadd NX — only add if not already member
        const added = await client.zadd(KEY, 'NX', Date.now(), email);
        // added is 1 if inserted, 0 if already present — both are OK responses
        return { joined: true };
    }

    async list(): Promise<Array<{ email: string; joinedAt: string }>> {
        const client = this.redis.getClient();
        // ZRANGE with WITHSCORES — returns [member, score, member, score, ...]
        const raw = await client.zrange(KEY, 0, -1, 'WITHSCORES');
        const result: Array<{ email: string; joinedAt: string }> = [];
        for (let i = 0; i < raw.length; i += 2) {
            result.push({
                email: raw[i],
                joinedAt: new Date(parseInt(raw[i + 1], 10)).toISOString(),
            });
        }
        return result;
    }

    async remove(email: string): Promise<void> {
        const client = this.redis.getClient();
        await client.zrem(KEY, email.toLowerCase().trim());
    }

    async count(): Promise<number> {
        const client = this.redis.getClient();
        return client.zcard(KEY);
    }
}
