/**
 * Animated background for auth pages (login/register).
 * Renders subtle floating geometric shapes that evoke a trading/data aesthetic.
 * Uses pure CSS animations — no JS timers or requestAnimationFrame.
 */
export function AuthBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.05) 0%, transparent 40%)',
        }}
      />

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
        <defs>
          <pattern id="auth-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-pf-cyan-400" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* Floating hexagons */}
      <svg className="absolute w-20 h-20 text-pf-cyan-500 opacity-[0.06] animate-[float_20s_ease-in-out_infinite]" style={{ top: '15%', left: '10%' }}>
        <polygon points="40,2 75,22 75,62 40,82 5,62 5,22" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute w-14 h-14 text-pf-cyan-400 opacity-[0.05] animate-[float_25s_ease-in-out_infinite_reverse]" style={{ top: '60%', right: '8%' }}>
        <polygon points="28,1 53,15 53,43 28,57 3,43 3,15" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute w-10 h-10 text-pf-cyan-300 opacity-[0.04] animate-[float_18s_ease-in-out_infinite]" style={{ top: '75%', left: '20%' }}>
        <polygon points="20,1 38,11 38,31 20,41 2,31 2,11" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute w-16 h-16 text-pf-cyan-500 opacity-[0.04] animate-[float_22s_ease-in-out_infinite_reverse]" style={{ top: '25%', right: '15%' }}>
        <polygon points="32,1 61,17 61,49 32,65 3,49 3,17" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Floating circles (data points) */}
      <div className="absolute w-2 h-2 rounded-full bg-pf-cyan-500 opacity-[0.12] animate-[float_15s_ease-in-out_infinite]" style={{ top: '30%', left: '25%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-pf-cyan-400 opacity-[0.10] animate-[float_19s_ease-in-out_infinite_reverse]" style={{ top: '50%', right: '25%' }} />
      <div className="absolute w-2.5 h-2.5 rounded-full bg-pf-cyan-500 opacity-[0.08] animate-[float_23s_ease-in-out_infinite]" style={{ top: '80%', left: '60%' }} />
      <div className="absolute w-1 h-1 rounded-full bg-pf-cyan-300 opacity-[0.15] animate-[float_17s_ease-in-out_infinite_reverse]" style={{ top: '10%', right: '35%' }} />

      {/* Diagonal accent lines */}
      <div
        className="absolute w-px h-40 bg-gradient-to-b from-transparent via-pf-cyan-500/10 to-transparent opacity-60 animate-[float_16s_ease-in-out_infinite]"
        style={{ top: '20%', left: '5%', transform: 'rotate(30deg)' }}
      />
      <div
        className="absolute w-px h-32 bg-gradient-to-b from-transparent via-pf-cyan-400/8 to-transparent opacity-50 animate-[float_21s_ease-in-out_infinite_reverse]"
        style={{ top: '50%', right: '12%', transform: 'rotate(-20deg)' }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(1deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
          75% { transform: translateY(-20px) rotate(0.5deg); }
        }
      `}</style>
    </div>
  );
}
