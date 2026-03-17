import { describe, it, expect } from 'vitest';
import { EncryptionService } from './encryption.service';

// 64 hex chars = 32 bytes (valid KEK)
const TEST_KEK = 'a'.repeat(64);

function makeService(kek = TEST_KEK): EncryptionService {
    const config = { get: (key: string) => (key === 'MASTER_ENCRYPTION_KEY' ? kek : undefined) } as any;
    return new EncryptionService(config);
}

describe('EncryptionService', () => {

    // ── Construction ──────────────────────────────────────────────────────────

    describe('constructor', () => {
        it('throws when MASTER_ENCRYPTION_KEY is missing', () => {
            const config = { get: () => undefined } as any;
            expect(() => new EncryptionService(config)).toThrow('MASTER_ENCRYPTION_KEY');
        });

        it('throws when MASTER_ENCRYPTION_KEY is too short', () => {
            const config = { get: () => 'abc123' } as any;
            expect(() => new EncryptionService(config)).toThrow('MASTER_ENCRYPTION_KEY');
        });

        it('throws when MASTER_ENCRYPTION_KEY is 63 chars (not 64)', () => {
            const config = { get: () => 'a'.repeat(63) } as any;
            expect(() => new EncryptionService(config)).toThrow('MASTER_ENCRYPTION_KEY');
        });

        it('constructs successfully with a 64-char hex key', () => {
            expect(() => makeService()).not.toThrow();
        });
    });

    // ── DEK lifecycle ─────────────────────────────────────────────────────────

    describe('generateDek()', () => {
        it('returns a 32-byte DEK buffer', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            expect(dek).toBeInstanceOf(Buffer);
            expect(dek.length).toBe(32);
        });

        it('returns encryptedDek as Uint8Array', () => {
            const svc = makeService();
            const { encryptedDek } = svc.generateDek();
            expect(encryptedDek).toBeInstanceOf(Uint8Array);
        });

        it('returns dekIv as Uint8Array of length 12 (96-bit GCM IV)', () => {
            const svc = makeService();
            const { dekIv } = svc.generateDek();
            expect(dekIv).toBeInstanceOf(Uint8Array);
            expect(dekIv.length).toBe(12);
        });

        it('generates a unique DEK on every call', () => {
            const svc = makeService();
            const { dek: d1 } = svc.generateDek();
            const { dek: d2 } = svc.generateDek();
            expect(d1.toString('hex')).not.toBe(d2.toString('hex'));
        });

        it('generates a unique IV on every call', () => {
            const svc = makeService();
            const { dekIv: iv1 } = svc.generateDek();
            const { dekIv: iv2 } = svc.generateDek();
            expect(Buffer.from(iv1).toString('hex')).not.toBe(Buffer.from(iv2).toString('hex'));
        });

        it('encrypted DEK length = 32 (ciphertext) + 16 (tag) = 48 bytes', () => {
            const svc = makeService();
            const { encryptedDek } = svc.generateDek();
            expect(encryptedDek.length).toBe(48);
        });
    });

    describe('decryptDek()', () => {
        it('round-trips the DEK: decrypt(encrypt(dek)) === dek', () => {
            const svc = makeService();
            const { dek, encryptedDek, dekIv } = svc.generateDek();
            const recovered = svc.decryptDek(encryptedDek, dekIv);
            expect(recovered.toString('hex')).toBe(dek.toString('hex'));
        });

        it('throws when encryptedDek is tampered (GCM auth tag fails)', () => {
            const svc = makeService();
            const { encryptedDek, dekIv } = svc.generateDek();
            const tampered = new Uint8Array(encryptedDek);
            tampered[0] ^= 0xff;
            expect(() => svc.decryptDek(tampered, dekIv)).toThrow();
        });

        it('throws when dekIv is wrong', () => {
            const svc = makeService();
            const { encryptedDek } = svc.generateDek();
            const wrongIv = new Uint8Array(12).fill(0);
            expect(() => svc.decryptDek(encryptedDek, wrongIv)).toThrow();
        });

        it('throws when decrypting with a different KEK', () => {
            const svc1 = makeService('a'.repeat(64));
            const svc2 = makeService('b'.repeat(64));
            const { encryptedDek, dekIv } = svc1.generateDek();
            expect(() => svc2.decryptDek(encryptedDek, dekIv)).toThrow();
        });
    });

    // ── Field encryption ──────────────────────────────────────────────────────

    describe('encryptField()', () => {
        it('returns ciphertext, iv, and tag all as Uint8Array', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('hello', dek);
            expect(enc.ciphertext).toBeInstanceOf(Uint8Array);
            expect(enc.iv).toBeInstanceOf(Uint8Array);
            expect(enc.tag).toBeInstanceOf(Uint8Array);
        });

        it('iv is 12 bytes', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('test', dek);
            expect(enc.iv.length).toBe(12);
        });

        it('tag is 16 bytes', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('test', dek);
            expect(enc.tag.length).toBe(16);
        });

        it('uses a fresh IV per call (no IV reuse)', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc1 = svc.encryptField('same plaintext', dek);
            const enc2 = svc.encryptField('same plaintext', dek);
            expect(Buffer.from(enc1.iv).toString('hex'))
                .not.toBe(Buffer.from(enc2.iv).toString('hex'));
        });

        it('produces different ciphertexts for different IVs (probabilistic encryption)', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc1 = svc.encryptField('same', dek);
            const enc2 = svc.encryptField('same', dek);
            expect(Buffer.from(enc1.ciphertext).toString('hex'))
                .not.toBe(Buffer.from(enc2.ciphertext).toString('hex'));
        });

        it('encrypts a long private key (66 chars)', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const pk = '0x' + 'f'.repeat(64);
            expect(() => svc.encryptField(pk, dek)).not.toThrow();
        });
    });

    describe('decryptField()', () => {
        it('round-trips a short string', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('hello', dek);
            expect(svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek)).toBe('hello');
        });

        it('round-trips a Polymarket private key (0x + 64 hex chars)', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const pk = '0x' + 'a1b2c3d4'.repeat(8);
            const enc = svc.encryptField(pk, dek);
            expect(svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek)).toBe(pk);
        });

        it('round-trips an empty string', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('', dek);
            expect(svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek)).toBe('');
        });

        it('throws when ciphertext is tampered', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('secret', dek);
            const tampered = new Uint8Array(enc.ciphertext);
            tampered[0] ^= 0xff;
            expect(() => svc.decryptField(tampered, enc.iv, enc.tag, dek)).toThrow();
        });

        it('throws when auth tag is tampered', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('secret', dek);
            const tampered = new Uint8Array(enc.tag);
            tampered[0] ^= 0xff;
            expect(() => svc.decryptField(enc.ciphertext, enc.iv, tampered, dek)).toThrow();
        });

        it('throws when IV is wrong', () => {
            const svc = makeService();
            const { dek } = svc.generateDek();
            const enc = svc.encryptField('secret', dek);
            const wrongIv = new Uint8Array(12).fill(0x42);
            expect(() => svc.decryptField(enc.ciphertext, wrongIv, enc.tag, dek)).toThrow();
        });

        it('throws when decrypting with a different DEK', () => {
            const svc = makeService();
            const { dek: dek1 } = svc.generateDek();
            const { dek: dek2 } = svc.generateDek();
            const enc = svc.encryptField('secret', dek1);
            expect(() => svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek2)).toThrow();
        });
    });

    // ── Full envelope roundtrip ────────────────────────────────────────────────

    describe('full envelope roundtrip', () => {
        it('stores DEK encrypted, retrieves it, and decrypts fields correctly', () => {
            const svc = makeService();

            // 1. Generate fresh DEK
            const { dek, encryptedDek, dekIv } = svc.generateDek();

            // 2. Encrypt multiple credential fields with the DEK
            const privateKey   = '0x' + 'f'.repeat(64);
            const apiKey       = 'test-api-key';
            const apiSecret    = 'test-api-secret-long';
            const apiPassphrase = 'test-passphrase';

            const pkEnc  = svc.encryptField(privateKey,    dek);
            const akEnc  = svc.encryptField(apiKey,        dek);
            const asEnc  = svc.encryptField(apiSecret,     dek);
            const apEnc  = svc.encryptField(apiPassphrase, dek);

            // 3. Simulate storage: keep encryptedDek + iv + all field blobs
            // 4. Simulate retrieval: decrypt DEK first, then decrypt fields
            const recoveredDek = svc.decryptDek(encryptedDek, dekIv);

            expect(svc.decryptField(pkEnc.ciphertext,  pkEnc.iv,  pkEnc.tag,  recoveredDek)).toBe(privateKey);
            expect(svc.decryptField(akEnc.ciphertext,  akEnc.iv,  akEnc.tag,  recoveredDek)).toBe(apiKey);
            expect(svc.decryptField(asEnc.ciphertext,  asEnc.iv,  asEnc.tag,  recoveredDek)).toBe(apiSecret);
            expect(svc.decryptField(apEnc.ciphertext,  apEnc.iv,  apEnc.tag,  recoveredDek)).toBe(apiPassphrase);
        });
    });
});
