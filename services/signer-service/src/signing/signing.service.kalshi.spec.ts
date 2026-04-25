import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { SigningService } from "./signing.service";
import { CredentialsService } from "../credentials/credentials.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NativeCtfService } from "./native-ctf.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generate a real 2048-bit RSA key pair for tests — avoid hardcoded PEM blobs
const { privateKey: TEST_RSA_PRIVATE, publicKey: TEST_RSA_PUBLIC } =
  crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

const TEST_KEY_ID = "test-key-id-001";

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    NODE_ENV: "development",
    CHAIN_ID: "137",
    POLY_BUILDER_API_KEY: "k",
    POLY_BUILDER_SECRET: "0".repeat(64),
    POLY_BUILDER_PASSPHRASE: "p",
    CLOB_API_URL: "http://clob:3099",
    KALSHI_KEY_ID: TEST_KEY_ID,
    KALSHI_PRIVATE_KEY_PEM: TEST_RSA_PRIVATE,
    ...overrides,
  };
  return {
    get: (k: string, d?: string) => map[k] ?? d,
    getOrThrow: (k: string) => {
      if (!(k in map)) throw new Error(`Missing ${k}`);
      return map[k];
    },
  } as any;
}

function makeService(config = makeConfig()): SigningService {
  const credentials = {
    getDecryptedCredentials: vi.fn(),
  } as unknown as CredentialsService;
  const nativeEip712 = { signOrder: vi.fn() } as unknown as NativeEip712Service;
  const nativeCtf = {} as unknown as NativeCtfService;
  return new SigningService(credentials, config, nativeEip712, nativeCtf);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("SigningService.signKalshiJwt()", () => {
  let svc: SigningService;

  beforeEach(() => {
    svc = makeService();
  });

  it("returns a token string with three JWT segments", async () => {
    const result = await svc.signKalshiJwt("user-1", "req-001");
    expect(typeof result.token).toBe("string");
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("returns expiresAt roughly 30 minutes in the future", async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await svc.signKalshiJwt("user-1", "req-001");
    const after = Math.floor(Date.now() / 1000);
    const ttl = result.expiresAt - before;
    expect(ttl).toBeGreaterThanOrEqual(1799);
    expect(ttl).toBeLessThanOrEqual(1800 + (after - before) + 1);
  });

  it("JWT header contains alg RS256 and kid from config", async () => {
    const result = await svc.signKalshiJwt("user-1", "req-001");
    const [headerB64] = result.token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(header.alg).toBe("RS256");
    expect(header.kid).toBe(TEST_KEY_ID);
    expect(header.typ).toBe("JWT");
  });

  it("JWT payload sub matches key ID", async () => {
    const result = await svc.signKalshiJwt("user-1", "req-001");
    const [, payloadB64] = result.token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.sub).toBe(TEST_KEY_ID);
  });

  it("JWT signature verifies with the corresponding public key", async () => {
    const result = await svc.signKalshiJwt("user-1", "req-001");
    const [headerB64, payloadB64, sigB64] = result.token.split(".");
    const data = Buffer.from(`${headerB64}.${payloadB64}`);
    const sig = Buffer.from(sigB64, "base64url");
    const valid = crypto.verify(
      "sha256",
      data,
      {
        key: TEST_RSA_PUBLIC,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      sig,
    );
    expect(valid).toBe(true);
  });

  it("throws when KALSHI_KEY_ID is not configured", async () => {
    const noKeyIdMap: Record<string, string> = {
      NODE_ENV: "development",
      CHAIN_ID: "137",
      KALSHI_PRIVATE_KEY_PEM: TEST_RSA_PRIVATE,
      // KALSHI_KEY_ID intentionally absent
    };
    const config = {
      get: (k: string, d?: string) => noKeyIdMap[k] ?? d,
      getOrThrow: (k: string) => {
        if (!(k in noKeyIdMap)) throw new Error(`Missing ${k}`);
        return noKeyIdMap[k];
      },
    } as any as ConfigService;
    const svc = makeService(config);
    await expect(svc.signKalshiJwt("u", "r")).rejects.toThrow("KALSHI_KEY_ID");
  });

  it("throws when KALSHI_PRIVATE_KEY_PEM is not configured", async () => {
    const noPemMap: Record<string, string> = {
      NODE_ENV: "development",
      CHAIN_ID: "137",
      KALSHI_KEY_ID: TEST_KEY_ID,
      // KALSHI_PRIVATE_KEY_PEM intentionally absent
    };
    const config = {
      get: (k: string, d?: string) => noPemMap[k] ?? d,
      getOrThrow: (k: string) => {
        if (!(k in noPemMap)) throw new Error(`Missing ${k}`);
        return noPemMap[k];
      },
    } as any as ConfigService;
    const svc = makeService(config);
    await expect(svc.signKalshiJwt("u", "r")).rejects.toThrow(
      "KALSHI_PRIVATE_KEY_PEM",
    );
  });
});
