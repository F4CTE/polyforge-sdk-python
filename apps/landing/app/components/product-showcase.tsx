import { Check } from "lucide-react";

type ProductSectionProps = {
  side: "left" | "right";
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
};

function ProductSection({ side, eyebrow, headline, body, bullets, visual }: ProductSectionProps) {
  const textFirst = side === "left";
  return (
    <div className="py-20 sm:py-28 border-t border-subtle">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20">
          <div className={textFirst ? "order-first" : "order-last lg:order-first"}>
            <p className="text-label font-medium text-accent-text uppercase tracking-wider mb-4">
              {eyebrow}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4">
              {headline}
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[520px] mb-6">
              {body}
            </p>
            <ul className="flex flex-col gap-2.5">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2.5 text-sm text-secondary">
                  <Check size={14} className="text-accent-text shrink-0" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div
            className={`bg-surface border border-subtle rounded-xl overflow-hidden p-4 sm:p-6 ${textFirst ? "order-last" : "order-first lg:order-last"}`}
            aria-hidden="true"
          >
            {visual}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyBuilderVisual() {
  return (
    <svg
      viewBox="0 0 560 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <style>{`@media(prefers-reduced-motion:reduce){animate{display:none}}`}</style>
      <path d="M140 80 L240 80" stroke="var(--accent-default)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 4">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M340 80 L420 130" stroke="var(--accent-default)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 4">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M140 200 L240 200" stroke="var(--accent-default)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 4">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M340 200 L420 170" stroke="var(--accent-default)" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 4">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <rect x="20" y="50" width="120" height="60" rx="10" fill="var(--accent-default)" fillOpacity="0.08" stroke="var(--accent-default)" strokeOpacity="0.35" strokeWidth="1.5" />
      <text x="80" y="73" textAnchor="middle" fill="var(--color-cyan-300)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">ENTRY SIGNAL</text>
      <text x="80" y="93" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)">Price &gt; 0.65</text>
      <rect x="20" y="170" width="120" height="60" rx="10" fill="var(--accent-default)" fillOpacity="0.08" stroke="var(--accent-default)" strokeOpacity="0.35" strokeWidth="1.5" />
      <text x="80" y="193" textAnchor="middle" fill="var(--color-cyan-300)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">VOLUME CHECK</text>
      <text x="80" y="213" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)">Vol &gt; 10k / 24h</text>
      <rect x="240" y="50" width="120" height="60" rx="10" fill="var(--accent-text)" fillOpacity="0.06" stroke="var(--accent-text)" strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="300" y="73" textAnchor="middle" fill="var(--color-cyan-300)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">RISK MANAGER</text>
      <text x="300" y="93" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)">Max 5% per trade</text>
      <rect x="240" y="170" width="120" height="60" rx="10" fill="var(--accent-text)" fillOpacity="0.06" stroke="var(--accent-text)" strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="300" y="193" textAnchor="middle" fill="var(--color-cyan-300)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">POSITION SIZE</text>
      <text x="300" y="213" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)">Kelly criterion</text>
      <rect x="420" y="120" width="120" height="60" rx="10" fill="var(--gain)" fillOpacity="0.06" stroke="var(--gain)" strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="480" y="143" textAnchor="middle" fill="var(--gain)" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">EXECUTE</text>
      <text x="480" y="163" textAnchor="middle" fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)">Buy YES @ market</text>
      <circle cx="530" cy="128" r="4" fill="var(--gain)">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function WhaleIntelligenceVisual() {
  return (
    <svg
      viewBox="0 0 400 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <rect x="0" y="0" width="400" height="28" fill="var(--text-primary)" fillOpacity="0.03" />
      <text x="16" y="18" fill="var(--text-tertiary)" fontSize="9" fontWeight="500">WALLET</text>
      <text x="160" y="18" fill="var(--text-tertiary)" fontSize="9" fontWeight="500">TRADE</text>
      <text x="260" y="18" fill="var(--text-tertiary)" fontSize="9" fontWeight="500">SIZE</text>
      <text x="340" y="18" fill="var(--text-tertiary)" fontSize="9" fontWeight="500">TIME</text>
      <line x1="0" y1="28" x2="400" y2="28" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
      <rect x="0" y="28" width="400" height="48" fill="var(--gain)" fillOpacity="0.04" />
      <circle cx="16" cy="52" r="8" fill="var(--gain)" fillOpacity="0.15" stroke="var(--gain)" strokeOpacity="0.3" strokeWidth="0.5" />
      <text x="16" y="56" textAnchor="middle" fill="var(--gain)" fontSize="8" fontWeight="600">W</text>
      <text x="32" y="48" fill="var(--text-primary)" fontSize="9" fontWeight="500">0x8f..3a</text>
      <text x="32" y="62" fill="var(--text-tertiary)" fontSize="8">US Election 2028</text>
      <text x="160" y="55" fill="var(--gain)" fontSize="9" fontWeight="500">Bought YES</text>
      <text x="260" y="55" fill="var(--text-primary)" fontSize="9" fontFamily="var(--font-mono)">$52,000</text>
      <text x="340" y="55" fill="var(--text-tertiary)" fontSize="8">2m ago</text>
      <line x1="0" y1="76" x2="400" y2="76" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
      <rect x="0" y="76" width="400" height="48" fill="var(--loss)" fillOpacity="0.03" />
      <circle cx="16" cy="100" r="8" fill="var(--loss)" fillOpacity="0.15" stroke="var(--loss)" strokeOpacity="0.3" strokeWidth="0.5" />
      <text x="16" y="104" textAnchor="middle" fill="var(--loss)" fontSize="8" fontWeight="600">W</text>
      <text x="32" y="96" fill="var(--text-primary)" fontSize="9" fontWeight="500">0xd4..b7</text>
      <text x="32" y="110" fill="var(--text-tertiary)" fontSize="8">BTC &gt; $150k Dec</text>
      <text x="160" y="103" fill="var(--loss)" fontSize="9" fontWeight="500">Sold NO</text>
      <text x="260" y="103" fill="var(--text-primary)" fontSize="9" fontFamily="var(--font-mono)">$31,000</text>
      <text x="340" y="103" fill="var(--text-tertiary)" fontSize="8">5m ago</text>
      <line x1="0" y1="124" x2="400" y2="124" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
      <rect x="0" y="124" width="400" height="48" fill="var(--gain)" fillOpacity="0.04" />
      <circle cx="16" cy="148" r="8" fill="var(--gain)" fillOpacity="0.15" stroke="var(--gain)" strokeOpacity="0.3" strokeWidth="0.5" />
      <text x="16" y="152" textAnchor="middle" fill="var(--gain)" fontSize="8" fontWeight="600">W</text>
      <text x="32" y="144" fill="var(--text-primary)" fontSize="9" fontWeight="500">0xa1..9c</text>
      <text x="32" y="158" fill="var(--text-tertiary)" fontSize="8">Fed Rate Cut Jul</text>
      <text x="160" y="151" fill="var(--gain)" fontSize="9" fontWeight="500">Bought YES</text>
      <text x="260" y="151" fill="var(--text-primary)" fontSize="9" fontFamily="var(--font-mono)">$88,000</text>
      <text x="340" y="151" fill="var(--text-tertiary)" fontSize="8">8m ago</text>
      <line x1="0" y1="172" x2="400" y2="172" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
      <rect x="0" y="180" width="400" height="40" fill="var(--text-primary)" fillOpacity="0.02" />
      <text x="16" y="196" fill="var(--text-tertiary)" fontSize="8">Copy mode:</text>
      <rect x="80" y="184" width="60" height="20" rx="4" fill="var(--accent-default)" fillOpacity="0.08" stroke="var(--accent-default)" strokeOpacity="0.2" strokeWidth="0.5" />
      <text x="110" y="197" textAnchor="middle" fill="var(--color-cyan-300)" fontSize="8">% Mode</text>
      <rect x="148" y="184" width="55" height="20" rx="4" fill="var(--accent-default)" fillOpacity="0.06" stroke="var(--accent-default)" strokeOpacity="0.12" strokeWidth="0.5" />
      <text x="175" y="197" textAnchor="middle" fill="var(--text-tertiary)" fontSize="8">Fixed</text>
      <rect x="211" y="184" width="55" height="20" rx="4" fill="var(--accent-default)" fillOpacity="0.06" stroke="var(--accent-default)" strokeOpacity="0.12" strokeWidth="0.5" />
      <text x="238" y="197" textAnchor="middle" fill="var(--text-tertiary)" fontSize="8">Mirror</text>
    </svg>
  );
}

