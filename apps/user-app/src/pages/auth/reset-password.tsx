import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Lock, Check, AlertCircle } from 'lucide-react';
import { AuthBackground } from '@/components/auth-background';

export function Component() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? '' : 'Missing reset token. Please request a new link.');
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const passwordError = touched.password && !password ? 'Password is required'
    : touched.password && password.length < 8 ? 'Minimum 8 characters'
    : '';
  const confirmError = touched.confirm && password && confirm && password !== confirm ? 'Passwords do not match' : '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ password: true, confirm: true });

    if (
      !password || password.length < 8 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) ||
      password !== confirm || !token
    ) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/auth/v1/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const err = await res.json();
        setError(err?.message ?? 'Reset failed. Please request a new link.');
      }
    } catch {
      setError('Reset failed. Please request a new link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: 'var(--color-pf-base)' }}
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-pf-cyan-500 inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Card */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg">
          {!done ? (
            <>
              <h2 className="text-xl font-semibold text-pf-text mb-1">Set new password</h2>
              <p className="text-sm text-pf-text-muted mb-6">Choose a strong password.</p>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-pf-danger/10 border border-pf-danger/20 text-pf-danger rounded-pf px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-pf-text mb-1.5">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors"
                    />
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-pf-danger">{passwordError}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-pf-text mb-1.5">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                    <input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors"
                    />
                  </div>
                  {confirmError && <p className="mt-1 text-xs text-pf-danger">{confirmError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
                >
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="size-16 rounded-full bg-pf-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-pf-success" />
              </div>
              <h2 className="text-xl font-semibold text-pf-text mb-2">Password reset</h2>
              <p className="text-sm text-pf-text-muted mb-6">You can now sign in with your new password.</p>
              <Link
                to="/login"
   