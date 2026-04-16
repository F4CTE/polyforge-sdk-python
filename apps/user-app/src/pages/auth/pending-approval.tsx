import { Link } from 'react-router';
import { Clock, Mail } from 'lucide-react';
import { AuthBackground } from '@/components/auth-background';

export function Component() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative bg-app"
    >
      <AuthBackground />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="text-accent inline-block">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        <div className="bg-elevated border border-default rounded-xl p-8 shadow-lg text-center" role="status" aria-labelledby="pending-heading">
          <div className="size-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="size-8 text-warning" />
          </div>

          <h1 className="text-xl font-semibold text-primary mb-2" id="pending-heading">
            Account pending approval
          </h1>

          <p className="text-secondary text-body-sm mb-6">
            Your account has been created and is waiting for beta access approval.
            We'll send you an email at your registered address once your account is approved.
          </p>

          <div className="flex items-center gap-2 bg-surface border border-default rounded-pf px-4 py-3 mb-6 text-body-sm text-tertiary">
            <Mail className="size-4 shrink-0 text-accent-text" />
            <span>Check your inbox for a confirmation email</span>
          </div>

          <Link
            to="/login"
            className="text-accent-text text-body-md hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
