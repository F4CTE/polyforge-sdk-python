/**
 * Minimal TOTP code generator for e2e 2FA tests.
 *
 * Uses Node.js built-in crypto (no external deps).
 * Matches otplib defaults: SHA-1, 6 digits, 30s period.
 *
 * The auth-service uses `otplib` with:
 *   - generateSecret({ length: 20 }) → base32-encoded 160-bit secret
 *   - verifySync is the default validator (6 digits, 30s window)
 */

import { createHmac } from "crypto";

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  // Remove padding and uppercase
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  const bits: number[] = [];
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error(`Invalid base32 character: ${char}`);
    const b = val.toString(2).padStart(5, "0");
    bits.push(...b.split("").map(Number));
  }
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0);
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: bigint, digits = 6): string {
  // Pack counter as 8-byte big-endian buffer
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(counter);
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  // Dynamic truncation per RFC 4226
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Generate TOTP codes for the three adjacent time windows (prev, current, next).
 *
 * The auth-service uses otplib's default `verifySync` which accepts codes
 * from the current window and ±1 adjacent windows (30s each).  Returning
 * only the current-window code causes CI flakes when the code is generated
 * near a period boundary and the API round-trip crosses into the next window.
 *
 * Callers should use `codes[1]` (the current window) as the primary code;
 * the adjacent codes serve as fallbacks when the request crosses a boundary.
 */
export function generateTotp(
  secret: string,
  period = 30,
  digits = 6,
): [prev: string, current: string, next: string] {
  const counter = BigInt(Math.floor(Date.now() / 1000 / period));
  const key = base32Decode(secret);
  return [
    hotp(key, counter - 1n, digits),
    hotp(key, counter, digits),
    hotp(key, counter + 1n, digits),
  ];
}

/**
 * Try each adjacent-window TOTP code against an async verification action.
 *
 * The auth-service uses otplib's `verifySync()` which defaults to strict
 * current-window-only validation (`window: 0`).  A code generated near a
 * 30s period boundary can expire before the API round-trip completes,
 * causing a CI flake.
 *
 * This helper tries `codes[1]` (current window) first — the typical path.
 * If that fails with a TOTP-validation error (4xx) it retries with
 * `codes[0]` (previous window) then `codes[2]` (next window).
 * Non-TOTP errors (network failures, 5xx server errors, transport errors)
 * are NOT retried — retrying on those masks real infrastructure failures.
 */
export async function verifyTotp<T>(
  secret: string,
  action: (code: string) => Promise<T>,
): Promise<T> {
  const codes = generateTotp(secret);

  const tryCode = async (code: string): Promise<T> => {
    try {
      return await action(code);
    } catch (e) {
      // Only retry on likely TOTP-validation failures (4xx HTTP errors or
      // errors containing "invalid" / "failed" TOTP keywords).  Network
      // errors, 5xx server errors, and generic exceptions are re-thrown
      // immediately — retrying with an adjacent window would mask the
      // real infrastructure failure.
      const msg = String((e as Error)?.message ?? e ?? "");
      if (
        /\b4\d\d\b/.test(msg) ||
        /\b(?:invalid|expired|wrong|bad)\s*(?:totp|code|token|2fa)/i.test(
          msg,
        ) ||
        /\b(?:totp|code|token|2fa)\s*(?:invalid|expired|wrong|bad|mismatch)/i.test(
          msg,
        )
      ) {
        throw e; // TOTP validation failure — caller should try next window
      }
      // Wrap non-TOTP errors so they propagate without retry.
      const wrapped = new Error(
        `verifyTotp: non-TOTP failure, not retrying: ${msg}`,
      );
      (wrapped as Error & { cause: unknown }).cause = e;
      throw wrapped;
    }
  };

  let lastError: unknown;
  for (const code of [codes[1], codes[0], codes[2]]) {
    try {
      return await tryCode(code);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e ?? "");
      if (msg.startsWith("verifyTotp: non-TOTP failure")) {
        throw e; // non-TOTP error — do not retry
      }
      lastError = e;
    }
  }
  throw (
    lastError ?? new Error("verifyTotp: all three TOTP window attempts failed")
  );
}
