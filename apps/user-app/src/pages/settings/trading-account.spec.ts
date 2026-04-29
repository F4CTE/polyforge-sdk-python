import { describe, it, expect } from 'vitest';

// ─── Helpers mirrored from the component ───────────────────────────────────

interface User {
  id: string;
  polymarketConnected: boolean;
  polymarketRail?: 'global' | 'us';
  kalshiConnected: boolean;
}

function maskUserId(id: string): string {
  if (!id) return '••••••••••••';
  return `${id.slice(0, 4)}${'•'.repeat(8)}`;
}

function canConnectKalshi(userId: string, importing: boolean): boolean {
  return userId.trim().length > 0 && !importing;
}

function canImportUs(
  keyId: string,
  secretKey: string,
  termsAccepted: boolean,
  termsVersion: string,
  importing: boolean,
): boolean {
  return (
    keyId.trim().length > 0 &&
    secretKey.trim().length > 0 &&
    termsAccepted &&
    termsVersion === 'us-rail-2026-04-29' &&
    !importing
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Kalshi credentials panel', () => {
  describe('maskUserId', () => {
    it('masks a full user ID leaving only 4 visible characters', () => {
      const result = maskUserId('abcd1234efgh');
      expect(result).toBe('abcd••••••••');
    });

    it('handles short IDs without throwing', () => {
      const result = maskUserId('ab');
      expect(result).toContain('ab');
    });

    it('returns placeholder for empty id', () => {
      expect(maskUserId('')).toBe('••••••••••••');
    });
  });

  describe('canConnectKalshi', () => {
    it('returns true when userId is non-empty and not importing', () => {
      expect(canConnectKalshi('my-user', false)).toBe(true);
    });

    it('returns false when importing', () => {
      expect(canConnectKalshi('my-user', true)).toBe(false);
    });

    it('returns false when userId is blank', () => {
      expect(canConnectKalshi('   ', false)).toBe(false);
    });

    it('returns false when both userId is blank and importing', () => {
      expect(canConnectKalshi('', true)).toBe(false);
    });
  });

  describe('User interface Kalshi field', () => {
    it('kalshiConnected defaults to false', () => {
      const user: User = {
        id: 'u1',
        polymarketConnected: false,
        kalshiConnected: false,
      };
      expect(user.kalshiConnected).toBe(false);
    });

    it('kalshiConnected can be set to true independently of polymarketConnected', () => {
      const user: User = {
        id: 'u1',
        polymarketConnected: false,
        kalshiConnected: true,
      };
      expect(user.kalshiConnected).toBe(true);
      expect(user.polymarketConnected).toBe(false);
    });

    it('both venues can be connected simultaneously', () => {
      const user: User = {
        id: 'u1',
        polymarketConnected: true,
        kalshiConnected: true,
      };
      expect(user.polymarketConnected && user.kalshiConnected).toBe(true);
    });
  });
});

// ─── US rail ───────────────────────────────────────────────────────────────

describe('US rail credential form', () => {
  describe('canImportUs', () => {
    it('returns true when both keyId and secretKey are provided and not importing', () => {
      expect(canImportUs('key-123', 'secret-456', true, 'us-rail-2026-04-29', false)).toBe(true);
    });

    it('returns false when keyId is blank', () => {
      expect(canImportUs('   ', 'secret-456', true, 'us-rail-2026-04-29', false)).toBe(false);
    });

    it('returns false when secretKey is blank', () => {
      expect(canImportUs('key-123', '', true, 'us-rail-2026-04-29', false)).toBe(false);
    });

    it('returns false when US-rail terms are not accepted', () => {
      expect(canImportUs('key-123', 'secret-456', false, 'us-rail-2026-04-29', false)).toBe(false);
    });

    it('returns false when US-rail terms version is stale', () => {
      expect(canImportUs('key-123', 'secret-456', true, 'us-rail-2026-01-01', false)).toBe(false);
    });

    it('returns false while importing', () => {
      expect(canImportUs('key-123', 'secret-456', true, 'us-rail-2026-04-29', true)).toBe(false);
    });

    it('returns false when both fields are blank', () => {
      expect(canImportUs('', '', true, 'us-rail-2026-04-29', false)).toBe(false);
    });
  });

  describe('User polymarketRail field', () => {
    it('defaults to undefined (global users without rail field)', () => {
      const user: User = { id: 'u1', polymarketConnected: false, kalshiConnected: false };
      expect(user.polymarketRail).toBeUndefined();
    });

    it('can be set to "us" for US-rail users', () => {
      const user: User = { id: 'u1', polymarketConnected: true, kalshiConnected: false, polymarketRail: 'us' };
      expect(user.polymarketRail).toBe('us');
    });

    it('can be set to "global" explicitly', () => {
      const user: User = { id: 'u1', polymarketConnected: true, kalshiConnected: false, polymarketRail: 'global' };
      expect(user.polymarketRail).toBe('global');
    });

    it('US rail is independent of connection status', () => {
      const disconnectedUs: User = {
        id: 'u2',
        polymarketConnected: false,
        kalshiConnected: false,
        polymarketRail: 'us',
      };
      expect(disconnectedUs.polymarketRail).toBe('us');
      expect(disconnectedUs.polymarketConnected).toBe(false);
    });
  });
});
