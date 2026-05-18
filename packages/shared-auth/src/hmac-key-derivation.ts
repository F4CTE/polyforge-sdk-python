import { createHmac } from "crypto";

const SERVICE_KEY_PREFIX = "service:";

/**
 * Derives a per-service HMAC-SHA256 signing key from the master internal JWT
 * secret. Each service signs with only its own derived key, preventing service
 * A from forging service B's identity claims (iss/sub).
 *
 * The derivation is deterministic: the same (masterSecret, serviceName) pair
 * always produces the same key. The verifier reconstructs the expected key
 * from the JWT's `iss` claim, so each service can only verify tokens that
 * were minted by the issuer named in the payload.
 */
export function deriveServiceKey(
  masterSecret: string,
  serviceName: string,
): string {
  return createHmac("sha256", masterSecret)
    .update(`${SERVICE_KEY_PREFIX}${serviceName}`)
    .digest("hex");
}
