import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Mail, ArrowLeft, Check } from 'lucide-react';
import { AuthBackground } from '@/components/auth-background';
import { Button, Input } from '@polyforge/ui';

export function Component() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailError = touched && !email ? 'Email is required'
    : touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address'
    : '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setLoading(true);
    try {
      await fetch('/auth/v1/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
    } catch {
      // always show success per spec
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative bg-pf-base"
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
          {!sent ? (
            <>
              <h1 className="text-xl font-semibold text-pf-text mb-1">Reset password</h1>
              <p className="text-sm text-pf-text-muted mb-6">We&apos;ll send you a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-pf-text mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="you@example.com"
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? 'forgot-email-error' : undefined}
                      className="w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors"
                    />
                  </div>
                  {emailError && <p id="forgot-email-error" role="alert" className="mt-1 text-xs text-pf-danger">{emailError}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-pf-cyan-500 text-pf-text-contrast font-semibold rounded-pf hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="size-16 rounded-pf-full bg-pf-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-pf-cyan-500" />
              </div>
              <h1 className="text-xl font-semibold text-pf-text mb-2">Check your inbox</h1>
              <p className="text-sm text-pf-text-muted">
                If an account with that email exists, we&apos;ve sent a reset link.
              </p>
            </div>
          )}

          <div className="border-t border-pf-border mt-6 pt-4 text-center text-sm">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 rounded-pf-sm">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
