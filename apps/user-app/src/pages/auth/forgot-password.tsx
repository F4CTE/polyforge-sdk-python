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
          {!sent ? (
            <>
              <h1 className="text-xl font-semibold text-primary mb-1">Reset password</h1>
              <p className="text-body-sm text-tertiary mb-6">We&apos;ll send you a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-body-md font-medium text-primary mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
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
                      className="w-full pl-10 pr-4 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent transition-colors"
                    />
                  </div>
                  {emailError && <p id="forgot-email-error" role="alert" className="mt-1 text-label text-loss">{emailError}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-accent text-inverse font-semibold rounded-pf hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-elevated"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="size-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Check className="size-8 text-accent" />
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">Check your inbox</h1>
              <p className="text-body-sm text-tertiary">
                If an account with that email exists, we&apos;ve sent a reset link.
              </p>
            </div>
          )}

          <div className="border-t border-default mt-6 pt-4 text-center text-body-sm">
            <Link to="/login" className="inline-flex items-center gap-2 text-accent hover:text-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
