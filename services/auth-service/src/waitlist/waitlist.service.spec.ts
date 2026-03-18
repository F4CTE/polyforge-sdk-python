import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let redis: any;
  let mail: any;
  let redisClient: any;

  beforeEach(() => {
    redisClient = {
      zadd: vi.fn().mockResolvedValue(1),
      zrange: vi.fn().mockResolvedValue([]),
      zrem: vi.fn().mockResolvedValue(1),
      zcard: vi.fn().mockResolvedValue(0),
    };
    redis = { getClient: vi.fn().mockReturnValue(redisClient) };
    mail = {
      sendWaitlistConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    };
    service = new WaitlistService(redis, mail);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── join ──────────────────────────────────────────────────────────────────

  describe('join', () => {
    it('returns { joined: true } for a new email', async () => {
      redisClient.zadd.mockResolvedValue(1);
      const result = await service.join({ email: 'new@example.com' });
      expect(result).toEqual({ joined: true });
    });

    it('returns { joined: true } for a duplicate email (idempotent)', async () => {
      redisClient.zadd.mockResolvedValue(0);
      const result = await service.join({ email: 'existing@example.com' });
      expect(result).toEqual({ joined: true });
    });

    it('sends a confirmation email on first signup (zadd === 1)', async () => {
      redisClient.zadd.mockResolvedValue(1);
      await service.join({ email: 'new@example.com' });
      await vi.waitFor(() => {
        expect(mail.sendWaitlistConfirmationEmail).toHaveBeenCalledWith(
          'new@example.com',
        );
      });
    });

    it('does NOT send an email on duplicate signup (zadd === 0)', async () => {
      redisClient.zadd.mockResolvedValue(0);
      await service.join({ email: 'existing@example.com' });
      await new Promise((r) => setTimeout(r, 20));
      expect(mail.sendWaitlistConfirmationEmail).not.toHaveBeenCalled();
    });

    it('normalises email to lowercase before storing', async () => {
      await service.join({ email: 'UPPER@EXAMPLE.COM' });
      expect(redisClient.zadd).toHaveBeenCalledWith(
        'waitlist:emails',
        'NX',
        expect.any(Number),
        'upper@example.com',
      );
    });

    it('does not throw when confirmation email fails (fire-and-forget)', async () => {
      redisClient.zadd.mockResolvedValue(1);
      mail.sendWaitlistConfirmationEmail.mockRejectedValue(
        new Error('SMTP down'),
      );
      await expect(service.join({ email: 'x@y.com' })).resolves.toEqual({
        joined: true,
      });
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns an empty array when no entries', async () => {
      redisClient.zrange.mockResolvedValue([]);
      expect(await service.list()).toEqual([]);
    });

    it('maps raw redis pairs to { email, joinedAt } objects', async () => {
      const ts = 1700000000000;
      redisClient.zrange.mockResolvedValue([
        'a@b.com',
        String(ts),
        'c@d.com',
        String(ts + 1000),
      ]);
      const result = await service.list();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        email: 'a@b.com',
        joinedAt: new Date(ts).toISOString(),
      });
      expect(result[1]).toEqual({
        email: 'c@d.com',
        joinedAt: new Date(ts + 1000).toISOString(),
      });
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('calls zrem with the correct key and lowercased email', async () => {
      await service.remove('Test@Example.COM');
      expect(redisClient.zrem).toHaveBeenCalledWith(
        'waitlist:emails',
        'test@example.com',
      );
    });
  });

  // ── count ─────────────────────────────────────────────────────────────────

  describe('count', () => {
    it('returns the count from Redis zcard', async () => {
      redisClient.zcard.mockResolvedValue(37);
      expect(await service.count()).toBe(37);
    });
  });
});
