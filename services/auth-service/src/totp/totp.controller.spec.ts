import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TotpController } from './totp.controller';
import { TotpService } from './totp.service';

describe('TotpController', () => {
  let controller: TotpController;
  let totpService: TotpService;

  const user = {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'alice@example.com',
    username: 'alice',
  };

  beforeEach(() => {
    totpService = {
      setup: vi.fn().mockResolvedValue({
        secret: 'SECRET',
        uri: 'otpauth://...',
        qrCode: 'data:...',
      }),
      confirm: vi.fn().mockResolvedValue({ backupCodes: ['CODE1', 'CODE2'] }),
      disable: vi.fn().mockResolvedValue(undefined),
      regenBackupCodes: vi
        .fn()
        .mockResolvedValue({ backupCodes: ['NEW1', 'NEW2'] }),
    } as unknown as TotpService;

    controller = new TotpController(totpService);
  });

  it('setup delegates to totpService.setup with userId', async () => {
    const result = await controller.setup(user as any);
    expect(totpService.setup).toHaveBeenCalledWith(user.sub);
    expect(result).toMatchObject({ secret: 'SECRET' });
  });

  it('confirm delegates to totpService.confirm', async () => {
    const result = await controller.confirm(user as any, { code: '123456' });
    expect(totpService.confirm).toHaveBeenCalledWith(user.sub, '123456');
    expect(result).toMatchObject({ backupCodes: expect.any(Array) });
  });

  it('disable delegates to totpService.disable with password and totpCode', async () => {
    const result = await controller.disable(user as any, {
      password: 'MyPass1!',
      totpCode: '123456',
    });
    expect(totpService.disable).toHaveBeenCalledWith(
      user.sub,
      'MyPass1!',
      '123456',
    );
    expect(result).toMatchObject({
      message: expect.stringContaining('disabled'),
    });
  });

  it('regenBackupCodes delegates to totpService.regenBackupCodes', async () => {
    const result = await controller.regenBackupCodes(user as any);
    expect(totpService.regenBackupCodes).toHaveBeenCalledWith(user.sub);
    expect(result).toMatchObject({ backupCodes: expect.any(Array) });
  });
});
