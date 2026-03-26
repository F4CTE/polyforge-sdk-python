import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

export function Component() {
  const navigate = useNavigate();
  const login = useAdminAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password, totpRequired ? totpCode : undefined);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { body?: { code?: string; message?: string } };
      if (apiErr?.body?.code === 'TOTP_REQUIRED') {
        setTotpRequired(true);
        toast.info('2FA code required');
      } else {
        toast.error(apiErr?.body?.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.06) 0%, transparent 60%), var(--color-pf-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
                stroke="var(--color-pf-cyan-500)"
                strokeWidth="1.2"
                fill="none"
                opacity="0.4"
              />
              <path
                d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z"
                fill="var(--color-pf-cyan-500)"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-pf-text)]">
            Polyforge Admin
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <ShieldCheck size={14} className="text-[var(--color-pf-cyan-500)]" />
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">
              Admin Console
            </span>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 space-y-4 shadow-pf-lg"
        >
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors"
              placeholder="admin@polyforge.io"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors"
              placeholder="Enter password"
            />
          </div>

          {totpRequired && (
            <div>
              <label htmlFor="totp" className="block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5">
                2FA Code
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="w-full px-3 py-2 text-sm text-center tracking-[0.3em] font-mono rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (totpRequired && totpCode.length < 6)}
            className="w-full py-2 px-4 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : totpRequired ? 'Verify & Sign In' : 'Sign In'}
          </button>

          <p className="text-sm text-center text-amber-400">
            This endpoint is rate limited. Too many failed attempts will result in a temporary lockout.
          </p>
        </form>

        <p className="text-sm text-gray-400 mt-3 text-center">
          Forgot password? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}
