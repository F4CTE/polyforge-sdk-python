import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WaitlistAdminService } from './waitlist.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRedisClient() {
    return {
        zrange: vi.fn().mockResolvedValue([]),
        zcard: vi.fn().mockResolvedValue(0),
        zrem: vi.fn().mockResolvedValue(1),
    };
}

function makeRedis(client = makeRedisClient()) {
    return {
        getClient: vi.fn().mockReturnValue(client),
    };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('WaitlistAdminService', () => {
    let service: WaitlistAdminService;
    let redis: ReturnType<typeof makeRedis>;
    let client: ReturnType<typeof makeRedisClient>;

    beforeEach(() => {
        client = makeRedisClient();
        redis = makeRedis(client);
        service = new WaitlistAdminService(redis as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── list ──────────────────────────────────────────────────────────────────

    describe('list', () => {
        it('returns an empty array when the waitlist is empty', async () => {
            client.zrange.mockResolvedValue([]);

            const result = await service.list();

            expect(result).toEqual([]);
        });

        it('returns email + joinedAt pairs from the sorted set', async () => {
            const ts = 1700000000000;
            client.zrange.mockResolvedValue(['alice@example.com', String(ts)]);

            const result = await service.list();

            expect(result).toHaveLength(1);
            expect(result[0].email).toBe('alice@example.com');
            expect(result[0].joinedAt).toBe(new Date(ts).toISOString());
        });

        it('handles multiple entries correctly', async () => {
            const ts1 = 1700000000000;
            const ts2 = 1700000001000;
            client.zrange.mockResolvedValue([
                'alice@example.com', String(ts1),
                'bob@example.com', String(ts2),
            ]);

            const result = await service.list();

            expect(result).toHaveLength(2);
            expect(result[0].email).toBe('alice@example.com');
            expect(result[1].email).toBe('bob@example.com');
        });

        it('calls zrange with WITHSCORES on the correct key', async () => {
            client.zrange.mockResolvedValue([]);

            await service.list();

            expect(client.zrange).toHaveBeenCalledWith('waitlist:emails', 0, -1, 'WITHSCORES');
        });

        it('converts timestamp scores to ISO strings', async () => {
            const ts = 1710000000000;
            client.zrange.mockResolvedValue(['carol@example.com', String(ts)]);

            const result = await service.list();

            expect(result[0].joinedAt).toBe(new Date(ts).toISOString());
        });
    });

    // ── count ─────────────────────────────────────────────────────────────────

    describe('count', () => {
        it('returns 0 when the waitlist is empty', async () => {
            client.zcard.mockResolvedValue(0);

            const result = await service.count();

            expect(result).toBe(0);
        });

        it('returns the number of entries from zcard', async () => {
            client.zcard.mockResolvedValue(42);

            const result = await service.count();

            expect(result).toBe(42);
        });

        it('calls zcard on the correct key', async () => {
            client.zcard.mockResolvedValue(0);

            await service.count();

            expect(client.zcard).toHaveBeenCalledWith('waitlist:emails');
        });
    });

    // ── remove ────────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('calls zrem with the lowercased and trimmed email', async () => {
            await service.remove('Alice@Example.COM');

            expect(client.zrem).toHaveBeenCalledWith('waitlist:emails', 'alice@example.com');
        });

        it('trims whitespace from the email before removing', async () => {
            await service.remove('  bob@example.com  ');

            expect(client.zrem).toHaveBeenCalledWith('waitlist:emails', 'bob@example.com');
        });

        it('resolves without throwing for a valid email', async () => {
            await expect(service.remove('carol@example.com')).resolves.toBeUndefined();
        });

        it('resolves without throwing even when the email was not in the list', async () => {
            client.zrem.mockResolvedValue(0); // 0 means not found, but not an error

            await expect(service.remove('ghost@example.com')).resolves.toBeUndefined();
        });

        it('calls zrem on the correct sorted set key', async () => {
            await service.remove('test@test.com');

            expect(client.zrem).toHaveBeenCalledWith('waitlist:emails', expect.any(String));
        });
    });
});
