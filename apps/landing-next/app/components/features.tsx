const features = [
  {
    title: 'No-code Strategy Builder',
    description:
      'Drag-and-drop blocks to compose entry signals, risk rules, and exit conditions. No programming knowledge required \u2014 just your market thesis.',
    gradientClass: 'from-pf-cyan-500/[0.04]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M17 13v8M13 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="50" height="28" rx="6" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="35" y="38" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif">Signal</text>
        <path d="M60 34 L80 34" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="80" y="20" width="50" height="28" rx="6" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="105" y="38" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif">Filter</text>
        <path d="M130 34 L150 50" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="10" y="55" width="50" height="28" rx="6" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="35" y="73" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif">Risk</text>
        <path d="M60 69 L80 69 L130 50" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="140" y="36" width="50" height="28" rx="6" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
        <text x="165" y="54" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif">Execute</text>
      </svg>
    ),
  },
  {
    title: 'Historical Backtesting',
    description:
      'Replay your strategy against months of real market data before risking a single dollar. Get detailed P&L curves, Sharpe ratio, drawdown, and fill analytics.',
    gradientClass: 'from-pf-cyan-400/[0.04]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="20" y1="85" x2="180" y2="85" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="20" y1="60" x2="180" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <line x1="20" y1="35" x2="180" y2="35" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <polyline points="20,75 40,70 55,72 75,60 90,55 110,58 125,45 145,40 160,35 180,28" stroke="#22d3ee" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20,75 40,70 55,72 75,60 90,55 110,58 125,45 145,40 160,35 180,28 L180,85 L20,85Z" fill="url(#equityGrad)" opacity="0.3" />
        <defs>
          <linearGradient id="equityGrad" x1="100" y1="28" x2="100" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x="180" y="23" textAnchor="end" fill="#4ade80" fontSize="8" fontFamily="JetBrains Mono, monospace">+34.2%</text>
      </svg>
    ),
  },
  {
    title: 'Live 24/7 Execution',
    description:
      'Deploy strategies to our cloud runner. Polyforge monitors markets around the clock and places orders the instant your conditions are met \u2014 even while you sleep.',
    gradientClass: 'from-green-400/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="15" width="70" height="35" rx="6" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.2)" strokeWidth="1" />
        <text x="55" y="32" textAnchor="middle" fill="#5a5a72" fontSize="6" fontFamily="Inter, sans-serif">Status</text>
        <text x="55" y="44" textAnchor="middle" fill="#4ade80" fontSize="9" fontFamily="JetBrains Mono, monospace">LIVE</text>
        <circle cx="82" cy="44" r="3" fill="#4ade80">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <rect x="105" y="15" width="75" height="35" rx="6" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.2)" strokeWidth="1" />
        <text x="142" y="32" textAnchor="middle" fill="#5a5a72" fontSize="6" fontFamily="Inter, sans-serif">Uptime</text>
        <text x="142" y="44" textAnchor="middle" fill="#f0f0f5" fontSize="9" fontFamily="JetBrains Mono, monospace">99.97%</text>
        <rect x="20" y="60" width="160" height="28" rx="6" fill="rgba(6,182,212,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <text x="30" y="78" fill="#9898b0" fontSize="7" fontFamily="Inter, sans-serif">Last fill: YES/BTC-100K +0.04</text>
        <circle cx="170" cy="74" r="3" fill="#22d3ee">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    ),
  },
  {
    title: 'Real-Time Market Data',
    description:
      'Live order-book prices stream directly to your dashboard via WebSocket. Track YES/NO prices, 24-hour volume, and market sentiment at a glance.',
    gradientClass: 'from-pf-cyan-500/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 14l4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="20" y1="85" x2="180" y2="85" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="35" y1="25" x2="35" y2="70" stroke="#4ade80" strokeWidth="1" />
        <rect x="30" y="35" width="10" height="20" rx="1" fill="#4ade80" />
        <line x1="55" y1="30" x2="55" y2="75" stroke="#f87171" strokeWidth="1" />
        <rect x="50" y="38" width="10" height="25" rx="1" fill="#f87171" />
        <line x1="75" y1="20" x2="75" y2="65" stroke="#4ade80" strokeWidth="1" />
        <rect x="70" y="28" width="10" height="22" rx="1" fill="#4ade80" />
        <line x1="95" y1="25" x2="95" y2="60" stroke="#4ade80" strokeWidth="1" />
        <rect x="90" y="30" width="10" height="18" rx="1" fill="#4ade80" />
        <line x1="115" y1="28" x2="115" y2="68" stroke="#f87171" strokeWidth="1" />
        <rect x="110" y="32" width="10" height="28" rx="1" fill="#f87171" />
        <line x1="135" y1="22" x2="135" y2="55" stroke="#4ade80" strokeWidth="1" />
        <rect x="130" y="26" width="10" height="18" rx="1" fill="#4ade80" />
        <line x1="155" y1="18" x2="155" y2="50" stroke="#4ade80" strokeWidth="1" />
        <rect x="150" y="22" width="10" height="16" rx="1" fill="#4ade80" />
        <line x1="175" y1="15" x2="175" y2="48" stroke="#4ade80" strokeWidth="1" />
        <rect x="170" y="20" width="10" height="14" rx="1" fill="#4ade80" />
      </svg>
    ),
  },
  {
    title: 'Community Strategies',
    description:
      'Discover and fork top-performing public strategies from the community. Build on what works and share your own edge with the Polyforge leaderboard.',
    gradientClass: 'from-yellow-400/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="12" width="160" height="22" rx="4" fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.2)" strokeWidth="1" />
        <text x="30" y="27" fill="#fbbf24" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700">1</text>
        <circle cx="50" cy="23" r="7" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.3)" strokeWidth="0.5" />
        <text x="50" y="26" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">AK</text>
        <text x="66" y="27" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif">AlphaKing</text>
        <text x="170" y="27" textAnchor="end" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">+42.1%</text>
        <rect x="20" y="40" width="160" height="22" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <text x="30" y="55" fill="#9898b0" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700">2</text>
        <circle cx="50" cy="51" r="7" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.2)" strokeWidth="0.5" />
        <text x="50" y="54" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">MP</text>
        <text x="66" y="55" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif">MarketPro</text>
        <text x="170" y="55" textAnchor="end" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">+38.7%</text>
        <rect x="20" y="68" width="160" height="22" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <text x="30" y="83" fill="#9898b0" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700">3</text>
        <circle cx="50" cy="79" r="7" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.2)" strokeWidth="0.5" />
        <text x="50" y="82" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">QT</text>
        <text x="66" y="83" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif">QuantTrader</text>
        <text x="170" y="83" textAnchor="end" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">+31.4%</text>
      </svg>
    ),
  },
  {
    title: 'Security First',
    description:
      'JWT authentication with short-lived tokens, optional two-factor auth, and role-based access controls. Your account and API keys stay under your control.',
    gradientClass: 'from-indigo-500/[0.04]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M100 15 L140 30 L140 60 C140 78 100 90 100 90 C100 90 60 78 60 60 L60 30 Z" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.3)" strokeWidth="1.5" />
        <rect x="88" y="48" width="24" height="18" rx="3" fill="none" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" />
        <path d="M94 48 V42 C94 37 106 37 106 42 V48" fill="none" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" />
        <circle cx="100" cy="58" r="2" fill="#22d3ee" />
        <text x="100" y="30" textAnchor="middle" fill="#4ade80" fontSize="8" fontFamily="Inter, sans-serif">2FA</text>
      </svg>
    ),
  },
  {
    title: 'Developer API',
    description:
      'Generate scoped API keys to integrate with custom tools, AI agents, and trading bots. Full REST API with 50+ endpoints for markets, strategies, orders, and more.',
    gradientClass: 'from-purple-500/[0.04]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="12" width="160" height="76" rx="6" fill="rgba(6,182,212,0.04)" stroke="rgba(6,182,212,0.2)" strokeWidth="1" />
        <circle cx="32" cy="22" r="3" fill="rgba(239,68,68,0.5)" />
        <circle cx="42" cy="22" r="3" fill="rgba(245,158,11,0.5)" />
        <circle cx="52" cy="22" r="3" fill="rgba(34,197,94,0.5)" />
        <line x1="20" y1="30" x2="180" y2="30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <text x="30" y="45" fill="#22d3ee" fontSize="7" fontFamily="JetBrains Mono, monospace">$ curl -X GET /api/v1/</text>
        <text x="30" y="58" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">{'{ "strategies": [...] }'}</text>
        <text x="30" y="71" fill="#9898b0" fontSize="7" fontFamily="JetBrains Mono, monospace">{`200 OK  \u00b7  14ms`}</text>
        <text x="30" y="82" fill="#5a5a72" fontSize="7" fontFamily="JetBrains Mono, monospace">50+ endpoints</text>
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="py-24" id="features" aria-labelledby="features-heading">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center max-w-[600px] mx-auto mb-14">
          <h2
            id="features-heading"
            className="text-[clamp(24px,4vw,34px)] font-bold text-pf-text mb-3.5"
          >
            Everything you need to trade smarter
          </h2>
          <p className="text-[17px] text-pf-text-secondary">
            From idea to live strategy in minutes, not months.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`bg-pf-surface bg-gradient-to-br ${feature.gradientClass} to-pf-surface border border-pf-border-subtle rounded-pf-lg transition-all duration-250 hover:border-pf-cyan-500/30 hover:-translate-y-0.5 hover:shadow-pf-md`}
            >
              {/* Visual preview */}
              <div className="px-4 py-3 border-b border-pf-border-subtle bg-black/20 rounded-t-pf-lg overflow-hidden">
                <div className="w-full h-auto">{feature.visual}</div>
              </div>

              <div className="p-7">
                {/* Icon */}
                <div className="w-14 h-14 bg-pf-cyan-500/8 border border-pf-cyan-500/20 rounded-pf-md flex items-center justify-center text-pf-cyan-400 mb-5">
                  {feature.icon}
                </div>

                <h3 className="text-[17px] font-semibold text-pf-text mb-2.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-pf-text-secondary leading-7">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
