import { Injectable } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';

const INVITE_ONLY_KEY = 'config:invite_only';

@Injectable()
export class ConfigFlagsService {
    constructor(private readonly redis: RedisService) {}

    async getFlags(): Promise<{ inviteOnly: boolean }> {
        const val = await this.redis.get(INVITE_ONLY_KEY);
        return { inviteOnly: val === 'true' };
    }

    async setInviteOnly(enabled: boolean): Promise<{ inviteOnly: boolean }> {
        await this.redis.set(INVITE_ONLY_KEY, enabled ? 'true' : 'false');
        return { inviteOnly: enabled };
    }
}
