import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ClobClientService } from './clob-client.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(url = 'http://clob:3099'): ConfigService {
    return { get: (k: string, d?: string) => (k === 'CLOB_API_URL' ? url : d ?? '') } as any;
}

const SUBMIT_REQ = {
    order:          { tokenId: 'tok', signature: '0xsig' },
    builderHeaders: { POLY_BUILDER_API_KEY: 'k', POLY_BUILDER_TIMESTAMP: '1', POLY_BUILDER_PASSPHRASE: 'p', POLY_BUILDER_SIGNATURE: 's' },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ClobClientService', () => {
    let svc:      ClobClientService;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        svc      = new ClobClientService(makeConfig());
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── submitOrder ───────────────────────────────────────────────────────────

    describe('submitOrder()', () => {
        it('POSTs to /order on the configured CLOB URL', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'clob-1', status: 'LIVE' }) });
            await svc.submitOrder(SUBMIT_REQ);
            expect(fetchSpy.mock.calls[0][0]).toBe('http://clob:3099/order');
        });

        it('uses POST method', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await svc.submitOrder(SUBMIT_REQ);
            expect(fetchSpy.mock.calls[0][1].method).toBe('POST');
        });

        it('sets Content-Type: application/json', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await svc.submitOrder(SUBMIT_REQ);
            expect(fetchSpy.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
        });

        it('spreads builderHeaders into request headers', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await svc.submitOrder(SUBMIT_REQ);
            const headers = fetchSpy.mock.calls[0][1].headers;
            expect(headers.POLY_BUILDER_API_KEY).toBe('k');
            expect(headers.POLY_BUILDER_SIGNATURE).toBe('s');
        });

        it('serialises the order as the request body', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await svc.submitOrder(SUBMIT_REQ);
            const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
            expect(body.tokenId).toBe('tok');
            expect(body.signature).toBe('0xsig');
        });

        it('returns the parsed response with orderID and status', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'clob-456', status: 'MATCHED' }) });
            const result = await svc.submitOrder(SUBMIT_REQ);
            expect(result.orderID).toBe('clob-456');
            expect(result.status).toBe('MATCHED');
        });

        it('returns transactionHash when present', async () => {
            fetchSpy.mockResolvedValue({
                ok:   true,
                json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'CONFIRMED', transactionHash: '0xtx123' }),
            });
            const result = await svc.submitOrder(SUBMIT_REQ);
            expect(result.transactionHash).toBe('0xtx123');
        });

        it('throws an Error on non-OK response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 400, text: vi.fn().mockResolvedValue('Bad Request') });
            await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow('400');
        });

        it('error message includes the CLOB response body', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 422, text: vi.fn().mockResolvedValue('invalid size') });
            await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow('invalid size');
        });

        it('uses empty string when res.text() rejects (graceful degradation)', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockRejectedValue(new Error('read error')) });
            // Should still throw an Error even when body is unreadable
            await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow('500');
        });
    });

    // ── cancelOrder ───────────────────────────────────────────────────────────

    describe('cancelOrder()', () => {
        it('sends DELETE to /order/:clobOrderId', async () => {
            fetchSpy.mockResolvedValue({ ok: true });
            await svc.cancelOrder('order-abc', 'api-key-xyz');
            expect(fetchSpy.mock.calls[0][0]).toBe('http://clob:3099/order/order-abc');
            expect(fetchSpy.mock.calls[0][1].method).toBe('DELETE');
        });

        it('attaches POLY-API-KEY header', async () => {
            fetchSpy.mockResolvedValue({ ok: true });
            await svc.cancelOrder('order-abc', 'my-api-key');
            expect(fetchSpy.mock.calls[0][1].headers['POLY-API-KEY']).toBe('my-api-key');
        });

        it('resolves without error on success', async () => {
            fetchSpy.mockResolvedValue({ ok: true });
            await expect(svc.cancelOrder('order-abc', 'key')).resolves.toBeUndefined();
        });

        it('throws an Error on non-OK response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 404, text: vi.fn().mockResolvedValue('Order not found') });
            await expect(svc.cancelOrder('order-abc', 'key')).rejects.toThrow('404');
        });

        it('uses empty string when res.text() rejects during cancel error', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockRejectedValue(new Error('read err')) });
            await expect(svc.cancelOrder('order-abc', 'key')).rejects.toThrow('500');
        });
    });

    // ── URL config ────────────────────────────────────────────────────────────

    describe('URL configuration', () => {
        it('uses a custom CLOB URL from config', async () => {
            const customSvc = new ClobClientService(makeConfig('http://prod-clob:443'));
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await customSvc.submitOrder(SUBMIT_REQ);
            expect(fetchSpy.mock.calls[0][0]).toBe('http://prod-clob:443/order');
        });

        it('falls back to mock-polymarket URL when config returns undefined', async () => {
            const config = { get: () => undefined } as any as ConfigService;
            const fallbackSvc = new ClobClientService(config);
            fetchSpy.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ orderID: 'x', status: 'LIVE' }) });
            await fallbackSvc.submitOrder(SUBMIT_REQ);
            expect(fetchSpy.mock.calls[0][0]).toContain('mock-polymarket');
        });
    });
});
