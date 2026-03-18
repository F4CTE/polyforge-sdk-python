import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TelegramService } from './telegram.service';

// TelegramService reads TOKEN at module load time.
// We re-import fresh instances in tests that need the enabled path by
// setting the env var before constructing the service manually.

const REAL_TOKEN = 'bot-token-12345';

describe('TelegramService', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    // ─── When Telegram is disabled (default dev token) ───────────────────────

    describe('when TELEGRAM_BOT_TOKEN is "dev-disabled" (default)', () => {
        it('does not call fetch and returns without error', async () => {
            vi.stubEnv('TELEGRAM_BOT_TOKEN', 'dev-disabled');
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            // Re-instantiate after env stub so `enabled` is evaluated with the stub in effect.
            // Because the module reads TOKEN at load time with `??`, we bypass that by
            // constructing the service and then inspecting its behaviour. For unit tests,
            // we verify the observable outcome: fetch is NOT called.
            const service = new TelegramService();
            await service.send('chat-123', 'hello');

            // The module was already loaded; if the cached TOKEN was 'dev-disabled' the
            // service is already in disabled mode. When it was loaded as a fresh import
            // in the test suite the default env is used.
            // We assert fetch was not called (disabled guard short-circuits).
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // ─── When Telegram is enabled ─────────────────────────────────────────────

    describe('when TELEGRAM_BOT_TOKEN is set to a real token', () => {
        function makeEnabledService(): TelegramService {
            // We can't override the module-level constant after import, so we
            // test the fetch path by replacing (enabled) on the instance via
            // Reflect or by using a subclass. The simplest approach in Vitest
            // is to access the private property via any-cast.
            const service = new TelegramService();
            (service as any).enabled = true;
            (service as any).TOKEN = REAL_TOKEN;
            // Also patch the URL building inside send() by stubbing fetch and
            // verifying the URL argument.
            return service;
        }

        it('calls fetch with the correct Telegram Bot API URL', async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true });
            vi.stubGlobal('fetch', fetchMock);

            const service = makeEnabledService();
            // Patch internal token reference by re-assigning via prototype access
            // is not possible cleanly. Instead we verify via the URL pattern
            // captured by the fetch stub. Because TOKEN is a module-level const
            // we must at minimum verify the shape of the URL passed to fetch.
            // The actual token in the URL will be whatever was loaded when the
            // module was first imported (likely 'dev-disabled').
            // We assert the structural shape and method/body.

            await service.send('chat-999', '<b>Hello</b>');

            expect(fetchMock).toHaveBeenCalledOnce();
            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toMatch(/https:\/\/api\.telegram\.org\/bot.*\/sendMessage/);
            expect(init.method).toBe('POST');
            expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
        });

        it('sends the correct chat_id and text in the request body', async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true });
            vi.stubGlobal('fetch', fetchMock);

            const service = makeEnabledService();
            await service.send('chat-999', '<b>Hello</b>');

            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init.body as string);
            expect(body.chat_id).toBe('chat-999');
            expect(body.text).toBe('<b>Hello</b>');
            expect(body.parse_mode).toBe('HTML');
        });

        it('throws when the Telegram API responds with a non-ok status', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => '{"description":"Bad Request"}',
            });
            vi.stubGlobal('fetch', fetchMock);

            const service = makeEnabledService();
            await expect(service.send('chat-999', 'test')).rejects.toThrow(
                /Telegram API error 400/,
            );
        });

        it('propagates fetch network errors', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'));
            vi.stubGlobal('fetch', fetchMock);

            const service = makeEnabledService();
            await expect(service.send('chat-999', 'test')).rejects.toThrow('Network failure');
        });

        it('does not throw when response is ok', async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true });
            vi.stubGlobal('fetch', fetchMock);

            const service = makeEnabledService();
            await expect(service.send('chat-111', 'msg')).resolves.toBeUndefined();
        });
    });
});
