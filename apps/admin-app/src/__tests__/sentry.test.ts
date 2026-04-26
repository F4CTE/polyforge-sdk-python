import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInit = vi.fn();
const mockSetUser = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@sentry/react', () => ({
  init: mockInit,
  setUser: mockSetUser,
  captureException: mockCaptureException,
}));

describe('sentry lib (admin-app)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calls Sentry.init on initSentry', async () => {
    const { initSentry } = await import('../lib/sentry');
    initSentry();
    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ beforeSend: expect.any(Function) }),
    );
  });

  it('beforeSend returns null when DSN is unset', async () => {
    const { initSentry } = await import('../lib/sentry');
    initSentry();
    const { beforeSend } = mockInit.mock.calls[0][0] as { beforeSend: (e: unknown) => unknown };
    expect(beforeSend({})).toBeNull();
  });

  it('setSentryUser is a no-op when DSN is unset', async () => {
    const { setSentryUser } = await import('../lib/sentry');
    setSentryUser('admin1', 'admin@polyforge.app');
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it('clearSentryUser is a no-op when DSN is unset', async () => {
    const { clearSentryUser } = await import('../lib/sentry');
    clearSentryUser();
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it('captureError is a no-op when DSN is unset', async () => {
    const { captureError } = await import('../lib/sentry');
    captureError(new Error('admin error'));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
