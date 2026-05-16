/**
 * Direct REST API helpers for test setup / teardown.
 *
 * These helpers bypass the UI and call the backend directly. Useful for:
 *   - Creating/deleting test data without going through the browser
 *   - Obtaining a JWT token programmatically for API assertions
 *   - Checking resource state after UI actions
 */

import { waitForEmail } from "./mailhog";

const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:3001";
const API_URL = process.env.API_URL ?? "http://localhost:3002";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; username: string; status: string };
  cookie?: string;
}

export interface StrategyResponse {
  id: string;
  name: string;
  status: string;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Extract Set-Cookie headers from a fetch response.
 *
 * Node.js 18+ (undici) treats `set-cookie` as a special multi-value header.
 * `headers.get('set-cookie')` returns null per the Fetch spec when there are
 * multiple Set-Cookie lines. `headers.getSetCookie()` (added in Node 18.14+)
 * correctly returns all values as an array.  We join them so the pf_token
 * regex works against a single string regardless of which other cookies are set.
 */
function getSetCookieString(headers: Headers): string {
  // Prefer the standards-compliant array API (Node 18.14+)
  if (
    typeof (headers as unknown as Record<string, unknown>)["getSetCookie"] ===
    "function"
  ) {
    return (headers as unknown as { getSetCookie(): string[] })
      .getSetCookie()
      .join(", ");
  }
  // Fallback: older runtimes where get('set-cookie') returns a combined string
  return headers.get("set-cookie") ?? "";
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_URL}/auth/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(err)}`);
  }

  // Cookie-based auth: token is in Set-Cookie header, user object in body
  const cookie = getSetCookieString(res.headers);
  const tokenMatch = cookie.match(/pf_token=([^;]+)/);
  const user = (await res.json()) as LoginResponse["user"];
  return {
    token: tokenMatch?.[1] ?? "",
    user,
    cookie,
  };
}

export async function apiRegister(
  email: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  // Retry up to 3 times on 500 errors (intermittent under concurrent load)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${AUTH_URL}/auth/v1/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, tosAccepted: true }),
    });

    if (res.ok) {
      // Cookie-based auth: token is in Set-Cookie header, user object in body
      const cookie = getSetCookieString(res.headers);
      const tokenMatch = cookie.match(/pf_token=([^;]+)/);
      const user = (await res.json()) as LoginResponse["user"];
      return {
        token: tokenMatch?.[1] ?? "",
        user,
        cookie,
      };
    }

    if (res.status >= 500 && attempt < 3) {
      // Wait before retrying on server errors
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }

    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(`Register failed: ${res.status} ${JSON.stringify(err)}`);
  }

  throw new Error("Register failed: exhausted retries");
}

/**
 * Registers a new user AND immediately verifies their email by:
 *   1. Calling apiRegister() to create the account
 *   2. Fetching the verification token from Mailpit
 *   3. POSTing to /auth/v1/verify-email to mark the account verified
 *
 * Use this instead of plain apiRegister() in specs that navigate to routes
 * protected by VerifiedGuard (most authenticated routes in the user app).
 */
export async function apiRegisterAndVerify(
  email: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  // 1. Register
  const result = await apiRegister(email, username, password);

  // 2. Extract verification token from Mailpit email
  const msg = await waitForEmail(email);
  const body = msg.HTML || msg.Text || "";

  // Token is a 64-char hex string in the verify-email URL query param
  const tokenMatch = body.match(/[?&]token=([a-f0-9]{64})/i);
  if (!tokenMatch) {
    throw new Error(
      `Could not extract verification token from email to ${email}`,
    );
  }
  const verifyToken = tokenMatch[1];

  // 3. Verify email via API
  const verifyRes = await fetch(`${AUTH_URL}/auth/v1/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: verifyToken }),
  });
  if (!verifyRes.ok) {
    const err = (await verifyRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throw new Error(
      `Email verification failed: ${verifyRes.status} ${JSON.stringify(err)}`,
    );
  }

  return result;
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

export async function apiGetStrategies(
  token: string,
): Promise<StrategyResponse[]> {
  const res = await fetch(`${API_URL}/api/v1/strategies`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
  });
  if (!res.ok) throw new Error(`GET /strategies failed: ${res.status}`);
  const data = (await res.json()) as { data: StrategyResponse[] };
  return data.data;
}

export async function apiDeleteStrategy(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/strategies/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
  });
  // 404 is OK — may have been already deleted
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /strategies/${id} failed: ${res.status}`);
  }
}

export async function apiCreateStrategy(
  token: string,
  name: string,
): Promise<StrategyResponse> {
  const res = await fetch(`${API_URL}/api/v1/strategies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      `POST /strategies failed: ${res.status} ${JSON.stringify(err)}`,
    );
  }
  return res.json() as Promise<StrategyResponse>;
}

export async function apiStopStrategy(
  token: string,
  id: string,
): Promise<void> {
  await fetch(`${API_URL}/api/v1/strategies/${id}/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
  });
}

// ─── TOTP / 2FA helpers ───────────────────────────────────────────────────────

export async function apiSetupTotp(
  token: string,
): Promise<{ secret: string; uri: string; qrCode: string }> {
  const res = await fetch(`${AUTH_URL}/auth/v1/totp/setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(`TOTP setup failed: ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ secret: string; uri: string; qrCode: string }>;
}

export async function apiConfirmTotp(
  token: string,
  code: string,
): Promise<{ backupCodes: string[] }> {
  const res = await fetch(`${AUTH_URL}/auth/v1/totp/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Cookie: `pf_token=${token}`,
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      `TOTP confirm failed: ${res.status} ${JSON.stringify(err)}`,
    );
  }
  return res.json() as Promise<{ backupCodes: string[] }>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

let _emailCounter = 0;

/** Generates a unique email address for test isolation.
 *  Uses sub-millisecond entropy (random + counter) to prevent collisions
 *  when multiple CI shards call within the same millisecond. */
export function uniqueEmail(prefix = "test"): string {
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  const counter = (_emailCounter++).toString(36);
  return `${prefix}+${ts}${random}${counter}@e2e.dev.local`;
}

/** Generates a unique username.
 *  Hyphens and other non-[a-zA-Z0-9_] characters in the prefix are replaced
 *  with underscores so the backend validator (^[a-zA-Z0-9_]+$) accepts the
 *  value — call sites like ws-e2e, mobile-nav, mobile-touch, etc. pass
 *  hyphenated prefixes that would otherwise cause a 400 on registration. */
export function uniqueUsername(prefix = "testuser"): string {
  const safe = prefix.replace(/[^a-zA-Z0-9_]/g, "_");
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${safe}${ts}${random}`.slice(0, 20);
}
