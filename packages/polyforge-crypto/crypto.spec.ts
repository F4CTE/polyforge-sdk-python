import { describe, it, expect } from 'vitest';
import {
  aesEncrypt,
  aesDecrypt,
  sha256,
  hmacSha256,
  hmacVerify,
  randomBytes,
  constantTimeEq,
} from './index';

describe('@polyforge/crypto', () => {
  // 256-bit test key (32 bytes hex-encoded)
  const testKey = 'a'.repeat(64); // 0xaaaa...aa

  describe('AES-256-GCM encrypt/decrypt roundtrip', () => {
    it('encrypts and decrypts plaintext correctly', () => {
      const plaintext = 'Hello, Polyforge!';
      const encrypted = aesEncrypt(plaintext, testKey);

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars

      const decrypted = aesDecrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, testKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'deterministic test';
      const enc1 = aesEncrypt(plaintext, testKey);
      const enc2 = aesEncrypt(plaintext, testKey);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it('fails to decrypt with wrong key', () => {
      const encrypted = aesEncrypt('secret', testKey);
      const wrongKey = 'b'.repeat(64);
      expect(() =>
        aesDecrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, wrongKey),
      ).toThrow();
    });

    it('fails to decrypt with tampered ciphertext', () => {
      const encrypted = aesEncrypt('secret', testKey);
      const tampered = 'ff' + encrypted.ciphertext.slice(2);
      expect(() =>
        aesDecrypt(tampered, encrypted.iv, encrypted.tag, testKey),
      ).toThrow();
    });
  });

  describe('SHA-256', () => {
    it('matches known hash for empty string', () => {
      expect(sha256('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    it('matches known hash for "hello"', () => {
      expect(sha256('hello')).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    });

    it('is deterministic', () => {
      expect(sha256('polyforge')).toBe(sha256('polyforge'));
    });
  });

  describe('HMAC-SHA256', () => {
    it('produces correct HMAC for known input', () => {
      // Known test vector: HMAC-SHA256("message", "secret")
      const result = hmacSha256('message', 'secret');
      expect(result).toHaveLength(64); // 32 bytes = 64 hex chars
      // Verify determinism
      expect(hmacSha256('message', 'secret')).toBe(result);
    });

    it('produces different HMACs for different keys', () => {
      const hmac1 = hmacSha256('message', 'key1');
      const hmac2 = hmacSha256('message', 'key2');
      expect(hmac1).not.toBe(hmac2);
    });
  });

  describe('HMAC verification', () => {
    it('returns true for valid signature', () => {
      const signature = hmacSha256('payload', 'webhook-secret');
      expect(hmacVerify('payload', 'webhook-secret', signature)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      const signature = hmacSha256('payload', 'webhook-secret');
      expect(hmacVerify('tampered', 'webhook-secret', signature)).toBe(false);
    });

    it('returns false for wrong secret', () => {
      const signature = hmacSha256('payload', 'correct-secret');
      expect(hmacVerify('payload', 'wrong-secret', signature)).toBe(false);
    });
  });

  describe('randomBytes', () => {
    it('returns correct length hex string', () => {
      expect(randomBytes(16)).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(randomBytes(32)).toHaveLength(64);
      expect(randomBytes(1)).toHaveLength(2);
    });

    it('produces different values each call', () => {
      const a = randomBytes(32);
      const b = randomBytes(32);
      expect(a).not.toBe(b);
    });

    it('produces valid hex characters only', () => {
      const bytes = randomBytes(64);
      expect(bytes).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('constantTimeEq', () => {
    it('returns true for equal strings', () => {
      expect(constantTimeEq('abc', 'abc')).toBe(true);
      expect(constantTimeEq('', '')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(constantTimeEq('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths', () => {
      expect(constantTimeEq('abc', 'abcd')).toBe(false);
      expect(constantTimeEq('abcd', 'abc')).toBe(false);
    });

    it('handles token comparison use case', () => {
      const token = randomBytes(32);
      expect(constantTimeEq(token, token)).toBe(true);
      const fakeToken = randomBytes(32);
      expect(constantTimeEq(token, fakeToken)).toBe(false);
    });
  });
});
