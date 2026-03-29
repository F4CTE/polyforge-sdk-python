import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthBackground } from '@/components/auth-background';

type VerifyState = 'pending' | 'waiting' | 'verified' | 'error';

export function Component() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const [state, setState] = useState<VerifyState>(token ? 'pending' : 'waiting');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch('/auth/v1/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          setState('verified');
          patchUser({ emailVerified: true });
        } else {
          const err = await res.json();
          setState('error');
          setError(err?.message ?? 'Verification link is invalid or expired.');
        }
      } catch {
        if (!cancelled) {
          setState('error');
          setError('Verification link is invalid or expired.');
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token, patchUser]);

  async function handleResend() {
    if (!user?.email) return;
    setResending(true);
    try {
      await fetch('/auth/v1/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: user.email }),
      });
      setResent(true);
    } catch {
      // silently ignore
    } finally {
      setResending(false);
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
          {/* Pending - loading */}
          {state === 'pending' && (
            <div className="text-center py-4" role="status">
              <Loader2 className="size-12 text-pf-cyan-500 motion-safe:animate-spin mx-auto mb-4" aria-hidden="true" />
              <p className="text-pf-text-muted text-sm">Verifying your email...</p>
            </div>
          )}

          {/* Verified */}
          {state === 'verified' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-pf-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-pf-success" />
              </div>
              <h2 className="text-xl font-semibold text-pf-text mb-2">Email verified!</h2>
              <p className="text-sm text-pf-text-muted mb-6">Your account is now active.</p>
              <Link
                to="/markets"
                className="inline-block px-6 py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
              >
                Go to Markets
              </Link>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-pf-danger/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="size-8 text-pf-danger" />
              </div>
              <h2 className="text-xl font-semibold text-pf-text mb-2">Verification failed</h2>
              <p className="text-sm text-pf-danger mb-6">{error}</p>
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-block px-6 py-2.5 border border-pf-border text-pf-text font-medium rounded-pf hover:bg-pf-border/30 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
              >
                {resending ? 'Sending...' : 'Resend email'}
              </button>
            </div>
          )}

          {/* Waiting - no token, just registered */}
          {state === 'waiting' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-pf-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="size-8 text-pf-cyan-500" />
              </div>
              <h2 className="text-xl font-semibold text-pf-text mb-2">Check your email</h2>
              <p className="text-sm text-pf-text-muted mb-4">
                We sent a verification link to{' '}
                {user?.email ? <strong className="text-pf-text">{user.email}</strong> : 'your email'}
                . Click the link to activate your account.
              </p>

              {resent && (
                <div className="flex items-center justify-center gap-2 bg-pf-success/10 border border-pf-success/20 text-pf-success rounded-pf px-4 py-3 mb-4 text-sm">
                  <Check className="size-4" />
                  <span>Verification email resent!</span>
                </div>
              )}

              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full py-2.5 border border-pf-border text-pf-text font-medium rounded-pf hover:bg-pf-border/30 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
              >
                {resending ? 'Sending...' : 'Resend email'}
              </button>

              <div className="mt-4 text-sm">
                <Link to="/login" className="text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 rounded-pf-sm">
                  Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
