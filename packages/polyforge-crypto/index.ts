// Rust WASM cryptographic operations — NO FALLBACK
// SECURITY: If the WASM module is not built, the process crashes.
// This ensures we never silently degrade to less secure JS crypto.
// Build with: cd packages/polyforge-crypto && bash build.sh

const wasmModule = require('./pkg/polyforge_crypto');

export function aesEncrypt(plaintext: string, keyHex: string): { ciphertext: string; iv: string; tag: string } {
  return JSON.parse(wasmModule.aes_encrypt(plaintext, keyHex));
}

export function aesDecrypt(ciphertextHex: string, ivHex: string, tagHex: string, keyHex: string): string {
  return wasmModule.aes_decrypt(ciphertextHex, ivHex, tagHex, keyHex);
}

export function sha256(input: string): string {
  return wasmModule.sha256(input);
}

export function hmacSha256(message: string, secret: string): string {
  return wasmModule.hmac_sha256(message, secret);
}

export function hmacVerify(message: string, secret: string, expectedHex: string): boolean {
  return wasmModule.hmac_verify(message, secret, expectedHex);
}

export function randomBytes(length: number): string {
  return wasmModule.random_bytes(length);
}

export function constantTimeEq(a: string, b: string): boolean {
  return wasmModule.constant_time_eq(a, b);
}
