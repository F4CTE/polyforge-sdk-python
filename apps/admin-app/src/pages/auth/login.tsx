import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';
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
      } else if (apiErr?.body?.code === 'TOTP_INVALID') {
        toast.error('Invalid authentication code. Please check your authenticator app and try again.');
      } else if (apiErr?.body?.code === 'TOTP_LOCKED') {
        toast.error('Too many failed attempts. Your account is temporarily locked. Please try again in 15 minutes.');
      } else {
        toast.error(apiErr?.body?.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 admin-login-bg"
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
                stroke="var(--accent-default)"
                strokeWidth="1.2"
                fill="none"
                opacity="0.4"
              />
              <path
                d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z"
                fill="var(--accent-default)"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-primary">
            Polyforge Admin
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <ShieldCheck size={14} className="text-accent" aria-hidden="true" />
            <span className="text-label text-tertiary">
              Admin Console
            </span>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-elevated border border-default rounded-pf p-6 space-y-4 [box-shadow:var(--shadow-elevation-2)]"
        >
          <div>
            <label htmlFor="email" className="block text-label font-medium text-secondary mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 text-body-sm rounded-sm border border-default bg-app text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent transition-colors"
              placeholder="admin@polyforge.io"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-label font-medium text-secondary mb-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-body-sm rounded-sm border border-default bg-app text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent transition-colors"
              placeholder="Enter password"
            />
          </div>

          {totpRequired && (
            <div>
              <label htmlFor="totp" className="block text-label font-medium text-secondary mb-2">
                2FA Code
              </label>
              <Input
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
                className="w-full px-3 py-2 text-body-sm text-center tracking-widest font-mono rounded-sm border border-default bg-app text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent transition-colors"
                placeholder="000000"
              />
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            disabled={loading || (totpRequired && totpCode.length < 6)}
            className="w-full py-2 px-4 text-body-md font-semibold rounded-sm bg-accent text-inverse hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : totpRequired ? 'Verify & Sign In' : 'Sign In'}
          </Button>

          <p className="text-body-sm text-center text-warning">
            This endpoint is rate limited. Too many failed attempts will result in a temporary lockout.
          </p>
        </form>

        <p className="text-body-sm text-tertiary mt-3 text-center">
          Forgot password? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}
