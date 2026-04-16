import {
  LayoutGrid,
  Activity,
  Users,
  Lightbulb,
  TrendingUp,
  ZoomIn,
  Code2,
} from "lucide-react";

const features = [
  {
    title: "Strategy Builder",
    description:
      "Build no-code automated trading strategies with our visual block editor. Set conditions, triggers, and position limits.",
    gradientClass: "from-accent/[var(--opacity-subtle)]",
    icon: <LayoutGrid size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="5"
          y="10"
          width="42"
          height="24"
          rx="5"
          fill="var(--accent-default)"
          fillOpacity="0.1"
          stroke="var(--accent-default)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="26"
          y="26"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="7"
        >
          IF Price
        </text>
        <rect
          x="5"
          y="44"
          width="42"
          height="24"
          rx="5"
          fill="var(--accent-default)"
          fillOpacity="0.1"
          stroke="var(--accent-default)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="26"
          y="60"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="7"
        >
          IF Volume
        </text>
        <path
          d="M47 22 L62 38"
          stroke="var(--accent-default)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <path
          d="M47 56 L62 42"
          stroke="var(--accent-default)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        {/* AND gate */}
        <rect
          x="62"
          y="28"
          width="30"
          height="24"
          rx="5"
          fill="var(--color-gold-400)"
          fillOpacity="0.1"
          stroke="var(--color-gold-400)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="77"
          y="44"
          textAnchor="middle"
          fill="var(--color-gold-400)"
          fontSize="7"
        >
          AND
        </text>
        <path
          d="M92 40 L108 40"
          stroke="var(--accent-default)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        {/* Variable */}
        <rect
          x="108"
          y="28"
          width="38"
          height="24"
          rx="5"
          fill="var(--color-purple-400)"
          fillOpacity="0.1"
          stroke="var(--color-purple-400)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="127"
          y="44"
          textAnchor="middle"
          fill="var(--color-purple-400)"
          fontSize="7"
        >
          Size = 5%
        </text>
        <path
          d="M146 40 L158 40"
          stroke="var(--gain)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <rect
          x="158"
          y="28"
          width="36"
          height="24"
          rx="5"
          fill="var(--gain)"
          fillOpacity="0.1"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="176"
          y="44"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
        >
          Execute
        </text>
        <text
          x="100"
          y="90"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          50+ blocks available
        </text>
      </svg>
    ),
  },
  {
    title: "Paper Trading & Backtesting",
    description:
      "Test against historical data, simulate with real-time prices. Prove your edge before risking capital with detailed P&L curves, Sharpe ratio, and drawdown analytics.",
    gradientClass: "from-accent-text/[var(--opacity-subtle)]",
    icon: <Activity size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line
          x1="20"
          y1="85"
          x2="180"
          y2="85"
          stroke="var(--text-primary)"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        <line
          x1="20"
          y1="60"
          x2="180"
          y2="60"
          stroke="var(--text-primary)"
          strokeOpacity="0.04"
          strokeWidth="1"
        />
        <line
          x1="20"
          y1="35"
          x2="180"
          y2="35"
          stroke="var(--text-primary)"
          strokeOpacity="0.04"
          strokeWidth="1"
        />
        <polyline
          points="20,75 40,70 55,72 75,60 90,55 110,58 125,45 145,40 160,35 180,28"
          stroke="var(--accent-text)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20,75 40,70 55,72 75,60 90,55 110,58 125,45 145,40 160,35 180,28 L180,85 L20,85Z"
          fill="url(#equityGrad)"
          opacity="0.3"
        />
        <defs>
          <linearGradient
            id="equityGrad"
            x1="100"
            y1="28"
            x2="100"
            y2="85"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--accent-text)" stopOpacity="0.4" />
            <stop
              offset="1"
              stopColor="var(--accent-text)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <text
          x="180"
          y="23"
          textAnchor="end"
          fill="var(--gain)"
          fontSize="8"
        >
          +34.2%
        </text>
        <rect
          x="20"
          y="10"
          width="50"
          height="14"
          rx="3"
          fill="var(--color-gold-400)"
          fillOpacity="0.1"
          stroke="var(--color-gold-400)"
          strokeOpacity="0.3"
          strokeWidth="0.5"
        />
        <text
          x="45"
          y="20"
          textAnchor="middle"
          fill="var(--color-gold-400)"
          fontSize="6"
        >
          Paper Mode
        </text>
      </svg>
    ),
  },
  {
    title: "Copy Trading",
    description:
      "Follow top performers and mirror their trades automatically. Browse the leaderboard and copy with one click.",
    gradientClass: "from-gain/[var(--opacity-subtle)]",
    icon: <Users size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Whale wallet */}
        <rect
          x="15"
          y="20"
          width="60"
          height="30"
          rx="6"
          fill="var(--gain)"
          fillOpacity="0.08"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="45"
          y="33"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
          fontWeight="600"
        >
          Whale
        </text>
        <text
          x="45"
          y="44"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          0x8f..3a
        </text>
        {/* Arrow */}
        <path
          d="M75 35 L95 35"
          stroke="var(--gain)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <polygon
          points="95,32 100,35 95,38"
          fill="var(--gain)"
          fillOpacity="0.5"
        />
        {/* Your copy */}
        <rect
          x="105"
          y="20"
          width="60"
          height="30"
          rx="6"
          fill="var(--accent-default)"
          fillOpacity="0.08"
          stroke="var(--accent-default)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="135"
          y="33"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="7"
          fontWeight="600"
        >
          You
        </text>
        <text
          x="135"
          y="44"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          Mirrored
        </text>
        {/* Modes */}
        <rect
          x="15"
          y="62"
          width="45"
          height="18"
          rx="4"
          fill="var(--accent-default)"
          fillOpacity="0.06"
          stroke="var(--accent-default)"
          strokeOpacity="0.15"
          strokeWidth="0.5"
        />
        <text
          x="37"
          y="74"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="6"
        >
          % Mode
        </text>
        <rect
          x="67"
          y="62"
          width="45"
          height="18"
          rx="4"
          fill="var(--accent-default)"
          fillOpacity="0.06"
          stroke="var(--accent-default)"
          strokeOpacity="0.15"
          strokeWidth="0.5"
        />
        <text
          x="89"
          y="74"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="6"
        >
          Fixed
        </text>
        <rect
          x="119"
          y="62"
          width="45"
          height="18"
          rx="4"
          fill="var(--accent-default)"
          fillOpacity="0.06"
          stroke="var(--accent-default)"
          strokeOpacity="0.15"
          strokeWidth="0.5"
        />
        <text
          x="141"
          y="74"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="6"
        >
          Mirror
        </text>
      </svg>
    ),
  },
  {
    title: "Backtesting",
    description:
      "Test your strategies against historical market data before going live. See P&L curves and win rates.",
    gradientClass: "from-purple-500/[var(--opacity-subtle)]",
    icon: <Lightbulb size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* News feed */}
        <rect
          x="10"
          y="10"
          width="75"
          height="20"
          rx="4"
          fill="var(--text-primary)"
          fillOpacity="0.03"
          stroke="var(--text-primary)"
          strokeOpacity="0.08"
          strokeWidth="0.5"
        />
        <text x="18" y="24" fill="var(--text-tertiary)" fontSize="6">
          Breaking: Fed holds...
        </text>
        <rect
          x="10"
          y="34"
          width="75"
          height="20"
          rx="4"
          fill="var(--text-primary)"
          fillOpacity="0.03"
          stroke="var(--text-primary)"
          strokeOpacity="0.08"
          strokeWidth="0.5"
        />
        <text x="18" y="48" fill="var(--text-tertiary)" fontSize="6">
          Trump announces...
        </text>
        {/* Arrow to AI */}
        <path
          d="M85 35 L100 35"
          stroke="var(--color-purple-400)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        {/* AI brain */}
        <rect
          x="100"
          y="18"
          width="45"
          height="34"
          rx="8"
          fill="var(--color-purple-400)"
          fillOpacity="0.08"
          stroke="var(--color-purple-400)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="122"
          y="33"
          textAnchor="middle"
          fill="var(--color-purple-400)"
          fontSize="8"
          fontWeight="600"
        >
          AI
        </text>
        <text
          x="122"
          y="44"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="5"
        >
          Claude + GPT
        </text>
        {/* Arrow to signal */}
        <path
          d="M145 35 L160 35"
          stroke="var(--gain)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        {/* Signal output */}
        <rect
          x="160"
          y="18"
          width="32"
          height="34"
          rx="6"
          fill="var(--gain)"
          fillOpacity="0.08"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text
          x="176"
          y="33"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
          fontWeight="600"
        >
          BUY
        </text>
        <text
          x="176"
          y="44"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="5"
        >
          Signal
        </text>
        {/* Confidence bar */}
        <rect
          x="10"
          y="68"
          width="182"
          height="20"
          rx="4"
          fill="var(--gain)"
          fillOpacity="0.04"
          stroke="var(--gain)"
          strokeOpacity="0.15"
          strokeWidth="0.5"
        />
        <text x="18" y="82" fill="var(--gain)" fontSize="7">
          Confidence: 87%
        </text>
        <text x="130" y="82" fill="var(--text-tertiary)" fontSize="6">
          Market: US Election
        </text>
      </svg>
    ),
  },
  {
    title: "Smart Alerts",
    description:
      "Get notified on price movements, whale trades, and strategy signals via webhooks, email, or in-app alerts.",
    gradientClass: "from-accent/[var(--opacity-subtle)]",
    icon: <TrendingUp size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Price line */}
        <polyline
          points="15,60 40,55 60,58 80,48 100,50 120,42 140,45 160,38 185,35"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* TP line */}
        <line
          x1="15"
          y1="25"
          x2="185"
          y2="25"
          stroke="var(--gain)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x="187" y="28" fill="var(--gain)" fontSize="6">
          TP 0.85
        </text>
        {/* SL line */}
        <line
          x1="15"
          y1="75"
          x2="185"
          y2="75"
          stroke="var(--loss)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x="187" y="78" fill="var(--loss)" fontSize="6">
          SL 0.55
        </text>
        {/* Trailing stop */}
        <polyline
          points="80,58 100,60 120,52 140,55 160,48 185,45"
          stroke="var(--color-gold-400)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="3 2"
          fill="none"
        />
        <text x="187" y="48" fill="var(--color-gold-400)" fontSize="6">
          Trail
        </text>
        {/* Labels */}
        <rect
          x="15"
          y="84"
          width="36"
          height="12"
          rx="3"
          fill="var(--gain)"
          fillOpacity="0.08"
          stroke="var(--gain)"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <text
          x="33"
          y="93"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="5.5"
        >
          TP/SL
        </text>
        <rect
          x="56"
          y="84"
          width="36"
          height="12"
          rx="3"
          fill="var(--color-gold-400)"
          fillOpacity="0.08"
          stroke="var(--color-gold-400)"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <text
          x="74"
          y="93"
          textAnchor="middle"
          fill="var(--color-gold-400)"
          fontSize="5.5"
        >
          Trailing
        </text>
        <rect
          x="97"
          y="84"
          width="36"
          height="12"
          rx="3"
          fill="var(--accent-default)"
          fillOpacity="0.08"
          stroke="var(--accent-default)"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <text
          x="115"
          y="93"
          textAnchor="middle"
          fill="var(--color-cyan-300)"
          fontSize="5.5"
        >
          Limit
        </text>
        <rect
          x="138"
          y="84"
          width="36"
          height="12"
          rx="3"
          fill="var(--color-purple-400)"
          fillOpacity="0.08"
          stroke="var(--color-purple-400)"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <text
          x="156"
          y="93"
          textAnchor="middle"
          fill="var(--color-purple-400)"
          fontSize="5.5"
        >
          Pegged
        </text>
      </svg>
    ),
  },
  {
    title: "Strategy Marketplace",
    description:
      "Buy, sell, and fork proven strategies from top traders. Rate and review what you use.",
    gradientClass: "from-gold-400/[var(--opacity-subtle)]",
    icon: <ZoomIn size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Whale alert row 1 */}
        <rect
          x="10"
          y="8"
          width="180"
          height="26"
          rx="5"
          fill="var(--gain)"
          fillOpacity="0.06"
          stroke="var(--gain)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle
          cx="24"
          cy="21"
          r="6"
          fill="var(--gain)"
          fillOpacity="0.15"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="0.5"
        />
        <text
          x="24"
          y="24"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
          fontWeight="700"
        >
          W
        </text>
        <text
          x="38"
          y="18"
          fill="var(--text-primary)"
          fontSize="7"
          fontWeight="600"
        >
          0x8f..3a bought
        </text>
        <text x="38" y="28" fill="var(--gain)" fontSize="7">
          $52K YES
        </text>
        <text
          x="182"
          y="24"
          textAnchor="end"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          2m ago
        </text>
        {/* Whale alert row 2 */}
        <rect
          x="10"
          y="40"
          width="180"
          height="26"
          rx="5"
          fill="var(--loss)"
          fillOpacity="0.06"
          stroke="var(--loss)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle
          cx="24"
          cy="53"
          r="6"
          fill="var(--loss)"
          fillOpacity="0.15"
          stroke="var(--loss)"
          strokeOpacity="0.3"
          strokeWidth="0.5"
        />
        <text
          x="24"
          y="56"
          textAnchor="middle"
          fill="var(--loss)"
          fontSize="7"
          fontWeight="700"
        >
          W
        </text>
        <text
          x="38"
          y="50"
          fill="var(--text-primary)"
          fontSize="7"
          fontWeight="600"
        >
          0xd4..b7 sold
        </text>
        <text x="38" y="60" fill="var(--loss)" fontSize="7">
          $31K NO
        </text>
        <text
          x="182"
          y="56"
          textAnchor="end"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          5m ago
        </text>
        {/* Whale alert row 3 */}
        <rect
          x="10"
          y="72"
          width="180"
          height="26"
          rx="5"
          fill="var(--gain)"
          fillOpacity="0.06"
          stroke="var(--gain)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle
          cx="24"
          cy="85"
          r="6"
          fill="var(--gain)"
          fillOpacity="0.15"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="0.5"
        />
        <text
          x="24"
          y="88"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
          fontWeight="700"
        >
          W
        </text>
        <text
          x="38"
          y="82"
          fill="var(--text-primary)"
          fontSize="7"
          fontWeight="600"
        >
          0xa1..9c bought
        </text>
        <text x="38" y="92" fill="var(--gain)" fontSize="7">
          $88K YES
        </text>
        <text
          x="182"
          y="88"
          textAnchor="end"
          fill="var(--text-tertiary)"
          fontSize="6"
        >
          8m ago
        </text>
      </svg>
    ),
  },
  {
    title: "AI Portfolio Review",
    description:
      "Get AI-powered insights on your portfolio, risk exposure, and trading opportunities.",
    gradientClass: "from-purple-400/[var(--opacity-subtle)]",
    icon: <Code2 size={24} aria-hidden="true" />,
    visual: (
      <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="10"
          y="8"
          width="180"
          height="84"
          rx="6"
          fill="var(--accent-default)"
          fillOpacity="0.04"
          stroke="var(--accent-default)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle
          cx="22"
          cy="18"
          r="3"
          fill="var(--loss)"
          fillOpacity="0.5"
        />
        <circle
          cx="32"
          cy="18"
          r="3"
          fill="var(--warning)"
          fillOpacity="0.5"
        />
        <circle
          cx="42"
          cy="18"
          r="3"
          fill="var(--gain)"
          fillOpacity="0.5"
        />
        <line
          x1="10"
          y1="26"
          x2="190"
          y2="26"
          stroke="var(--text-primary)"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        <text x="20" y="39" fill="var(--text-tertiary)" fontSize="6.5">
          import {"{"} PolyforgeClient {"}"} from
        </text>
        <text x="20" y="50" fill="var(--color-purple-400)" fontSize="6.5">
          &apos;@polyforge/sdk&apos;;
        </text>
        <text x="20" y="63" fill="var(--accent-text)" fontSize="6.5">
          for await (const event of
        </text>
        <text x="20" y="74" fill="var(--accent-text)" fontSize="6.5">
          {" "}
          client.watchStrategy(id)) {"{"}
        </text>
        <text x="20" y="85" fill="var(--gain)" fontSize="6.5">
          {" "}
          console.log(event.type); {"}"}
        </text>
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="py-24" id="features" aria-labelledby="features-heading">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="text-center max-w-content-sm mx-auto mb-14">
          <h2
            id="features-heading"
            className="text-2xl sm:text-3xl font-semibold text-primary mb-4"
          >
            Everything you need to trade smarter
          </h2>
          <p className="text-display-sm text-secondary">
            From idea to live strategy in minutes, not months.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`bg-surface bg-gradient-to-br ${feature.gradientClass} to-surface border border-subtle rounded-xl transition-all duration-panel hover:border-accent/30 hover:shadow-md`}
            >
              {/* Visual preview */}
              <div
                className="px-4 py-3 border-b border-subtle bg-app/20 rounded-t-xl overflow-hidden"
                aria-hidden="true"
              >
                <div className="w-full h-auto">{feature.visual}</div>
              </div>

              <div className="p-5 sm:p-7">
                {/* Icon */}
                <div className="w-14 h-14 bg-accent/8 border border-accent/20 rounded-lg flex items-center justify-center text-accent-text mb-5">
                  {feature.icon}
                </div>

                <h3 className="text-display-sm font-semibold text-primary mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm text-secondary leading-7">
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
