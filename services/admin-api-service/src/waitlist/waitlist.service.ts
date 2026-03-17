import { Injectable } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';

const KEY = 'waitlist:emails';

@Injectable()
export class WaitlistAdminService {
    constructor(private readonly redis: RedisService) {}

    async list(): Promise<Array<{ email: string; joinedAt: string }>> {
        const client = this.redis.getClient();
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

    async count(): Promise<number> {
        const client = this.redis.getClient();
        return client.zcard(KEY);
    }

    async remove(email: string): Promise<void> {
        const client = this.redis.getClient();
        await client.zrem(KEY, email.toLowerCase().trim());
    }
}
