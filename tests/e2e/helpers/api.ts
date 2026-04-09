/**
 * Direct REST API helpers for test setup / teardown.
 *
 * These helpers bypass the UI and call the backend directly. Useful for:
 *   - Creating/deleting test data without going through the browser
 *   - Obtaining a JWT token programmatically for API assertions
 *   - Checking resource state after UI actions
 */

const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001';
const API_URL  = process.env.API_URL  ?? 'http://localhost:3002';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
    token: string;
    user:  { id: string; email: string; username: string; status: string };
    cookie?: string;
}

export interface StrategyResponse {
    id:     string;
    name:   string;
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
    if (typeof (headers as unknown as Record<string, unknown>)['getSetCookie'] === 'function') {
        return ((headers as unknown as { getSetCookie(): string[] }).getSetCookie()).join(', ');
    }
    // Fallback: older runtimes where get('set-cookie') returns a combined string
    return headers.get('set-cookie') ?? '';
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${AUTH_URL}/auth/v1/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(`Login failed: ${res.status} ${JSON.stringify(err)}`);
    }

    // Cookie-based auth: token is in Set-Cookie header, user object in body
    const cookie = getSetCookieString(res.headers);
    const tokenMatch = cookie.match(/pf_token=([^;]+)/);
    const user = await res.json() as LoginResponse['user'];
    return {
        token: tokenMatch?.[1] ?? '',
        user,
        cookie,
    };
}

export async function apiRegister(
    email:    string,
    username: string,
    password: string,
): Promise<LoginResponse> {
    const res = await fetch(`${AUTH_URL}/auth/v1/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, username, password, tosAccepted: true }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(`Register failed: ${res.status} ${JSON.stringify(err)}`);
    }

    // Cookie-based auth: token is in Set-Cookie header, user object in body
    const cookie = getSetCookieString(res.headers);
    const tokenMatch = cookie.match(/pf_token=([^;]+)/);
    const user = await res.json() as LoginResponse['user'];
    return {
        token: tokenMatch?.[1] ?? '',
        user,
        cookie,
    };
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
    email:    string,
    username: string,
    password: string,
): Promise<LoginResponse> {
    // 1. Register
    const result = await apiRegister(email, username, password);

    // 2. Extract verification token from Mailpit email
    const { waitForEmail } = await import('./mailhog');
    const msg  = await waitForEmail(email, 15_000);
    const body = msg.HTML || msg.Text || '';

    // Token is a 64-char hex string in the verify-email URL query param
    const tokenMatch = body.match(/[?&]token=([a-f0-9]{64})/i);
    if (!tokenMatch) {
        throw new Error(`Could not extract verification token from email to ${email}`);
    }
    const verifyToken = tokenMatch[1];

    // 3. Verify email via API
    const verifyRes = await fetch(`${AUTH_URL}/auth/v1/verify-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: verifyToken }),
    });
    if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(`Email verification failed: ${verifyRes.status} ${JSON.stringify(err)}`);
    }

    return result;
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

export async function apiGetStrategies(token: string): Promise<StrategyResponse[]> {
    const res = await fetch(`${API_URL}/api/v1/strategies`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Cookie: `pf_token=${token}`,
        },
    });
    if (!res.ok) throw new Error(`GET /strategies failed: ${res.status}`);
    const data = await res.json() as { data: StrategyResponse[] };
    return data.data;
}

export async function apiDeleteStrategy(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/v1/strategies/${id}`, {
        method:  'DELETE',
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

export async function apiStopStrategy(token: string, id: string): Promise<void> {
    await fetch(`${API_URL}/api/v1/strategies/${id}/stop`, {
        method:  'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Cookie: `pf_token=${token}`,
        },
    });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Generates a unique email address for test isolation */
export function uniqueEmail(prefix = 'test'): string {
    const ts = Date.now().toString(36);
    return `${prefix}+${ts}@e2e.dev.local`;
}

/** Generates a unique username */
export function uniqueUsername(prefix = 'testuser'): string {
    return `${prefix}${Date.now().toString(36)}`.slice(0, 20);
}
