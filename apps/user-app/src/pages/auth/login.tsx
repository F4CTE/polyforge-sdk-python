import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, Lock, KeyRound, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthBackground } from '@/components/auth-background';
import { Button, Input } from '@polyforge/ui';

export function Component() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const getUser = () => useAuthStore.getState().user;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [requireTotp, setRequireTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('session_expired') === 'true') {
      setSessionExpired(true);
      sessionStorage.removeItem('session_expired');
    }
  }, []);

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
      // Redirect unverified users to the verification page instead of the app
      const loggedInUser = getUser();
      navigate(loggedInUser?.emailVerified === false ? '/verify-email' : '/markets');
    } catch (err: unknown) {
      setLoading(false);
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'TOTP_REQUIRED') {
        setRequireTotp(true);
        setError('');
      } else if (apiErr?.code === 'TOTP_INVALID') {
        setError('Invalid authentication code. Please check your authenticator app and try again.');
      } else if (apiErr?.code === 'TOTP_LOCKED') {
        setError('Too many failed attempts. Your account is temporarily locked. Please try again in 15 minutes.');
      } else if (apiErr?.code === 'ACCOUNT_SUSPENDED') {
        setError('Your account has been suspended. Please contact support.');
      } else if (apiErr?.code === 'ACCOUNT_PENDING') {
        setError('Your account is pending approval. You\'ll receive an email once approved.');
      } else {
        setError(apiErr?.message ?? 'Login failed. Please try again.');
      }
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative bg-app"
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo centered above card */}
        <div className="text-center mb-8">
          <div className="text-accent inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mt-4 bg-gradient-to-r from-accent-text to-accent-text bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-tertiary text-body-sm mt-1">Sign in to your Polyforge account</p>
        </div>

        {/* Card */}
        <div className="bg-elevated border border-default rounded-pf p-8 shadow-elevation-3">

          {sessionExpired && (
            <div role="alert" className="flex items-center gap-2 bg-warning/10 border border-warning/20 text-warning rounded-pf px-4 py-3 mb-4 text-body-md">
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">Your session has expired. Please sign in again.</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSessionExpired(false)}
                className="shrink-0 text-warning hover:text-warning/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40 rounded-sm cursor-pointer"
                aria-label="Dismiss warning"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 bg-loss/10 border border-loss/20 text-loss rounded-pf px-4 py-3 mb-4 text-body-md">
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setError('')}
                className="shrink-0 text-loss hover:text-loss/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/40 rounded-sm cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'login-email-error' : undefined}
                  className="w-full pl-10 pr-4 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:border-accent transition-colors"
                />
              </div>
              {emailError && <p id="login-email-error" role="alert" className="mt-1 text-label text-loss">{emailError}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-body-md font-medium text-primary mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Your password"
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                  className="w-full pl-10 pr-10 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:border-accent transition-colors"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {passwordError && <p id="login-password-error" role="alert" className="mt-1 text-label text-loss">{passwordError}</p>}
            </div>

            {/* TOTP */}
            {requireTotp && (
              <div>
                <label htmlFor="totp" className="block text-body-md font-medium text-primary mb-1">Two-Factor Code</label>
                <p className="text-label text-tertiary mb-2">Enter the 6-digit code from your authenticator app.</p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    aria-label="6-digit authentication code"
                    className="w-full pl-10 pr-4 py-3 bg-app border border-default rounded-pf text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:border-accent tracking-[0.3em] font-mono transition-colors"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-inverse font-semibold rounded-pf hover:bg-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center text-body-sm">
              <Link to="/forgot-password" className="text-accent hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors">
                Forgot password?
              </Link>
          </div>
        </div>

        {/* Links below card */}
        <p className="text-center text-body-sm text-tertiary mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-accent-text hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
