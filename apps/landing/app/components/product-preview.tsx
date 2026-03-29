export function ProductPreview() {
  return (
    <section className="pt-8 -mt-2 overflow-hidden" aria-label="Product dashboard preview">
      <div className="max-w-[1100px] mx-auto px-6">
        <div
          className="dark bg-pf-surface border border-pf-border-subtle rounded-pf-lg overflow-hidden transition-transform duration-400"
          style={{
            boxShadow: 'var(--shadow-pf-lg, 0 40px 100px rgba(0,0,0,0.6)), 0 0 0 1px rgba(6,182,212,0.05)',
            transform: 'perspective(1200px) rotateX(2deg)',
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-pf-border-subtle bg-pf-elevated" aria-hidden="true">
            <span className="w-[11px] h-[11px] rounded-full bg-red-500" />
            <span className="w-[11px] h-[11px] rounded-full bg-amber-400" />
            <span className="w-[11px] h-[11px] rounded-full bg-emerald-500" />
            <span className="flex-1 text-center text-[11px] font-mono text-pf-text-muted bg-white/4 rounded px-3 py-1 ml-2">
              app.polyforge.app/dashboard
            </span>
          </div>

          {/* Dashboard SVG */}
          <div className="overflow-hidden">
            <svg
              viewBox="0 0 900 440"
              width="100%"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="block w-full h-auto"
              role="img"
              aria-label="Polyforge dashboard showing portfolio P&amp;L, active strategies, market data, and recent trades"
            >
              {/* Sidebar */}
              <rect x="0" y="0" width="180" height="440" fill="#12121a" />
              <rect x="0" y="0" width="180" height="440" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x="24" y="32" fill="#67e8f9" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="700">Polyforge</text>
              <rect x="12" y="56" width="156" height="32" rx="6" fill="rgba(6,182,212,0.1)" />
              <text x="44" y="76" fill="#22d3ee" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">Dashboard</text>
              <circle cx="28" cy="72" r="4" fill="rgba(6,182,212,0.5)" />
              <text x="44" y="112" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Markets</text>
              <circle cx="28" cy="108" r="3" fill="rgba(255,255,255,0.1)" />
              <text x="44" y="144" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Strategies</text>
              <circle cx="28" cy="140" r="3" fill="rgba(255,255,255,0.1)" />
              <text x="44" y="176" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Whale Tracker</text>
              <circle cx="28" cy="172" r="3" fill="rgba(74,222,128,0.4)" />
              <text x="44" y="208" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Copy Trading</text>
              <circle cx="28" cy="204" r="3" fill="rgba(74,222,128,0.4)" />
              <text x="44" y="240" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">AI Signals</text>
              <circle cx="28" cy="236" r="3" fill="rgba(168,85,247,0.4)" />
              <text x="44" y="272" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Orders</text>
              <circle cx="28" cy="268" r="3" fill="rgba(255,255,255,0.1)" />
              <text x="44" y="304" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">Portfolio</text>
              <circle cx="28" cy="300" r="3" fill="rgba(255,255,255,0.1)" />
              <text x="44" y="336" fill="#5a5a72" fontSize="11" fontFamily="Inter, sans-serif">API Keys</text>
              <circle cx="28" cy="332" r="3" fill="rgba(255,255,255,0.1)" />

              {/* Main content area */}
              <rect x="180" y="0" width="720" height="440" fill="#0a0a0f" />
              <text x="204" y="32" fill="#f0f0f5" fontSize="14" fontFamily="Inter, sans-serif" fontWeight="600">Portfolio Overview</text>
              <rect x="760" y="14" width="80" height="28" rx="6" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
              <text x="800" y="33" textAnchor="middle" fill="#22d3ee" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="500">Deploy</text>

              {/* P&L card */}
              <rect x="204" y="52" width="220" height="100" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="224" y="76" fill="#5a5a72" fontSize="10" fontFamily="Inter, sans-serif">{'Total P&L'}</text>
              <text x="224" y="102" fill="#4ade80" fontSize="22" fontFamily="JetBrains Mono, monospace" fontWeight="700">+$2,847</text>
              <text x="224" y="122" fill="#4ade80" fontSize="10" fontFamily="JetBrains Mono, monospace">+18.3% all time</text>
              <polyline points="330,105 345,98 360,100 375,88 390,82 405,78" stroke="#4ade80" strokeWidth="1.5" fill="none" />

              {/* Win Rate card */}
              <rect x="440" y="52" width="220" height="100" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="460" y="76" fill="#5a5a72" fontSize="10" fontFamily="Inter, sans-serif">Win Rate</text>
              <text x="460" y="102" fill="#f0f0f5" fontSize="22" fontFamily="JetBrains Mono, monospace" fontWeight="700">67.2%</text>
              <text x="460" y="122" fill="#9898b0" fontSize="10" fontFamily="JetBrains Mono, monospace">142 / 212 trades</text>

              {/* Active Strategies card */}
              <rect x="676" y="52" width="148" height="100" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="696" y="76" fill="#5a5a72" fontSize="10" fontFamily="Inter, sans-serif">Active</text>
              <text x="696" y="102" fill="#f0f0f5" fontSize="22" fontFamily="JetBrains Mono, monospace" fontWeight="700">3</text>
              <text x="696" y="122" fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono, monospace">strategies live</text>

              {/* Strategy card 1 */}
              <rect x="204" y="172" width="340" height="80" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx="224" cy="198" r="5" fill="#4ade80">
                <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x="238" y="201" fill="#f0f0f5" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600">Momentum Alpha v3</text>
              <text x="460" y="201" fill="#4ade80" fontSize="11" fontFamily="JetBrains Mono, monospace" textAnchor="end">+$412</text>
              <text x="238" y="222" fill="#5a5a72" fontSize="9" fontFamily="Inter, sans-serif">{'Polymarket  \u00b7  12 active positions  \u00b7  Sharpe 1.84'}</text>
              <polyline points="224,242 260,238 296,234 332,240 368,230 404,225 440,222 476,218 512,214" stroke="rgba(6,182,212,0.5)" strokeWidth="1.2" fill="none" />

              {/* Strategy card 2 */}
              <rect x="204" y="268" width="340" height="80" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx="224" cy="294" r="5" fill="#4ade80">
                <animate attributeName="opacity" values="1;0.4;1" dur="2.3s" repeatCount="indefinite" />
              </circle>
              <text x="238" y="297" fill="#f0f0f5" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600">Mean Reversion v1</text>
              <text x="460" y="297" fill="#4ade80" fontSize="11" fontFamily="JetBrains Mono, monospace" textAnchor="end">+$189</text>
              <text x="238" y="318" fill="#5a5a72" fontSize="9" fontFamily="Inter, sans-serif">{'Polymarket  \u00b7  6 active positions  \u00b7  Sharpe 1.42'}</text>
              <polyline points="224,338 260,340 296,336 332,330 368,335 404,328 440,324 476,320 512,316" stroke="rgba(6,182,212,0.5)" strokeWidth="1.2" fill="none" />

              {/* Market cards */}
              <rect x="560" y="172" width="264" height="70" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="580" y="196" fill="#f0f0f5" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">US Election 2028</text>
              <text x="580" y="214" fill="#5a5a72" fontSize="9" fontFamily="Inter, sans-serif">{'YES 0.42  \u00b7  NO 0.58'}</text>
              <text x="780" y="196" fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="end">$1.2M vol</text>
              <rect x="580" y="226" width="100" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
              <rect x="580" y="226" width="42" height="4" rx="2" fill="rgba(6,182,212,0.5)" />

              <rect x="560" y="256" width="264" height="70" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="580" y="280" fill="#f0f0f5" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">{'BTC > $150k by Dec'}</text>
              <text x="580" y="298" fill="#5a5a72" fontSize="9" fontFamily="Inter, sans-serif">{'YES 0.31  \u00b7  NO 0.69'}</text>
              <text x="780" y="280" fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="end">$840K vol</text>
              <rect x="580" y="310" width="100" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
              <rect x="580" y="310" width="31" height="4" rx="2" fill="rgba(6,182,212,0.5)" />

              <rect x="560" y="340" width="264" height="70" rx="10" fill="#12121a" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="580" y="364" fill="#f0f0f5" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">Fed Rate Cut Jul</text>
              <text x="580" y="382" fill="#5a5a72" fontSize="9" fontFamily="Inter, sans-serif">{'YES 0.73  \u00b7  NO 0.27'}</text>
              <text x="780" y="364" fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="end">$620K vol</text>
              <rect x="580" y="394" width="100" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
              <rect x="580" y="394" width="73" height="4" rx="2" fill="rgba(6,182,212,0.5)" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
