import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeAlert(overrides: Record<string, unknown> = {}) {
    return {
        id: 'alert-uuid-1',
        userId: 'user-uuid-1',
        tokenId: 'token-uuid-1',
        direction: 'above',
        price: '0.75',
        persistent: false,
        triggered: false,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides,
    };
}

function makeCreateAlertDto(overrides: Record<string, unknown> = {}) {
    return {
        tokenId: 'token-uuid-1',
        direction: 'above' as const,
        price: '0.75',
        persistent: false,
        ...overrides,
    };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
    let service: AlertsService;
    let db: MockDb;

    beforeEach(() => {
        db = createMockDb();
        service = new AlertsService(db as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── list ──────────────────────────────────────────────────────────────────

    describe('list', () => {
        it('returns non-triggered alerts for the user ordered by createdAt desc', async () => {
            const alerts = [makeAlert(), makeAlert({ id: 'alert-uuid-2', tokenId: 'token-uuid-2' })];
            db.priceAlert.findMany.mockResolvedValue(alerts as any);

            const result = await service.list('user-uuid-1');

            expect(result).toEqual(alerts);
            expect(db.priceAlert.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-uuid-1', triggered: false },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('returns an empty array when the user has no alerts', async () => {
            db.priceAlert.findMany.mockResolvedValue([]);

            const result = await service.list('user-uuid-1');

            expect(result).toEqual([]);
        });
    });

    // ── create ────────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates and returns an alert when under the limit', async () => {
            const dto = makeCreateAlertDto();
            const alert = makeAlert();
            db.priceAlert.count.mockResolvedValue(0);
            db.priceAlert.create.mockResolvedValue(alert as any);

            const result = await service.create('user-uuid-1', dto as any);

            expect(result).toEqual(alert);
            expect(db.priceAlert.count).toHaveBeenCalledWith({
                where: { userId: 'user-uuid-1', triggered: false },
            });
            expect(db.priceAlert.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-uuid-1',
                    tokenId: dto.tokenId,
                    direction: dto.direction,
                    price: dto.price,
                    persistent: false,
                },
            });
        });

        it('defaults persistent to false when not provided in dto', async () => {
            const dto = makeCreateAlertDto({ persistent: undefined });
            const alert = makeAlert({ persistent: false });
            db.priceAlert.count.mockResolvedValue(5);
            db.priceAlert.create.mockResolvedValue(alert as any);

            await service.create('user-uuid-1', dto as any);

            expect(db.priceAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ persistent: false }),
                }),
            );
        });

        it('stores persistent: true when explicitly set', async () => {
            const dto = makeCreateAlertDto({ persistent: true });
            db.priceAlert.count.mockResolvedValue(1);
            db.priceAlert.create.mockResolvedValue(makeAlert({ persistent: true }) as any);

            await service.create('user-uuid-1', dto as any);

            expect(db.priceAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ persistent: true }),
                }),
            );
        });

        it('throws ALERT_LIMIT_REACHED (422) when user already has 50 alerts', async () => {
            db.priceAlert.count.mockResolvedValue(50);

            await expect(service.create('user-uuid-1', makeCreateAlertDto() as any)).rejects.toThrow(
                UnprocessableEntityException,
            );
        });

        it('throws ALERT_LIMIT_REACHED with correct error code', async () => {
            db.priceAlert.count.mockResolvedValue(50);

            await expect(service.create('user-uuid-1', makeCreateAlertDto() as any)).rejects.toMatchObject({
                response: { code: 'ALERT_LIMIT_REACHED' },
            });
        });

        it('does NOT throw at exactly 49 alerts (boundary)', async () => {
            db.priceAlert.count.mockResolvedValue(49);
            db.priceAlert.create.mockResolvedValue(makeAlert() as any);

            await expect(service.create('user-uuid-1', makeCreateAlertDto() as any)).resolves.toBeDefined();
        });

        it('does NOT call prisma.create when the limit is reached', async () => {
            db.priceAlert.count.mockResolvedValue(50);

            await service.create('user-uuid-1', makeCreateAlertDto() as any).catch(() => {});

            expect(db.priceAlert.create).not.toHaveBeenCalled();
        });
    });

    // ── remove ────────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('deletes the alert when found and owned by the user', async () => {
            const alert = makeAlert({ userId: 'user-uuid-1' });
            db.priceAlert.findUnique.mockResolvedValue(alert as any);
            db.priceAlert.delete.mockResolvedValue(alert as any);

            await service.remove('alert-uuid-1', 'user-uuid-1');

            expect(db.priceAlert.delete).toHaveBeenCalledWith({ where: { id: 'alert-uuid-1' } });
        });

        it('returns void on successful deletion', async () => {
            const alert = makeAlert({ userId: 'user-uuid-1' });
            db.priceAlert.findUnique.mockResolvedValue(alert as any);
            db.priceAlert.delete.mockResolvedValue(alert as any);

            const result = await service.remove('alert-uuid-1', 'user-uuid-1');

            expect(result).toBeUndefined();
        });

        it('throws NotFoundException (404) when alert does not exist', async () => {
            db.priceAlert.findUnique.mockResolvedValue(null);

            await expect(service.remove('nonexistent-id', 'user-uuid-1')).rejects.toThrow(NotFoundException);
        });

        it('throws NOT_FOUND error code when alert does not exist', async () => {
            db.priceAlert.findUnique.mockResolvedValue(null);

            await expect(service.remove('nonexistent-id', 'user-uuid-1')).rejects.toMatchObject({
                response: { code: 'NOT_FOUND' },
            });
        });

        it('throws ForbiddenException (403) when alert belongs to a different user', async () => {
            const alert = makeAlert({ userId: 'other-user-id' });
            db.priceAlert.findUnique.mockResolvedValue(alert as any);

            await expect(service.remove('alert-uuid-1', 'user-uuid-1')).rejects.toThrow(ForbiddenException);
        });

        it('throws FORBIDDEN error code when alert belongs to a different user', async () => {
            const alert = makeAlert({ userId: 'other-user-id' });
            db.priceAlert.findUnique.mockResolvedValue(alert as any);

            await expect(service.remove('alert-uuid-1', 'user-uuid-1')).rejects.toMatchObject({
                response: { code: 'FORBIDDEN' },
            });
        });

        it('does NOT call delete when the alert is forbidden', async () => {
            const alert = makeAlert({ userId: 'other-user-id' });
            db.priceAlert.findUnique.mockResolvedValue(alert as any);

            await service.remove('alert-uuid-1', 'user-uuid-1').catch(() => {});

            expect(db.priceAlert.delete).not.toHaveBeenCalled();
        });
    });
});
