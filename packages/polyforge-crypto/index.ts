// Thin TypeScript wrapper around the Rust WASM module
// Falls back to Node.js crypto if WASM is not available

let wasmModule: any = null;

try {
  wasmModule = require('./pkg/polyforge_crypto');
} catch {
  console.warn('polyforge-crypto WASM not available, using Node.js crypto fallback');
}

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
