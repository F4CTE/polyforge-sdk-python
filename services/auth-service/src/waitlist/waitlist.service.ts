import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';
import { MailService } from '../mail/mail.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

const KEY = 'waitlist:emails';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  async join(dto: JoinWaitlistDto): Promise<{ joined: boolean }> {
    const email = dto.email.toLowerCase().trim();
    const client = this.redis.getClient();
    const added = await client.zadd(KEY, 'NX', Date.now(), email);
    // Send confirmation only on first signup (added === 1)
    if (added === 1) {
      this.mail
        .sendWaitlistConfirmationEmail(email)
        .catch((err) =>
          this.logger.error(
            `Failed to send waitlist confirmation to ${email}: ${err.message}`,
          ),
        );
    }
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
