import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { InvitesService } from './invites.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRedis() {
    const client = {
        sadd: vi.fn().mockResolvedValue(1),
        smembers: vi.fn().mockResolvedValue([]),
        srem: vi.fn().mockResolvedValue(1),
        ttl: vi.fn().mockResolvedValue(86400),
    };
    return {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        getClient: vi.fn().mockReturnValue(client),
    };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('InvitesService', () => {
    let service: InvitesService;
    let redis: ReturnType<typeof makeRedis>;

    beforeEach(() => {
        redis = makeRedis();
        service = new InvitesService(redis as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── generate ──────────────────────────────────────────────────────────────

    describe('generate', () => {
        it('returns the requested number of codes', async () => {
            const result = await service.generate({ count: 3 });

            expect(result.codes).toHaveLength(3);
        });

        it('defaults to 1 code when count is not provided', async () => {
            const result = await service.generate({});

            expect(result.codes).toHaveLength(1);
        });

        it('generates codes matching the POLY-XXXXXX format', async () => {
            const result = await service.generate({ count: 5 });

            for (const code of result.codes) {
                expect(code).toMatch(/^POLY-[A-Z2-9]{6}$/);
            }
        });

        it('does not include ambiguous characters (0, O, 1, I) in codes', async () => {
            // Generate a large batch to statistically cover the charset
            const result = await service.generate({ count: 50 });

            for (const code of result.codes) {
                const suffix = code.replace('POLY-', '');
                expect(suffix).not.toMatch(/[01OI]/);
            }
        });

        it('stores each code in Redis via redis.set', async () => {
            await service.generate({ count: 2 });

            expect(redis.set).toHaveBeenCalledTimes(2);
        });

        it('adds each code to the invite index set', async () => {
            const client = redis.getClient();
            await service.generate({ count: 2 });

            expect(client.sadd).toHaveBeenCalledTimes(2);
            expect(client.sadd).toHaveBeenCalledWith('invites:index', expect.stringMatching(/^POLY-/));
        });

        it('passes TTL in seconds when ttlDays is provided', async () => {
            await service.generate({ count: 1, ttlDays: 7 });

            // 7 days = 604800 seconds
            expect(redis.set).toHaveBeenCalledWith(
                expect.stringMatching(/^invite:POLY-/),
                '1',
                7 * 86400,
            );
        });

        it('passes no TTL when ttlDays is not provided', async () => {
            await service.generate({ count: 1 });

            expect(redis.set).toHaveBeenCalledWith(
                expect.stringMatching(/^invite:POLY-/),
                '1',
                undefined,
            );
        });

        it('stores the uses count as a string', async () => {
            await service.generate({ count: 1, uses: 5 });

            expect(redis.set).toHaveBeenCalledWith(
                expect.any(String),
                '5',
                undefined,
            );
        });
    });

    // ── list ──────────────────────────────────────────────────────────────────

    describe('list', () => {
        it('returns an empty array when no codes exist', async () => {
            const client = redis.getClient();
            client.smembers.mockResolvedValue([]);

            const result = await service.list();

            expect(result).toEqual([]);
        });

        it('returns code with remainingUses and ttl for active codes', async () => {
            const client = redis.getClient();
            client.smembers.mockResolvedValue(['POLY-AAAAAB']);
            redis.get.mockResolvedValue('3');
            client.ttl.mockResolvedValue(3600);

            const result = await service.list();

            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('POLY-AAAAAB');
            expect(result[0].remainingUses).toBe(3);
            expect(result[0].ttl).toBe(3600);
        });

        it('cleans up expired codes from the index when uses is null', async () => {
            const client = redis.getClient();
            client.smembers.mockResolvedValue(['POLY-EXPIRED']);
            redis.get.mockResolvedValue(null); // expired key

            const result = await service.list();

            expect(result).toHaveLength(0);
            expect(client.srem).toHaveBeenCalledWith('invites:index', 'POLY-EXPIRED');
        });

        it('returns codes sorted alphabetically', async () => {
            const client = redis.getClient();
            client.smembers.mockResolvedValue(['POLY-ZZZ222', 'POLY-AAA222', 'POLY-MMM222']);
            redis.get.mockResolvedValue('1');
            client.ttl.mockResolvedValue(3600);

            const result = await service.list();

            expect(result[0].code).toBe('POLY-AAA222');
            expect(result[1].code).toBe('POLY-MMM222');
            expect(result[2].code).toBe('POLY-ZZZ222');
        });
    });

    // ── revoke ────────────────────────────────────────────────────────────────

    describe('revoke', () => {
        it('deletes the invite key and removes from index', async () => {
            redis.exists.mockResolvedValue(true);
            const client = redis.getClient();

            await service.revoke('POLY-AAAAAB');

            expect(redis.del).toHaveBeenCalledWith('invite:POLY-AAAAAB');
            expect(client.srem).toHaveBeenCalledWith('invites:index', 'POLY-AAAAAB');
        });

        it('throws INVITE_NOT_FOUND (404) when code does not exist', async () => {
            redis.exists.mockResolvedValue(false);

            await expect(service.revoke('POLY-GHOST1')).rejects.toMatchObject({
                response: { code: 'INVITE_NOT_FOUND' },
                status: HttpStatus.NOT_FOUND,
            });
        });

        it('uppercases the code when removing from index', async () => {
            redis.exists.mockResolvedValue(true);
            const client = redis.getClient();

            await service.revoke('poly-aaaaab');

            expect(client.srem).toHaveBeenCalledWith('invites:index', 'POLY-AAAAAB');
        });

        it('looks up key with uppercase code', async () => {
            redis.exists.mockResolvedValue(true);

            await service.revoke('POLY-XYZXYZ');

            expect(redis.exists).toHaveBeenCalledWith('invite:POLY-XYZXYZ');
        });
    });
});
