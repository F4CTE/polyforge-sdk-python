import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { BotLinkService } from './bot-link.service';

function makeMockRedis() {
    return {
        get: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
    };
}

describe('BotLinkService', () => {
    let service: BotLinkService;
    let redis: ReturnType<typeof makeMockRedis>;

    beforeEach(() => {
        redis = makeMockRedis();
        service = new BotLinkService(redis as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── generate ──────────────────────────────────────────────────────────────

    describe('generate', () => {
        it('returns a 6-digit code and 300s expiry', async () => {
            const result = await service.generate('user-id');

            expect(result.code).toMatch(/^\d{6}$/);
            expect(result.expiresInSeconds).toBe(300);
        });

        it('stores the userId under bot:link:{code} with 300s TTL', async () => {
            const result = await service.generate('user-abc');

            expect(redis.set).toHaveBeenCalledWith(
                `bot:link:${result.code}`,
                'user-abc',
                300,
            );
        });

        it('generates unique codes across calls', async () => {
            const results = await Promise.all([
                service.generate('user-1'),
                service.generate('user-2'),
                service.generate('user-3'),
            ]);

            const codes = results.map(r => r.code);
            // High probability of uniqueness (1/1,000,000 collision per pair)
            const unique = new Set(codes);
            expect(unique.size).toBeGreaterThanOrEqual(2);
        });
    });

    // ── consume ───────────────────────────────────────────────────────────────

    describe('consume', () => {
        it('returns the userId and deletes the code on valid code', async () => {
            redis.get.mockResolvedValue('user-abc');

            const userId = await service.consume('123456');

            expect(userId).toBe('user-abc');
            expect(redis.del).toHaveBeenCalledWith('bot:link:123456');
        });

        it('throws BOT_LINK_INVALID (400) when code does not exist', async () => {
            redis.get.mockResolvedValue(null);

            await expect(service.consume('999999')).rejects.toMatchObject({
                response: { code: 'BOT_LINK_INVALID' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('does not delete the code when it is invalid', async () => {
            redis.get.mockResolvedValue(null);

            await service.consume('000000').catch(() => {});
            expect(redis.del).not.toHaveBeenCalled();
        });
    });
});
