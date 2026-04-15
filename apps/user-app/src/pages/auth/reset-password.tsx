import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Lock, Check, AlertCircle } from 'lucide-react';
import { AuthBackground } from '@/components/auth-background';
import { Button, Input } from '@polyforge/ui';

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
        body: JSON.stringify({ token, newPassword: password }),
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
    <main
      className="min-h-screen flex items-center justify-center p-4 relative bg-app"
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-accent inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Card */}
        <div className="bg-elevated border border-default rounded-pf-lg p-8 shadow-pf-lg">
          {!done ? (
            <>
              <h1 className="text-xl font-semibold text-primary mb-1">Set new password</h1>
              <p className="text-sm text-tertiary mb-6">Choose a strong password.</p>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-loss/10 border border-loss/20 text-loss rounded-pf px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-primary mb-2">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      placeholder="At least 8 characters"
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? 'reset-password-error' : undefined}
                      className="w-full pl-10 pr-4 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent transition-colors"
                    />
                  </div>
                  {passwordError && <p id="reset-password-error" role="alert" className="mt-1 text-xs text-loss">{passwordError}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-primary mb-2">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                      placeholder="Repeat password"
                      aria-invalid={!!confirmError}
                      aria-describedby={confirmError ? 'reset-confirm-error' : undefined}
                      className="w-full pl-10 pr-4 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent transition-colors"
                    />
                  </div>
                  {confirmError && <p id="reset-confirm-error" role="alert" className="mt-1 text-xs text-loss">{confirmError}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-accent text-inverse font-semibold rounded-pf hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
                >
                  {loading ? 'Resetting...' : 'Reset password'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="size-16 rounded-pf-full bg-gain/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-gain" />
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">Password reset</h1>
              <p className="text-sm text-tertiary mb-6">You can now sign in with your new password.</p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-accent text-inverse font-semibold rounded-pf hover:bg-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
