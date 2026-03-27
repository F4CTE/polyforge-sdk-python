import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './globals.css';

// ─── Global 401 interceptor ──────────────────────────────────────────────────
// Intercepts any API fetch that returns 401 and redirects to /login with a
// session-expired notice, instead of showing raw errors on every page.
const _fetch = window.fetch.bind(window);
let redirecting = false;
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const res = await _fetch(...args);
  if (
    res.status === 401 &&
    !redirecting &&
    typeof args[0] === 'string' &&
    args[0].startsWith('/api/') &&
    window.location.pathname !== '/login'
  ) {
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
