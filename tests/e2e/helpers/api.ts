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
    const cookie = res.headers.get('set-cookie') ?? '';
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
    const cookie = res.headers.get('set-cookie') ?? '';
    const tokenMatch = cookie.match(/pf_token=([^;]+)/);
    const user = await res.json() as LoginResponse['user'];
    return {
        token: tokenMatch?.[1] ?? '',
        user,
        cookie,
    };
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
