import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConfigFlagsService } from './config-flags.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRedis() {
    return {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
    };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ConfigFlagsService', () => {
    let service: ConfigFlagsService;
    let redis: ReturnType<typeof makeRedis>;

    beforeEach(() => {
        redis = makeRedis();
        service = new ConfigFlagsService(redis as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── getFlags ──────────────────────────────────────────────────────────────

    describe('getFlags', () => {
        it('returns inviteOnly: false when Redis key is null', async () => {
            redis.get.mockResolvedValue(null);

            const result = await service.getFlags();

            expect(result).toEqual({ inviteOnly: false });
        });

        it('returns inviteOnly: false when Redis key is "false"', async () => {
            redis.get.mockResolvedValue('false');

            const result = await service.getFlags();

            expect(result).toEqual({ inviteOnly: false });
        });

        it('returns inviteOnly: true when Redis key is "true"', async () => {
            redis.get.mockResolvedValue('true');

            const result = await service.getFlags();

            expect(result).toEqual({ inviteOnly: true });
        });

        it('reads from the config:invite_only key', async () => {
            redis.get.mockResolvedValue(null);

            await service.getFlags();

            expect(redis.get).toHaveBeenCalledWith('config:invite_only');
        });

        it('treats any non-"true" string as false', async () => {
            redis.get.mockResolvedValue('1');

            const result = await service.getFlags();

            expect(result.inviteOnly).toBe(false);
        });
    });

    // ── setInviteOnly ─────────────────────────────────────────────────────────

    describe('setInviteOnly', () => {
        it('sets "true" in Redis and returns inviteOnly: true', async () => {
            const result = await service.setInviteOnly(true);

            expect(result).toEqual({ inviteOnly: true });
            expect(redis.set).toHaveBeenCalledWith('config:invite_only', 'true');
        });

        it('sets "false" in Redis and returns inviteOnly: false', async () => {
            const result = await service.setInviteOnly(false);

            expect(result).toEqual({ inviteOnly: false });
            expect(redis.set).toHaveBeenCalledWith('config:invite_only', 'false');
        });

        it('always writes to the config:invite_only key', async () => {
            await service.setInviteOnly(true);

            const call = redis.set.mock.calls[0];
            expect(call[0]).toBe('config:invite_only');
        });

        it('stores "false" string (not boolean false) in Redis when disabled', async () => {
            await service.setInviteOnly(false);

            const call = redis.set.mock.calls[0];
            expect(call[1]).toBe('false');
            expect(typeof call[1]).toBe('string');
        });

        it('stores "true" string (not boolean true) in Redis when enabled', async () => {
            await service.setInviteOnly(true);

            const call = redis.set.mock.calls[0];
            expect(call[1]).toBe('true');
            expect(typeof call[1]).toBe('string');
        });
    });
});
