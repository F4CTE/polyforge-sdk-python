import { WaitlistForm } from './waitlist-form';

export function CtaBanner() {
  return (
    <section className="py-24" aria-labelledby="cta-heading">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="relative overflow-hidden bg-pf-surface border border-pf-cyan-500/20 rounded-pf-lg px-6 sm:px-12 py-12 sm:py-16 text-center">
          {/* Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.04) 40%, transparent 65%)',
            }}
            aria-hidden="true"
          />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden="true"
          />

          <h2
            id="cta-heading"
            className="relative text-[clamp(24px,4vw,36px)] font-bold text-pf-text mb-4"
          >
            Your edge{' '}
            <span className="bg-gradient-to-br from-pf-cyan-300 to-pf-cyan-500 bg-clip-text text-transparent">
              starts here
            </span>
          </h2>
          <p className="relative text-base text-pf-text-secondary max-w-[480px] mx-auto mb-8 leading-relaxed">
            Start building smarter strategies today. Visual builder, AI signals, whale tracking,
            copy trading &mdash; all in one platform. No credit card required.
          </p>

          <WaitlistForm className="relative max-w-[480px] mx-auto" />

          <p className="relative text-sm text-pf-text-muted mt-4">
            Or{' '}
            <a
              href="/login"
              className="text-pf-cyan-400 underline underline-offset-[3px] hover:text-pf-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors"
            >
              sign in to your existing account
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