function BacktestVisual() {
  return (
    <svg
      viewBox="0 0 400 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient id="equityGradProd" x1="200" y1="30" x2="200" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-text)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent-text)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="40" y1="160" x2="380" y2="160" stroke="var(--text-primary)" strokeOpacity="0.06" strokeWidth="1" />
      <line x1="40" y1="120" x2="380" y2="120" stroke="var(--text-primary)" strokeOpacity="0.04" strokeWidth="1" />
      <line x1="40" y1="80" x2="380" y2="80" stroke="var(--text-primary)" strokeOpacity="0.04" strokeWidth="1" />
      <line x1="40" y1="40" x2="380" y2="40" stroke="var(--text-primary)" strokeOpacity="0.04" strokeWidth="1" />
      <polyline
        points="40,145 80,138 120,141 160,122 200,110 240,115 280,92 320,80 360,65 380,52"
        stroke="var(--accent-text)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40,145 80,138 120,141 160,122 200,110 240,115 280,92 320,80 360,65 380,52 L380,160 L40,160Z"
        fill="url(#equityGradProd)"
        opacity="0.4"
      />
      <rect x="320" y="30" width="56" height="20" rx="4" fill="var(--gain)" fillOpacity="0.1" stroke="var(--gain)" strokeOpacity="0.25" strokeWidth="0.5" />
      <text x="348" y="43" textAnchor="middle" fill="var(--gain)" fontSize="9" fontWeight="600">+34.2%</text>
      <rect x="40" y="20" width="60" height="18" rx="4" fill="var(--color-gold-400)" fillOpacity="0.1" stroke="var(--color-gold-400)" strokeOpacity="0.3" strokeWidth="0.5" />
      <text x="70" y="32" textAnchor="middle" fill="var(--color-gold-400)" fontSize="8">Paper Mode</text>
      <rect x="40" y="174" width="340" height="36" rx="6" fill="var(--text-primary)" fillOpacity="0.03" />
      <text x="60" y="188" fill="var(--text-tertiary)" fontSize="8">Sharpe</text>
      <text x="60" y="200" fill="var(--accent-text)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">1.84</text>
      <text x="130" y="188" fill="var(--text-tertiary)" fontSize="8">Max DD</text>
      <text x="130" y="200" fill="var(--loss)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">-8.2%</text>
      <text x="205" y="188" fill="var(--text-tertiary)" fontSize="8">Win Rate</text>
      <text x="205" y="200" fill="var(--gain)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">67.2%</text>
      <text x="285" y="188" fill="var(--text-tertiary)" fontSize="8">Trades</text>
      <text x="285" y="200" fill="var(--text-primary)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">212</text>
    </svg>
  );
}

