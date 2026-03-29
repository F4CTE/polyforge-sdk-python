import { Link } from 'react-router';
import { Clock, Mail } from 'lucide-react';
import { AuthBackground } from '@/components/auth-background';

export function Component() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative bg-pf-base"
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="text-pf-cyan-500 inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg text-center" role="status" aria-labelledby="pending-heading">
          <div className="size-16 rounded-full bg-pf-warning/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="size-8 text-pf-warning" />
          </div>

          <h1 className="text-xl font-semibold text-pf-text mb-2" id="pending-heading">
            Account pending approval
          </h1>

          <p className="text-pf-text-secondary text-sm mb-6">
            Your account has been created and is waiting for beta access approval.
            We'll send you an email at your registered address once your account is approved.
          </p>

          <div className="flex items-center gap-2 bg-pf-surface border border-pf-border rounded-pf px-4 py-3 mb-6 text-sm text-pf-text-muted">
            <Mail className="size-4 shrink-0 text-pf-cyan-400" />
            <span>Check your inbox for a confirmation email</span>
          </div>

          <Link
            to="/login"
            className="text-pf-cyan-400 text-sm hover:text-pf-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
