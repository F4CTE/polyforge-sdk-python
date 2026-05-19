import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';
import './globals.css';

interface AuthTokenMap { [key: string]: string; }

function persistToken(key: string, token: string): void {
  try {
    window.sessionStorage.setItem(key, token);
  } catch {
    if (!window.__PF_AUTH_TOKENS__) window.__PF_AUTH_TOKENS__ = {};
    window.__PF_AUTH_TOKENS__[key] = token;
  }
}

declare global {
  interface Window { __PF_AUTH_TOKENS__?: AuthTokenMap; }
}

function scrubAuthTokensFromUrl(): void {
  const searchParams = new URLSearchParams(window.location.search);
  const sensitive = new Set(['token', 'code', 'reset_token', 'verification_token']);
  let hasSensitive = false;
  for (const key of sensitive) {
    if (searchParams.has(key)) { hasSensitive = true; break; }
  }
  if (!hasSensitive) return;

  const token = searchParams.get('token');
  if (token) {
    const path = window.location.pathname;
    if (path.includes('/reset-password')) {
      persistToken('pf.auth.resetPasswordToken', token);
    } else if (path.includes('/verify-email')) {
      persistToken('pf.auth.verifyEmailToken', token);
    }
  }

  for (const key of sensitive) searchParams.delete(key);
  const cleanSearch = searchParams.toString();
  window.history.replaceState(
    window.history.state, '',
    window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash,
  );
}

scrubAuthTokensFromUrl();
initAnalytics();
initSentry();

// ─── Global 401 interceptor with token refresh ───────────────────────────────
// On a 401 from any /api/ call, attempts POST /auth/v1/refresh first.
// If refresh succeeds the original request is retried with the new cookie.
// If refresh fails the user is redirected to /login.
const _fetch = window.fetch.bind(window);
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let redirecting = false;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) return refreshPromise ?? Promise.resolve(false);
  isRefreshing = true;
  refreshPromise = _fetch('/auth/v1/refresh', { method: 'POST', credentials: 'include' })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => { isRefreshing = false; refreshPromise = null; });
  return refreshPromise;
}

window.fetch = async (...args: Parameters<typeof fetch>) => {
  // Pass-through for non-API calls and for the refresh endpoint itself
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
  if (!url.startsWith('/api/') || url.startsWith('/auth/')) {
    return _fetch(...args);
  }

  const res = await _fetch(...args);
  if (res.status !== 401 || window.location.pathname === '/login') {
    return res;
  }

  // 401 on an API call — try to refresh the token once
  const refreshed = await tryRefresh();
  if (refreshed) {
    // Retry the original request with the new access token cookie
    return _fetch(...args);
  }

  // Refresh failed — redirect to login
  if (!redirecting) {
    redirecting = true;
    sessionStorage.setItem('session_expired', 'true');
    window.location.href = '/login';
  }
  return res;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
