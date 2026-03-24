// Thin TypeScript wrapper around the Rust WASM module
// SECURITY: In production, WASM is MANDATORY — no fallback allowed.
// Fallback to Node.js crypto is only permitted in development.

let wasmModule: any = null;
let wasmAvailable = false;

try {
  wasmModule = require('./pkg/polyforge_crypto');
  wasmAvailable = true;
} catch {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: polyforge-crypto WASM module not found. ' +
      'Rust WASM is REQUIRED in production for memory-safe cryptographic operations. ' +
      'Run: cd packages/polyforge-crypto && bash build.sh'
    );
  }
  console.warn('[DEV] polyforge-crypto WASM not available, using Node.js crypto fallback');
}

/** Returns true if the Rust WASM module is active (not the JS fallback) */
export function isWasmActive(): boolean { return wasmAvailable; }

import * as crypto from 'crypto';

export function aesEncrypt(plaintext: string, keyHex: string): { ciphertext: string; iv: string; tag: string } {
  if (wasmModule) {
    return JSON.parse(wasmModule.aes_encrypt(plaintext, keyHex));
  }
  // Node.js fallback
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { ciphertext: encrypted, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

export function aesDecrypt(ciphertextHex: string, ivHex: string, tagHex: string, keyHex: string): string {
  if (wasmModule) {
    return wasmModule.aes_decrypt(ciphertextHex, ivHex, tagHex, keyHex);
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function sha256(input: string): string {
  if (wasmModule) return wasmModule.sha256(input);
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(message: string, secret: string): string {
  if (wasmModule) return wasmModule.hmac_sha256(message, secret);
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export function hmacVerify(message: string, secret: string, expectedHex: string): boolean {
  if (wasmModule) return wasmModule.hmac_verify(message, secret, expectedHex);
  const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedHex, 'hex'));
}

export function randomBytes(length: number): string {
  if (wasmModule) return wasmModule.random_bytes(length);
  return crypto.randomBytes(length).toString('hex');
}

export function constantTimeEq(a: string, b: string): boolean {
  if (wasmModule) return wasmModule.constant_time_eq(a, b);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
