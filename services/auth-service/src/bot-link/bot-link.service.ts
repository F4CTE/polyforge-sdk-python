import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';
import { randomInt } from 'crypto';

const BOT_LINK_TTL = 300;       // 5 minutes
const BOT_LINK_DIGITS = 6;

@Injectable()
export class BotLinkService {
    private readonly logger = new Logger(BotLinkService.name);

    constructor(private readonly redis: RedisService) {}

    /**
     * Generate a one-time 6-digit code for linking a bot account.
     * The bot service validates this code and returns a bot JWT.
     */
    async generate(userId: string): Promise<{ code: string; expiresInSeconds: number }> {
        const code = String(randomInt(0, 1_000_000)).padStart(BOT_LINK_DIGITS, '0');

        // Store userId under the code key so bot-service can look up the user
        await this.redis.set(`bot:link:${code}`, userId, BOT_LINK_TTL);

        this.logger.debug(`Bot link code generated for user ${userId}`);

        return { code, expiresInSeconds: BOT_LINK_TTL };
    }

    /**
     * Validate and consume a bot link code.
     * Called by bot-service via internal API — not exposed to users.
     */
    async consume(code: string): Promise<string> {
        const userId = await this.redis.get(`bot:link:${code}`);

        if (!userId) {
            throw new HttpException(
                { code: 'BOT_LINK_INVALID', message: 'Invalid or expired bot link code' },
                HttpStatus.BAD_REQUEST,
            );
        }

        // One-time use — delete immediately
        await this.redis.del(`bot:link:${code}`);

        return userId;
    }
}
