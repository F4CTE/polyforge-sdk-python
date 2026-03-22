const steps = [
  {
    number: '01',
    title: 'Build your strategy',
    description:
      'Use the visual block builder to define your entry triggers (price thresholds, volume spikes, time-based rules), sizing logic, and exit conditions. Preview the logic in plain English before you run anything.',
    visual: (
      <svg className="w-20 h-20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="15" width="28" height="18" rx="4" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <rect x="44" y="15" width="28" height="18" rx="4" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <rect x="26" y="48" width="28" height="18" rx="4" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
        <path d="M22 33 L36 48" stroke="rgba(6,182,212,0.4)" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M58 33 L44 48" stroke="rgba(6,182,212,0.4)" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Backtest against history',
    description:
      'Run your strategy across months of real market data in seconds. Review the equity curve, per-trade breakdown, and risk metrics. Tune parameters until the numbers satisfy your conviction.',
    visual: (
      <svg className="w-20 h-20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="65" x2="70" y2="65" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <polyline points="10,55 20,50 30,52 40,40 50,35 60,30 70,22" stroke="#22d3ee" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="70" cy="22" r="3" fill="#22d3ee" opacity="0.7" />
        <text x="70" y="17" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">+34%</text>
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Deploy and monitor',
    description:
      'Hit Deploy. Polyforge\'s execution engine watches the markets and fires orders automatically. Track live P&L, position sizing, and fill quality from your portfolio dashboard \u2014 or connect via our REST API for programmatic access.',
    visual: (
      <svg className="w-20 h-20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="20" width="56" height="40" rx="6" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.2)" strokeWidth="1" />
        <circle cx="40" cy="36" r="4" fill="#4ade80">
          <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="40" y="52" textAnchor="middle" fill="#9898b0" fontSize="7" fontFamily="Inter, sans-serif">Running</text>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="py-24" id="how-it-works" aria-labelledby="hiw-heading">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center max-w-[600px] mx-auto mb-14">
          <h2
            id="hiw-heading"
            className="text-[clamp(24px,4vw,34px)] font-bold text-pf-text mb-3.5"
          >
            From idea to live in three steps
          </h2>
          <p className="text-[17px] text-pf-text-secondary">
            No servers to manage, no code to write, no delay.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1000px] mx-auto">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center">
              <div className="flex flex-col items-center gap-3 mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-pf-cyan-500/20 to-pf-elevated border border-pf-cyan-500/35 rounded-full flex items-center justify-center text-[15px] font-bold font-mono text-pf-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.15),0_0_48px_rgba(6,182,212,0.06)]">
                  {step.number}
                </div>
                {step.visual}
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-pf-text mb-2.5">{step.title}</h3>
                <p className="text-sm text-pf-text-secondary leading-7">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
