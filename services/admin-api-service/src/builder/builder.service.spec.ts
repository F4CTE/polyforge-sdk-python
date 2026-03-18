import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BuilderService } from './builder.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
    return {
        order: {
            aggregate: vi.fn().mockResolvedValue({
                _sum: { size: null },
                _count: { id: 0 },
            }),
        },
        strategy: {
            count: vi.fn().mockResolvedValue(0),
        },
        user: {
            count: vi.fn().mockResolvedValue(0),
        },
    };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BuilderService', () => {
    let service: BuilderService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new BuilderService(prisma as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── getStats ──────────────────────────────────────────────────────────────

    describe('getStats', () => {
        it('returns all expected fields', async () => {
            const result = await service.getStats();

            expect(result).toHaveProperty('attributedVolumeUsdc');
            expect(result).toHaveProperty('totalOrders');
            expect(result).toHaveProperty('activeStrategies');
            expect(result).toHaveProperty('connectedUsers');
            expect(result).toHaveProperty('currentTier');
            expect(result).toHaveProperty('weeklyRewardUsdc');
        });

        it('returns zero attributedVolumeUsdc when _sum.size is null', async () => {
            prisma.order.aggregate.mockResolvedValue({ _sum: { size: null }, _count: { id: 0 } });

            const result = await service.getStats();

            expect(result.attributedVolumeUsdc).toBe(0);
        });

        it('returns the actual sum when orders exist', async () => {
            prisma.order.aggregate.mockResolvedValue({ _sum: { size: 12345.67 }, _count: { id: 42 } });

            const result = await service.getStats();

            expect(result.attributedVolumeUsdc).toBe(12345.67);
            expect(result.totalOrders).toBe(42);
        });

        it('returns correct activeStrategies count', async () => {
            prisma.strategy.count.mockResolvedValue(7);

            const result = await service.getStats();

            expect(result.activeStrategies).toBe(7);
        });

        it('returns correct connectedUsers count', async () => {
            prisma.user.count.mockResolvedValue(33);

            const result = await service.getStats();

            expect(result.connectedUsers).toBe(33);
        });

        it('aggregates only CONFIRMED orders with a strategyId', async () => {
            prisma.order.aggregate.mockResolvedValue({ _sum: { size: 0 }, _count: { id: 0 } });

            await service.getStats();

            const call = prisma.order.aggregate.mock.calls[0][0];
            expect(call.where.status).toBe('CONFIRMED');
            expect(call.where.strategyId).toEqual({ not: null });
        });

        it('counts only RUNNING strategies', async () => {
            prisma.strategy.count.mockResolvedValue(0);

            await service.getStats();

            const call = prisma.strategy.count.mock.calls[0][0];
            expect(call.where.status).toBe('RUNNING');
        });

        it('counts only polymarketConnected, non-suspended, non-deleted users', async () => {
            prisma.user.count.mockResolvedValue(0);

            await service.getStats();

            const call = prisma.user.count.mock.calls[0][0];
            expect(call.where.polymarketConnected).toBe(true);
            expect(call.where.suspended).toBe(false);
            expect(call.where.deleted).toBe(false);
        });

        it('sets currentTier and weeklyRewardUsdc to null (placeholder)', async () => {
            const result = await service.getStats();

            expect(result.currentTier).toBeNull();
            expect(result.weeklyRewardUsdc).toBeNull();
        });

        it('returns totalOrders as 0 when no confirmed orders exist', async () => {
            prisma.order.aggregate.mockResolvedValue({ _sum: { size: null }, _count: { id: 0 } });

            const result = await service.getStats();

            expect(result.totalOrders).toBe(0);
        });
    });
});
