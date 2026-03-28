import { WaitlistForm } from './waitlist-form';

export function Hero() {
  return (
    <header className="relative overflow-hidden pt-16 sm:pt-[100px] pb-12 sm:pb-20 text-center">
      {/* Glow */}
      <div
        className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse, rgba(6,182,212,0.14) 0%, rgba(6,182,212,0.04) 40%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {[
          { w: 4, left: '15%', top: '20%', dur: '8s', delay: '0s' },
          { w: 3, left: '80%', top: '30%', dur: '10s', delay: '1s' },
          { w: 5, left: '40%', top: '60%', dur: '12s', delay: '2s' },
          { w: 3, left: '70%', top: '70%', dur: '9s', delay: '3s' },
          { w: 4, left: '25%', top: '80%', dur: '11s', delay: '0.5s' },
          { w: 3, left: '55%', top: '15%', dur: '7s', delay: '1.5s' },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-pf-cyan-500/25"
            style={{
              width: p.w,
              height: p.w,
              left: p.left,
              top: p.top,
              animation: `float-particle ${p.dur} linear ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-[1100px] mx-auto px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-pf-cyan-400 bg-pf-cyan-500/8 border border-pf-cyan-500/20 rounded-full px-3.5 py-1 mb-7">
          <span
            className="w-[7px] h-[7px] rounded-full bg-pf-cyan-400"
            style={{ animation: 'pulse-dot 2s infinite' }}
          />
          Early Access &mdash; Limited Invites
        </div>

        <h1 className="text-[clamp(40px,7vw,72px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-pf-text mb-6">
          Automate your edge on
          <br />
          <span className="bg-gradient-to-br from-pf-cyan-300 to-pf-cyan-500 bg-clip-text text-transparent">
            prediction markets
          </span>
        </h1>

        <p className="text-[clamp(16px,2vw,19px)] text-pf-text-secondary max-w-[560px] mx-auto mb-9 leading-relaxed">
          Build automated trading strategies, copy whale traders, get AI-powered signals, and
          deploy 24/7 &mdash; all without writing code.
        </p>

        <WaitlistForm className="max-w-[480px] mx-auto mb-4" />

        <p className="mt-6">
          <a href="#how-it-works" className="text-[13px] text-pf-text-muted hover:text-pf-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors">
            See how it works <span aria-hidden="true">&darr;</span>
          </a>
        </p>

        {/* Hero strategy builder canvas */}
        <div className="max-w-[620px] mx-auto mt-6 bg-pf-surface border border-pf-border-subtle rounded-pf-lg overflow-hidden p-2 sm:p-4 shadow-pf-lg">
          <svg
            viewBox="0 0 560 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
            aria-hidden="true"
          >
            {/* Connection lines */}
            <path d="M140 80 L240 80" stroke="rgba(6,182,212,0.4)" strokeWidth="2" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
            </path>
            <path d="M340 80 L420 130" stroke="rgba(6,182,212,0.4)" strokeWidth="2" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
            </path>
            <path d="M140 200 L240 200" stroke="rgba(6,182,212,0.4)" strokeWidth="2" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2.5s" repeatCount="indefinite" />
            </path>
            <path d="M340 200 L420 170" stroke="rgba(6,182,212,0.4)" strokeWidth="2" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2.5s" repeatCount="indefinite" />
            </path>

            {/* Block 1: Entry Signal */}
            <rect x="20" y="50" width="120" height="60" rx="10" fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.35)" strokeWidth="1.5" />
            <text x="80" y="73" textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">ENTRY SIGNAL</text>
            <text x="80" y="93" textAnchor="middle" fill="#9898b0" fontSize="9" fontFamily="Inter, sans-serif">{'Price > 0.65'}</text>

            {/* Block 2: Volume Check */}
            <rect x="20" y="170" width="120" height="60" rx="10" fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.35)" strokeWidth="1.5" />
            <text x="80" y="193" textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">VOLUME CHECK</text>
            <text x="80" y="213" textAnchor="middle" fill="#9898b0" fontSize="9" fontFamily="Inter, sans-serif">{'Vol > 10k / 24h'}</text>

            {/* Block 3: Risk Manager */}
            <rect x="240" y="50" width="120" height="60" rx="10" fill="rgba(34,211,238,0.06)" stroke="rgba(34,211,238,0.3)" strokeWidth="1.5" />
            <text x="300" y="73" textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">RISK MANAGER</text>
            <text x="300" y="93" textAnchor="middle" fill="#9898b0" fontSize="9" fontFamily="Inter, sans-serif">Max 5% per trade</text>

            {/* Block 4: Position Size */}
            <rect x="240" y="170" width="120" height="60" rx="10" fill="rgba(34,211,238,0.06)" stroke="rgba(34,211,238,0.3)" strokeWidth="1.5" />
            <text x="300" y="193" textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">POSITION SIZE</text>
            <text x="300" y="213" textAnchor="middle" fill="#9898b0" fontSize="9" fontFamily="Inter, sans-serif">Kelly criterion</text>

            {/* Block 5: Execute */}
            <rect x="420" y="120" width="120" height="60" rx="10" fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.3)" strokeWidth="1.5" />
            <text x="480" y="143" textAnchor="middle" fill="#4ade80" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">EXECUTE</text>
            <text x="480" y="163" textAnchor="middle" fill="#9898b0" fontSize="9" fontFamily="Inter, sans-serif">Buy YES @ market</text>

            {/* Live pulse */}
            <circle cx="530" cy="128" r="4" fill="#4ade80">
              <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </div>
    </header>
  );
}
