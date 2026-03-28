const features = [
  {
    title: 'Visual Strategy Builder',
    description:
      'Drag-and-drop canvas with 50+ blocks, logic gates, variables, and wiring. Build strategies like visual programs — no code required.',
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
        <rect x="5" y="10" width="42" height="24" rx="5" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="26" y="26" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif">IF Price</text>
        <rect x="5" y="44" width="42" height="24" rx="5" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="26" y="60" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif">IF Volume</text>
        <path d="M47 22 L62 38" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        <path d="M47 56 L62 42" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* AND gate */}
        <rect x="62" y="28" width="30" height="24" rx="5" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
        <text x="77" y="44" textAnchor="middle" fill="#fbbf24" fontSize="7" fontFamily="Inter, sans-serif">AND</text>
        <path d="M92 40 L108 40" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Variable */}
        <rect x="108" y="28" width="38" height="24" rx="5" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.3)" strokeWidth="1" />
        <text x="127" y="44" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="Inter, sans-serif">Size = 5%</text>
        <path d="M146 40 L158 40" stroke="rgba(74,222,128,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="158" y="28" width="36" height="24" rx="5" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
        <text x="176" y="44" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif">Execute</text>
        <text x="100" y="90" textAnchor="middle" fill="#5a5a72" fontSize="6" fontFamily="Inter, sans-serif">50+ blocks available</text>
      </svg>
    ),
  },
  {
    title: 'Paper Trading & Backtesting',
    description:
      'Test against historical data, simulate with real-time prices. Prove your edge before risking capital with detailed P&L curves, Sharpe ratio, and drawdown analytics.',
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
        <rect x="20" y="10" width="50" height="14" rx="3" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.3)" strokeWidth="0.5" />
        <text x="45" y="20" textAnchor="middle" fill="#fbbf24" fontSize="6" fontFamily="Inter, sans-serif">Paper Mode</text>
      </svg>
    ),
  },
  {
    title: 'Copy Trading',
    description:
      'Mirror whale traders automatically with three modes: percentage, fixed size, or full mirror. Built-in risk controls keep you in charge.',
    gradientClass: 'from-pf-success/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Whale wallet */}
        <rect x="15" y="20" width="60" height="30" rx="6" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
        <text x="45" y="33" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">Whale</text>
        <text x="45" y="44" textAnchor="middle" fill="#9898b0" fontSize="6" fontFamily="JetBrains Mono, monospace">0x8f..3a</text>
        {/* Arrow */}
        <path d="M75 35 L95 35" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5" />
        <polygon points="95,32 100,35 95,38" fill="rgba(74,222,128,0.5)" />
        {/* Your copy */}
        <rect x="105" y="20" width="60" height="30" rx="6" fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
        <text x="135" y="33" textAnchor="middle" fill="#67e8f9" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">You</text>
        <text x="135" y="44" textAnchor="middle" fill="#9898b0" fontSize="6" fontFamily="JetBrains Mono, monospace">Mirrored</text>
        {/* Modes */}
        <rect x="15" y="62" width="45" height="18" rx="4" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.15)" strokeWidth="0.5" />
        <text x="37" y="74" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">% Mode</text>
        <rect x="67" y="62" width="45" height="18" rx="4" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.15)" strokeWidth="0.5" />
        <text x="89" y="74" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">Fixed</text>
        <rect x="119" y="62" width="45" height="18" rx="4" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.15)" strokeWidth="0.5" />
        <text x="141" y="74" textAnchor="middle" fill="#67e8f9" fontSize="6" fontFamily="Inter, sans-serif">Mirror</text>
      </svg>
    ),
  },
  {
    title: 'AI-Powered Signals',
    description:
      'LLM-powered news pipeline analyzes breaking events, matches them to markets, and generates trade signals. AI finds the trades. You decide.',
    gradientClass: 'from-pf-purple-500/[0.04]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2.1-1.2 2.8L12 11l-2.8-2.2A4 4 0 0 1 12 2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 22h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* News feed */}
        <rect x="10" y="10" width="75" height="20" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="18" y="24" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">Breaking: Fed holds...</text>
        <rect x="10" y="34" width="75" height="20" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="18" y="48" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">Trump announces...</text>
        {/* Arrow to AI */}
        <path d="M85 35 L100 35" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* AI brain */}
        <rect x="100" y="18" width="45" height="34" rx="8" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.3)" strokeWidth="1" />
        <text x="122" y="33" textAnchor="middle" fill="#c084fc" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600">AI</text>
        <text x="122" y="44" textAnchor="middle" fill="#9898b0" fontSize="5" fontFamily="Inter, sans-serif">Claude + GPT</text>
        {/* Arrow to signal */}
        <path d="M145 35 L160 35" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Signal output */}
        <rect x="160" y="18" width="32" height="34" rx="6" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
        <text x="176" y="33" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">BUY</text>
        <text x="176" y="44" textAnchor="middle" fill="#9898b0" fontSize="5" fontFamily="Inter, sans-serif">Signal</text>
        {/* Confidence bar */}
        <rect x="10" y="68" width="182" height="20" rx="4" fill="rgba(74,222,128,0.04)" stroke="rgba(74,222,128,0.15)" strokeWidth="0.5" />
        <text x="18" y="82" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">Confidence: 87%</text>
        <text x="130" y="82" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">Market: US Election</text>
      </svg>
    ),
  },
  {
    title: 'Advanced Orders',
    description:
      'Take-profit, stop-loss, trailing stops, limit orders, and pegged orders. Set it and forget it — your positions are always protected.',
    gradientClass: 'from-pf-cyan-500/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 14l4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Price line */}
        <polyline points="15,60 40,55 60,58 80,48 100,50 120,42 140,45 160,38 185,35" stroke="#22d3ee" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* TP line */}
        <line x1="15" y1="25" x2="185" y2="25" stroke="rgba(74,222,128,0.4)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="187" y="28" fill="#4ade80" fontSize="6" fontFamily="JetBrains Mono, monospace">TP 0.85</text>
        {/* SL line */}
        <line x1="15" y1="75" x2="185" y2="75" stroke="rgba(248,113,113,0.4)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="187" y="78" fill="#f87171" fontSize="6" fontFamily="JetBrains Mono, monospace">SL 0.55</text>
        {/* Trailing stop */}
        <polyline points="80,58 100,60 120,52 140,55 160,48 185,45" stroke="rgba(251,191,36,0.4)" strokeWidth="1" strokeDasharray="3 2" fill="none" />
        <text x="187" y="48" fill="#fbbf24" fontSize="6" fontFamily="JetBrains Mono, monospace">Trail</text>
        {/* Labels */}
        <rect x="15" y="84" width="36" height="12" rx="3" fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.2)" strokeWidth="0.5" />
        <text x="33" y="93" textAnchor="middle" fill="#4ade80" fontSize="5.5" fontFamily="Inter, sans-serif">TP/SL</text>
        <rect x="56" y="84" width="36" height="12" rx="3" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.2)" strokeWidth="0.5" />
        <text x="74" y="93" textAnchor="middle" fill="#fbbf24" fontSize="5.5" fontFamily="Inter, sans-serif">Trailing</text>
        <rect x="97" y="84" width="36" height="12" rx="3" fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.2)" strokeWidth="0.5" />
        <text x="115" y="93" textAnchor="middle" fill="#67e8f9" fontSize="5.5" fontFamily="Inter, sans-serif">Limit</text>
        <rect x="138" y="84" width="36" height="12" rx="3" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.2)" strokeWidth="0.5" />
        <text x="156" y="93" textAnchor="middle" fill="#c084fc" fontSize="5.5" fontFamily="Inter, sans-serif">Pegged</text>
      </svg>
    ),
  },
  {
    title: 'Whale Tracking',
    description:
      'Real-time alerts when large trades happen. Follow wallets, analyze whale profiles, and see what the smart money is buying before the crowd.',
    gradientClass: 'from-pf-gold-400/[0.03]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Whale alert row 1 */}
        <rect x="10" y="8" width="180" height="26" rx="5" fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.2)" strokeWidth="1" />
        <circle cx="24" cy="21" r="6" fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.3)" strokeWidth="0.5" />
        <text x="24" y="24" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="700">W</text>
        <text x="38" y="18" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">0x8f..3a bought</text>
        <text x="38" y="28" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">$52K YES</text>
        <text x="182" y="24" textAnchor="end" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">2m ago</text>
        {/* Whale alert row 2 */}
        <rect x="10" y="40" width="180" height="26" rx="5" fill="rgba(248,113,113,0.06)" stroke="rgba(248,113,113,0.2)" strokeWidth="1" />
        <circle cx="24" cy="53" r="6" fill="rgba(248,113,113,0.15)" stroke="rgba(248,113,113,0.3)" strokeWidth="0.5" />
        <text x="24" y="56" textAnchor="middle" fill="#f87171" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="700">W</text>
        <text x="38" y="50" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">0xd4..b7 sold</text>
        <text x="38" y="60" fill="#f87171" fontSize="7" fontFamily="JetBrains Mono, monospace">$31K NO</text>
        <text x="182" y="56" textAnchor="end" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">5m ago</text>
        {/* Whale alert row 3 */}
        <rect x="10" y="72" width="180" height="26" rx="5" fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.2)" strokeWidth="1" />
        <circle cx="24" cy="85" r="6" fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.3)" strokeWidth="0.5" />
        <text x="24" y="88" textAnchor="middle" fill="#4ade80" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="700">W</text>
        <text x="38" y="82" fill="#f0f0f5" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="600">0xa1..9c bought</text>
        <text x="38" y="92" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">$88K YES</text>
        <text x="182" y="88" textAnchor="end" fill="#9898b0" fontSize="6" fontFamily="Inter, sans-serif">8m ago</text>
      </svg>
    ),
  },
  {
    title: 'Developer API',
    description:
      'Scoped API keys with READ, WRITE, and TRADE permissions for external tools, AI agents, and custom bots. Build on top of Polyforge.',
    gradientClass: 'from-pf-purple-400/[0.04]',
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
        <text x="30" y="45" fill="#22d3ee" fontSize="7" fontFamily="JetBrains Mono, monospace">$ curl -H &quot;X-API-Key:&quot;</text>
        <text x="30" y="58" fill="#4ade80" fontSize="7" fontFamily="JetBrains Mono, monospace">{'{ "scopes": ["TRADE"] }'}</text>
        <text x="30" y="71" fill="#9898b0" fontSize="7" fontFamily="JetBrains Mono, monospace">{`200 OK  \u00b7  14ms`}</text>
        <text x="30" y="82" fill="#5a5a72" fontSize="7" fontFamily="JetBrains Mono, monospace">READ / WRITE / TRADE</text>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`bg-pf-surface bg-gradient-to-br ${feature.gradientClass} to-pf-surface border border-pf-border-subtle rounded-pf-lg transition-all duration-250 hover:border-pf-cyan-500/30 hover:-translate-y-0.5 hover:shadow-pf-md`}
            >
              {/* Visual preview */}
              <div className="px-4 py-3 border-b border-pf-border-subtle bg-black/20 rounded-t-pf-lg overflow-hidden">
                <div className="w-full h-auto">{feature.visual}</div>
              </div>

              <div className="p-5 sm:p-7">
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
