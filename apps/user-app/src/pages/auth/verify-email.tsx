import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthBackground } from '@/components/auth-background';
import { Button } from '@polyforge/ui';

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
        <div className="bg-elevated border border-default rounded-xl p-8 shadow-lg">
          {/* Pending - loading */}
          {state === 'pending' && (
            <div className="text-center py-4" role="status">
              <Loader2 className="size-12 text-accent motion-safe:animate-spin mx-auto mb-4" aria-hidden="true" />
              <p className="text-tertiary text-sm">Verifying your email...</p>
            </div>
          )}

          {/* Verified */}
          {state === 'verified' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-gain/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-gain" />
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">Email verified!</h1>
              <p className="text-sm text-tertiary mb-6">Your account is now active.</p>
              <Link
                to="/markets"
                className="inline-block px-6 py-3 bg-accent text-inverse font-semibold rounded-pf hover:bg-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-elevated"
              >
                Go to Markets
              </Link>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-loss/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="size-8 text-loss" />
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">Verification failed</h1>
              <p className="text-sm text-loss mb-6">{error}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResend}
                disabled={resending}
                className="inline-block px-6 py-3 border border-default text-primary font-medium rounded-pf hover:bg-default/30 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {resending ? 'Sending...' : 'Resend email'}
              </Button>
            </div>
          )}

          {/* Waiting - no token, just registered */}
          {state === 'waiting' && (
            <div className="text-center">
              <div className="size-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="size-8 text-accent" />
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">Check your email</h1>
              <p className="text-sm text-tertiary mb-4">
                We sent a verification link to{' '}
                {user?.email ? <strong className="text-primary">{user.email}</strong> : 'your email'}
                . Click the link to activate your account.
              </p>

              {resent && (
                <div className="flex items-center justify-center gap-2 bg-gain/10 border border-gain/20 text-gain rounded-pf px-4 py-3 mb-4 text-sm">
                  <Check className="size-4" />
                  <span>Verification email resent!</span>
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={handleResend}
                disabled={resending}
                className="w-full py-3 border border-default text-primary font-medium rounded-pf hover:bg-default/30 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {resending ? 'Sending...' : 'Resend email'}
              </Button>

              <div className="mt-4 text-sm">
                <Link to="/login" className="text-accent hover:text-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">
                  Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
