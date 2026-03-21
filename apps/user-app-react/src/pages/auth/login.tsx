import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, Lock, KeyRound, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export function Component() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [requireTotp, setRequireTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const emailError = touched.email && !email ? 'Email is required'
    : touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address'
    : '';
  const passwordError = touched.password && !password ? 'Password is required' : '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setLoading(true);
    setError('');

    try {
      await login({ email, password, ...(totp ? { totpCode: totp } : {}) });
      navigate('/markets');
    } catch (err: unknown) {
      setLoading(false);
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'TOTP_REQUIRED') {
        setRequireTotp(true);
        setError('');
      } else if (apiErr?.code === 'ACCOUNT_SUSPENDED') {
        setError('Your account has been suspended. Please contact support.');
      } else {
        setError(apiErr?.message ?? 'Login failed. Please try again.');
      }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-pf-base">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-pf-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="#06b6d4" strokeWidth="1.2" fill="none" opacity="0.4"/>
            <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="#06b6d4"/>
          </svg>
          <span className="text-xl font-semibold text-pf-text">Polyforge</span>
        </div>

        {/* Card */}
        <div className="bg-pf-elevated border border-pf-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-pf-text mb-1">Welcome back</h2>
          <p className="text-sm text-pf-text-muted mb-6">Sign in to your account</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-pf-text mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-lg text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors"
                />
              </div>
              {emailError && <p className="mt-1 text-xs text-red-400">{emailError}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-pf-text mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Your password"
                  className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-lg text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors"
                />
              </div>
              {passwordError && <p className="mt-1 text-xs text-red-400">{passwordError}</p>}
            </div>

            {/* TOTP */}
            {requireTotp && (
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-pf-text mb-1">Two-Factor Code</label>
                <p className="text-xs text-pf-text-muted mb-2">Enter the 6-digit code from your authenticator app.</p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                  <input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-lg text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 tracking-[0.3em] font-mono transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-pf-cyan-500 text-pf-base font-semibold rounded-lg hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="border-t border-pf-border mt-6 pt-4 space-y-2 text-center text-sm">
            <div>
              <Link to="/forgot-password" className="text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="text-pf-text-muted">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors">
                Create one
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
