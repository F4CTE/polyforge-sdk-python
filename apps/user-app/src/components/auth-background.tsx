/**
 * Animated background for auth pages (login/register).
 * Renders subtle floating geometric shapes that evoke a trading/data aesthetic.
 * Uses pure CSS animations — no JS timers or requestAnimationFrame.
 *
 * Opacity values: Decorative only — arbitrary opacity intentional.
 * Standard Tailwind modifiers (opacity-5, opacity-10) round 3–6% values up
 * enough to noticeably alter the ambient effect. Arbitrary values are kept per
 * design charter §9 exception for purely decorative ambient elements.
 */
export function AuthBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 auth-bg-gradient" />

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
        <defs>
          <pattern id="auth-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-accent-text" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* Floating hexagons — ambient durations use documented §9 exceptions */}
      <svg className="absolute top-[15%] left-[10%] w-20 h-20 text-accent opacity-[0.06] auth-float" style={{ animationDuration: 'var(--duration-ambient-fast)' }}>
        <polygon points="40,2 75,22 75,62 40,82 5,62 5,22" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute top-[60%] right-[8%] w-14 h-14 text-accent-text opacity-[0.05] auth-float auth-float--reverse" style={{ animationDuration: 'var(--duration-ambient-drift)' }}>
        <polygon points="28,1 53,15 53,43 28,57 3,43 3,15" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute top-3/4 left-[20%] w-10 h-10 text-accent-text opacity-[0.04] auth-float" style={{ animationDuration: 'var(--duration-ambient-medium)' }}>
        <polygon points="20,1 38,11 38,31 20,41 2,31 2,11" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute top-1/4 right-[15%] w-16 h-16 text-accent opacity-[0.04] auth-float auth-float--reverse" style={{ animationDuration: 'var(--duration-ambient-fast)' }}>
        <polygon points="32,1 61,17 61,49 32,65 3,49 3,17" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Floating circles (data points) */}
      <div className="absolute top-[30%] left-1/4 w-2 h-2 rounded-full bg-accent opacity-[0.12] auth-float" style={{ animationDuration: 'var(--duration-ambient-slow)' }} />
      <div className="absolute top-1/2 right-1/4 w-2 h-2 rounded-full bg-accent-text opacity-[0.10] auth-float auth-float--reverse" style={{ animationDuration: 'var(--duration-ambient-medium)' }} />
      <div className="absolute top-[80%] left-[60%] w-3 h-3 rounded-full bg-accent opacity-[0.08] auth-float" style={{ animationDuration: 'var(--duration-ambient-fast)' }} />
      <div className="absolute top-[10%] right-[35%] w-1 h-1 rounded-full bg-accent-text opacity-[0.15] auth-float auth-float--reverse" style={{ animationDuration: 'var(--duration-ambient-slow)' }} />

      {/* Diagonal accent lines */}
      <div className="absolute top-[20%] left-[5%] w-px h-40 rotate-[30deg] bg-gradient-to-b from-transparent via-accent/10 to-transparent opacity-60 auth-float" style={{ animationDuration: 'var(--duration-ambient-slow)' }} />
      <div className="absolute top-1/2 right-[12%] w-px h-32 -rotate-[20deg] bg-gradient-to-b from-transparent via-accent-text/8 to-transparent opacity-50 auth-float auth-float--reverse" style={{ animationDuration: 'var(--duration-ambient-fast)' }} />

    </div>
  );
}
