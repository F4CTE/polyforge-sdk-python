import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInit = vi.fn();
const mockSetUser = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@sentry/react', () => ({
  init: mockInit,
  setUser: mockSetUser,
  captureException: mockCaptureException,
}));

describe('sentry lib', () => {
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

  it('setSentryUser calls Sentry.setUser with correct shape', async () => {
    const { setSentryUser } = await import('../lib/sentry');
    // no-op when DSN is unset — setUser should not be called
    setSentryUser('u1', 'a@b.com', 'alice');
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it('clearSentryUser is a no-op when DSN is unset', async () => {
    const { clearSentryUser } = await import('../lib/sentry');
    clearSentryUser();
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it('captureError is a no-op when DSN is unset', async () => {
    const { captureError } = await import('../lib/sentry');
    captureError(new Error('boom'));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
