export function Hero() {
  return (
    <section
      className="pt-20 sm:pt-28 pb-16 sm:pb-24 border-b border-subtle"
      aria-labelledby="hero-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_55%] items-center gap-12 lg:gap-16">
          {/* Text column */}
          <div className="flex flex-col items-start">
            <div className="inline-flex items-center gap-2 text-body-sm font-medium text-accent-text bg-accent/8 border border-accent/20 rounded-sm px-4 py-1 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Now in early access
            </div>

            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight text-primary mb-5"
            >
              The trading terminal for prediction markets.
            </h1>

            <p className="text-[15px] text-secondary leading-relaxed max-w-[480px] mb-9">
              Build automated strategies, track whale activity, and backtest
              your edge on Polymarket — without writing a single line of code.
            </p>

            <div className="flex items-center gap-4">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-accent hover:bg-accent-text text-inverse font-semibold text-body-md transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
              >
                Start free →
              </a>
              <a
                href="/api-docs"
                className="text-body-md text-secondary hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
              >
                Read the docs
              </a>
            </div>
          </div>

          {/* Dashboard screenshot column */}
          <div
            className="bg-surface border border-subtle rounded-xl overflow-hidden ring-1 ring-inset ring-white/[0.06]"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15)" }}
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-subtle bg-elevated">
              <span className="w-3 h-3 rounded-full bg-loss" />
              <span className="w-3 h-3 rounded-full bg-warning" />
              <span className="w-3 h-3 rounded-full bg-gain" />
              <span className="flex-1 text-center text-label font-mono text-tertiary bg-primary/4 rounded-sm px-3 py-1 ml-2">
                app.polyforge.app/dashboard
              </span>
            </div>

            <svg
              viewBox="0 0 900 440"
              width="100%"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="block w-full h-auto"
              role="img"
              aria-label="Polyforge dashboard showing portfolio P&L, active strategies, market data, and recent trades"
            >
              <style>{`@media(prefers-reduced-motion:reduce){animate{display:none}}`}</style>
              <rect x="0" y="0" width="180" height="440" fill="var(--bg-app)" />
              <rect x="0" y="0" width="180" height="440" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
              <text x="24" y="32" fill="var(--color-cyan-300)" fontSize="13" fontWeight="600" fontFamily="Geist, sans-serif">Polyforge</text>
              <rect x="12" y="56" width="156" height="32" rx="6" fill="var(--accent-default)" fillOpacity="0.1" />
              <text x="44" y="76" fill="var(--accent-text)" fontSize="11" fontWeight="500">Dashboard</text>
              <circle cx="28" cy="72" r="4" fill="var(--accent-default)" fillOpacity="0.5" />
              <text x="44" y="112" fill="var(--text-tertiary)" fontSize="11">Markets</text>
              <circle cx="28" cy="108" r="3" fill="var(--text-primary)" fillOpacity="0.1" />
              <text x="44" y="144" fill="var(--text-tertiary)" fontSize="11">Strategies</text>
              <circle cx="28" cy="140" r="3" fill="var(--text-primary)" fillOpacity="0.1" />
              <text x="44" y="176" fill="var(--text-tertiary)" fontSize="11">Whale Tracker</text>
              <circle cx="28" cy="172" r="3" fill="var(--gain)" fillOpacity="0.4" />
              <text x="44" y="208" fill="var(--text-tertiary)" fontSize="11">Copy Trading</text>
              <circle cx="28" cy="204" r="3" fill="var(--gain)" fillOpacity="0.4" />
              <text x="44" y="240" fill="var(--text-tertiary)" fontSize="11">AI Signals</text>
              <circle cx="28" cy="236" r="3" fill="var(--color-purple-400)" fillOpacity="0.4" />
              <text x="44" y="272" fill="var(--text-tertiary)" fontSize="11">Orders</text>
              <circle cx="28" cy="268" r="3" fill="var(--text-primary)" fillOpacity="0.1" />
              <text x="44" y="304" fill="var(--text-tertiary)" fontSize="11">Portfolio</text>
              <circle cx="28" cy="300" r="3" fill="var(--text-primary)" fillOpacity="0.1" />
              <text x="44" y="336" fill="var(--text-tertiary)" fontSize="11">API Keys</text>
              <circle cx="28" cy="332" r="3" fill="var(--text-primary)" fillOpacity="0.1" />
              <rect x="180" y="0" width="720" height="440" fill="var(--bg-app)" />
              <text x="204" y="32" fill="var(--text-primary)" fontSize="14" fontWeight="600">Portfolio Overview</text>
              <rect x="760" y="14" width="80" height="28" rx="6" fill="var(--accent-default)" fillOpacity="0.15" stroke="var(--accent-default)" strokeOpacity="0.3" strokeWidth="1" />
              <text x="800" y="33" textAnchor="middle" fill="var(--accent-text)" fontSize="10" fontWeight="500">Deploy</text>
              <rect x="204" y="52" width="220" height="100" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="224" y="76" fill="var(--text-tertiary)" fontSize="10">Total P&amp;L</text>
              <text x="224" y="102" fill="var(--gain)" fontSize="22" fontWeight="600" fontFamily="Geist, sans-serif">+$2,847</text>
              <text x="224" y="122" fill="var(--gain)" fontSize="10">+18.3% all time</text>
              <polyline points="330,105 345,98 360,100 375,88 390,82 405,78" stroke="var(--gain)" strokeWidth="1.5" fill="none" />
              <rect x="440" y="52" width="220" height="100" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="460" y="76" fill="var(--text-tertiary)" fontSize="10">Win Rate</text>
              <text x="460" y="102" fill="var(--text-primary)" fontSize="22" fontWeight="600" fontFamily="Geist, sans-serif">67.2%</text>
              <text x="460" y="122" fill="var(--text-tertiary)" fontSize="10">142 / 212 trades</text>
              <rect x="676" y="52" width="148" height="100" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="696" y="76" fill="var(--text-tertiary)" fontSize="10">Active</text>
              <text x="696" y="102" fill="var(--text-primary)" fontSize="22" fontWeight="600" fontFamily="Geist, sans-serif">3</text>
              <text x="696" y="122" fill="var(--accent-text)" fontSize="10">strategies live</text>
              <rect x="204" y="172" width="340" height="80" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <circle cx="224" cy="198" r="5" fill="var(--gain)">
                <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x="238" y="201" fill="var(--text-primary)" fontSize="12" fontWeight="600">Momentum Alpha v3</text>
              <text x="460" y="201" fill="var(--gain)" fontSize="11" textAnchor="end">+$412</text>
              <text x="238" y="222" fill="var(--text-tertiary)" fontSize="9">Polymarket · 12 active positions · Sharpe 1.84</text>
              <polyline points="224,242 260,238 296,234 332,240 368,230 404,225 440,222 476,218 512,214" stroke="var(--accent-default)" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
              <rect x="204" y="268" width="340" height="80" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <circle cx="224" cy="294" r="5" fill="var(--gain)">
                <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x="238" y="297" fill="var(--text-primary)" fontSize="12" fontWeight="600">Mean Reversion v1</text>
              <text x="460" y="297" fill="var(--gain)" fontSize="11" textAnchor="end">+$189</text>
              <text x="238" y="318" fill="var(--text-tertiary)" fontSize="9">Polymarket · 6 active positions · Sharpe 1.42</text>
              <polyline points="224,338 260,340 296,336 332,330 368,335 404,328 440,324 476,320 512,316" stroke="var(--accent-default)" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
              <rect x="560" y="172" width="264" height="70" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="580" y="196" fill="var(--text-primary)" fontSize="11" fontWeight="500">US Election 2028</text>
              <text x="580" y="214" fill="var(--text-tertiary)" fontSize="9">YES 0.42 · NO 0.58</text>
              <text x="780" y="196" fill="var(--accent-text)" fontSize="10" textAnchor="end">$1.2M vol</text>
              <rect x="580" y="226" width="100" height="4" rx="2" fill="var(--text-primary)" fillOpacity="0.06" />
              <rect x="580" y="226" width="42" height="4" rx="2" fill="var(--accent-default)" fillOpacity="0.5" />
              <rect x="560" y="256" width="264" height="70" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="580" y="280" fill="var(--text-primary)" fontSize="11" fontWeight="500">BTC &gt; $150k by Dec</text>
              <text x="580" y="298" fill="var(--text-tertiary)" fontSize="9">YES 0.31 · NO 0.69</text>
              <text x="780" y="280" fill="var(--accent-text)" fontSize="10" textAnchor="end">$840K vol</text>
              <rect x="580" y="310" width="100" height="4" rx="2" fill="var(--text-primary)" fillOpacity="0.06" />
              <rect x="580" y="310" width="31" height="4" rx="2" fill="var(--accent-default)" fillOpacity="0.5" />
              <rect x="560" y="340" width="264" height="70" rx="10" fill="var(--bg-app)" stroke="var(--text-primary)" strokeOpacity="0.08" strokeWidth="1" />
              <text x="580" y="364" fill="var(--text-primary)" fontSize="11" fontWeight="500">Fed Rate Cut Jul</text>
              <text x="580" y="382" fill="var(--text-tertiary)" fontSize="9">YES 0.73 · NO 0.27</text>
              <text x="780" y="364" fill="var(--accent-text)" fontSize="10" textAnchor="end">$620K vol</text>
              <rect x="580" y="394" width="100" height="4" rx="2" fill="var(--text-primary)" fillOpacity="0.06" />
              <rect x="580" y="394" width="73" height="4" rx="2" fill="var(--accent-default)" fillOpacity="0.5" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
