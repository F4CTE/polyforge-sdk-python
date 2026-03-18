import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Record<string, unknown> = {}) {
    return {
        id: 'report-1',
        strategyId: 'strat-1',
        reporterId: 'user-1',
        reason: 'spam',
        status: 'OPEN',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date('2024-03-01'),
        reporter: { username: 'alice', email: 'alice@example.com' },
        strategy: { name: 'My Strategy', userId: 'user-2' },
        ...overrides,
    };
}

function makePrisma() {
    return {
        report: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            count: vi.fn(),
            update: vi.fn(),
        },
    };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
    let service: ReportsService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new ReportsService(prisma as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── findAll ───────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('returns paginated report list with correct shape', async () => {
            const reports = [makeReport(), makeReport({ id: 'report-2' })];
            prisma.report.findMany.mockResolvedValue(reports as any);
            prisma.report.count.mockResolvedValue(2);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
            expect(result.pages).toBe(1);
        });

        it('filters by status when provided', async () => {
            prisma.report.findMany.mockResolvedValue([] as any);
            prisma.report.count.mockResolvedValue(0);

            await service.findAll({ page: 1, limit: 10, status: 'OPEN' });

            const call = prisma.report.findMany.mock.calls[0][0];
            expect(call.where.status).toBe('OPEN');
        });

        it('does not apply status filter when omitted', async () => {
            prisma.report.findMany.mockResolvedValue([] as any);
            prisma.report.count.mockResolvedValue(0);

            await service.findAll({ page: 1, limit: 10 });

            const call = prisma.report.findMany.mock.calls[0][0];
            expect(call.where.status).toBeUndefined();
        });

        it('computes pages correctly when total is not evenly divisible', async () => {
            prisma.report.findMany.mockResolvedValue([makeReport()] as any);
            prisma.report.count.mockResolvedValue(25);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.pages).toBe(3);
        });

        it('includes reporter and strategy in the include clause', async () => {
            prisma.report.findMany.mockResolvedValue([] as any);
            prisma.report.count.mockResolvedValue(0);

            await service.findAll({ page: 1, limit: 10 });

            const call = prisma.report.findMany.mock.calls[0][0];
            expect(call.include.reporter).toBeDefined();
            expect(call.include.strategy).toBeDefined();
        });

        it('applies correct skip for page 2 with limit 5', async () => {
            prisma.report.findMany.mockResolvedValue([] as any);
            prisma.report.count.mockResolvedValue(0);

            await service.findAll({ page: 2, limit: 5 });

            const call = prisma.report.findMany.mock.calls[0][0];
            expect(call.skip).toBe(5);
            expect(call.take).toBe(5);
        });
    });

    // ── review ────────────────────────────────────────────────────────────────

    describe('review', () => {
        it('updates report status and sets reviewedBy/reviewedAt', async () => {
            const report = makeReport();
            const updated = { ...report, status: 'RESOLVED', reviewedBy: 'admin-1', reviewedAt: new Date() };
            prisma.report.findUnique.mockResolvedValue(report as any);
            prisma.report.update.mockResolvedValue(updated as any);

            const result = await service.review('report-1', 'admin-1', { status: 'RESOLVED' });

            expect(result.status).toBe('RESOLVED');
            expect(result.reviewedBy).toBe('admin-1');
        });

        it('passes adminId as reviewedBy', async () => {
            const report = makeReport();
            prisma.report.findUnique.mockResolvedValue(report as any);
            prisma.report.update.mockResolvedValue({ ...report, reviewedBy: 'admin-42' } as any);

            await service.review('report-1', 'admin-42', { status: 'DISMISSED' });

            const updateCall = prisma.report.update.mock.calls[0][0];
            expect(updateCall.data.reviewedBy).toBe('admin-42');
            expect(updateCall.data.status).toBe('DISMISSED');
        });

        it('sets reviewedAt to a Date on review', async () => {
            const report = makeReport();
            prisma.report.findUnique.mockResolvedValue(report as any);
            prisma.report.update.mockResolvedValue({ ...report, reviewedAt: new Date() } as any);

            await service.review('report-1', 'admin-1', { status: 'RESOLVED' });

            const updateCall = prisma.report.update.mock.calls[0][0];
            expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
        });

        it('throws NotFoundException when report does not exist', async () => {
            prisma.report.findUnique.mockResolvedValue(null);

            await expect(service.review('ghost', 'admin-1', { status: 'RESOLVED' })).rejects.toThrow(NotFoundException);
        });

        it('includes code NOT_FOUND in the exception', async () => {
            prisma.report.findUnique.mockResolvedValue(null);

            await expect(service.review('ghost', 'admin-1', { status: 'RESOLVED' })).rejects.toMatchObject({
                response: { code: 'NOT_FOUND' },
            });
        });
    });
});
