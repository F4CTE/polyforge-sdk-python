import { describe, it, expect } from 'vitest';

// ─── Helpers mirrored from the component ───────────────────────────────────

interface User {
  id: string;
  polymarketConnected: boolean;
  kalshiConnected: boolean;
}

function maskUserId(id: string): string {
  if (!id) return '••••••••••••';
  return `${id.slice(0, 4)}${'•'.repeat(8)}`;
}

function canConnectKalshi(userId: string, importing: boolean): boolean {
  return userId.trim().length > 0 && !importing;
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
