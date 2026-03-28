import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Mail, Lock, User, KeyRound, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthBackground } from '@/components/auth-background';

function validatePassword(v: string): string {
  if (!v) return '';
  if (!/[A-Z]/.test(v)) return 'Must contain at least one uppercase letter';
  if (!/[a-z]/.test(v)) return 'Must contain at least one lowercase letter';
  if (!/[0-9]/.test(v)) return 'Must contain at least one number';
  return '';
}

function validateUsername(v: string): string {
  if (!v) return '';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores';
  if (/^_/.test(v) || /_$/.test(v)) return 'Cannot start or end with underscore';
  return '';
}

export function Component() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') ?? '');
  const [showInvite, setShowInvite] = useState(!!searchParams.get('invite'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function fieldError(field: string): string {
    if (!touched[field]) return '';
    switch (field) {
      case 'email':
        if (!email) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
        if (email.length > 255) return 'Maximum 255 characters';
        return '';
      case 'username':
        if (!username) return 'Username is required';
        if (username.length < 3) return 'Minimum 3 characters';
        if (username.length > 30) return 'Maximum 30 characters';
        return validateUsername(username);
      case 'password':
        if (!password) return 'Password is required';
        if (password.length < 8) return 'Minimum 8 characters';
        return validatePassword(password);
      case 'confirmPassword':
        if (!confirmPassword) return 'Confirm your password';
        if (password !== confirmPassword) return 'Passwords do not match';
        return '';
      case 'tos':
        if (!tosAccepted) return 'You must accept the Terms of Service';
        return '';
      default:
        return '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const allTouched = { email: true, username: true, password: true, confirmPassword: true, tos: true };
    setTouched(allTouched);

    const hasErrors = ['email', 'username', 'password', 'confirmPassword', 'tos'].some((f) => {
      // Re-check with touched=true
      switch (f) {
        case 'email': return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255;
        case 'username': return !username || username.length < 3 || username.length > 30 || !!validateUsername(username);
        case 'password': return !password || password.length < 8 || !!validatePassword(password);
        case 'confirmPassword': return !confirmPassword || password !== confirmPassword;
        case 'tos': return !tosAccepted;
        default: return false;
      }
    });
    if (hasErrors) return;

    setLoading(true);
    setError('');

    try {
      const body: Parameters<typeof register>[0] = {
        email, username, password, tosAccepted,
      };
      if (inviteCode) body.inviteCode = inviteCode;
      await register(body);
      navigate('/verify-email');
    } catch (err: unknown) {
      setLoading(false);
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'ACCOUNT_PENDING') {
        navigate('/pending-approval');
        return;
      }
      if (apiErr?.code === 'INVITE_REQUIRED' || apiErr?.code === 'INVITE_INVALID') {
        setShowInvite(true);
      }
      setError(apiErr?.message ?? 'Registration failed. Please try again.');
    }
  }

  const inputClass = 'w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8 relative"
      style={{ background: 'var(--color-pf-base)' }}
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo centered above card */}
        <div className="text-center mb-8">
          <div className="text-pf-cyan-500 inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mt-4 bg-gradient-to-r from-pf-cyan-400 to-pf-cyan-300 bg-clip-text text-transparent">
            Create your account
          </h1>
          <p className="text-pf-text-muted text-sm mt-1">Start trading on autopilot</p>
        </div>

        {/* Card */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg">

          {error && (
            <div role="alert" className="flex items-center gap-2 bg-pf-danger/10 border border-pf-danger/20 text-pf-danger rounded-pf px-4 py-3 mb-4 text-sm">
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
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              {fieldError('email') && <p className="mt-1 text-xs text-pf-danger">{fieldError('email')}</p>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-pf-text mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  placeholder="alice"
                  className={inputClass}
                />
              </div>
              {fieldError('username') && <p className="mt-1 text-xs text-pf-danger">{fieldError('username')}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-pf-text mb-1.5">Password</label>
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
                  className={inputClass}
                />
              </div>
              {fieldError('password') && <p className="mt-1 text-xs text-pf-danger">{fieldError('password')}</p>}
              {touched.password && password && (
                <ul className="mt-1.5 text-xs space-y-0.5 list-disc list-inside">
                  <li className={password.length >= 8 ? 'text-pf-success' : 'text-pf-text-muted'}>Minimum 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? 'text-pf-success' : 'text-pf-text-muted'}>One uppercase letter</li>
                  <li className={/[a-z]/.test(password) ? 'text-pf-success' : 'text-pf-text-muted'}>One lowercase letter</li>
                  <li className={/\d/.test(password) ? 'text-pf-success' : 'text-pf-text-muted'}>One number</li>
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-pf-text mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                  placeholder="Repeat your password"
                  className={inputClass}
                />
              </div>
              {fieldError('confirmPassword') && <p className="mt-1 text-xs text-pf-danger">{fieldError('confirmPassword')}</p>}
            </div>

            {/* Invite Code */}
            {(showInvite || inviteCode) && (
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-pf-text mb-1.5">Invite code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="POLY-XXXXXX"
                    className={`${inputClass} uppercase`}
                  />
                </div>
              </div>
            )}

            {/* TOS */}
            <div className="flex items-start gap-2.5">
              <input
                id="tos"
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => { setTosAccepted(e.target.checked); setTouched((t) => ({ ...t, tos: true })); }}
                className="mt-1 size-4 rounded border-pf-border bg-pf-base accent-pf-cyan-500"
              />
              <label htmlFor="tos" className="text-sm text-pf-text leading-relaxed cursor-pointer">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-pf-cyan-500 hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors">
                  Terms of Service
                </a>
              </label>
            </div>
            {fieldError('tos') && <p className="text-xs text-pf-danger -mt-2">{fieldError('tos')}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

        </div>

        {/* Links below card */}
        <p className="text-center text-sm text-pf-text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-pf-cyan-400 hover:text-pf-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