export function ProductShowcase() {
  return (
    <section id="features" aria-label="Product features">
      <ProductSection
        side="left"
        eyebrow="Strategy Builder"
        headline="Build strategies visually."
        body="Drag-and-drop logic blocks — IF/THEN conditions, AND/OR gates, position sizing rules. 50+ blocks. No code required. Go from idea to live strategy in minutes."
        bullets={[
          "No-code visual editor",
          "Kelly criterion position sizing",
          "Paper mode before going live",
          "Historical backtesting",
        ]}
        visual={<StrategyBuilderVisual />}
      />
      <ProductSection
        side="right"
        eyebrow="Whale Intelligence"
        headline="Follow the smart money."
        body="Track whale wallets in real time. Mirror their trades automatically, or get instant alerts when big positions shift. The market's biggest players can't hide from you."
        bullets={[
          "Real-time wallet tracking",
          "Auto-copy with risk limits",
          "Instant webhook/email alerts",
          "Leaderboard of top traders",
        ]}
        visual={<WhaleIntelligenceVisual />}
      />
      <ProductSection
        side="left"
        eyebrow="Backtesting & Analytics"
        headline="Prove your edge before risking capital."
        body="Run backtests against historical Polymarket data. Track Sharpe ratio, drawdown, and win rate side-by-side. Paper trade until you're confident, then go live with one click."
        bullets={[
          "Historical data backtesting",
          "Sharpe / max drawdown / win rate",
          "Live P&L tracking",
          "Side-by-side strategy comparison",
        ]}
        visual={<BacktestVisual />}
      />
    </section>
  );
}
