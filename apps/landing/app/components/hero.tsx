const PARTICLES = [
  { w: 4, left: "15%", top: "20%", dur: "8s", delay: "0s" },
  { w: 3, left: "80%", top: "30%", dur: "10s", delay: "1s" },
  { w: 5, left: "40%", top: "60%", dur: "12s", delay: "2s" },
  { w: 3, left: "70%", top: "70%", dur: "9s", delay: "3s" },
  { w: 4, left: "25%", top: "80%", dur: "11s", delay: "0.5s" },
  { w: 3, left: "55%", top: "15%", dur: "7s", delay: "1.5s" },
] as const;

export function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-16 sm:pt-24 pb-12 sm:pb-20 text-center"
      aria-labelledby="hero-heading"
    >
      {/* Glow */}
      <div
        className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] pointer-events-none hero-glow"
        aria-hidden="true"
      />

      {/* Floating particles */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {PARTICLES.map((p) => (
          <div
            key={`${p.left}-${p.top}`}
            className="absolute rounded-full bg-accent/25 hero-particle"
            style={
              {
                width: p.w,
                height: p.w,
                left: p.left,
                top: p.top,
                "--particle-dur": p.dur,
                "--particle-delay": p.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 max-w-[1100px] mx-auto px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-body-sm font-medium text-accent-text bg-accent/8 border border-accent/20 rounded-full px-4 py-1 mb-7">
          <span className="w-2 h-2 rounded-full bg-accent-text animate-[pulse-dot_var(--duration-slow)_ease-in-out_infinite]" />
          Early Access &mdash; Limited Invites
        </div>

        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl lg:text-7xl font-semibold leading-[1.15] tracking-tight text-primary mb-6"
        >
          Trade Smarter. Copy the Best.
          <br />
          <span className="bg-gradient-to-br from-cyan-300 to-accent bg-clip-text text-transparent">
            Win More.
          </span>
        </h1>

        <p className="text-base lg:text-lg text-secondary max-w-[600px] mx-auto mb-9 leading-relaxed">
          PolyForge is the prediction market platform where data-driven
          strategies meet social trading. Build automated strategies, copy top
          traders, and track every edge.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <a
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pf bg-accent hover:bg-accent-text text-inverse font-semibold text-body-md transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            Start Trading Free
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pf border border-accent/40 hover:border-accent/70 text-accent-text hover:text-cyan-300 font-semibold text-body-md transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            See How It Works
          </a>
        </div>

        {/* Stat badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          {[
            { number: "12,400+", label: "Active Traders" },
            { number: "$2.3M+", label: "Volume This Month" },
            { number: "94%", label: "Uptime" },
          ].map((badge) => (
            <span
              key={badge.number}
              className="inline-flex items-center gap-2 text-body-sm font-medium text-secondary bg-surface border border-subtle rounded-full px-4 py-2"
            >
              <span
                className="w-2 h-2 rounded-full bg-accent-text"
                aria-hidden="true"
              />
              <span className="font-mono">{badge.number}</span> {badge.label}
            </span>
          ))}
        </div>

        {/* Hero strategy builder canvas */}
        <div className="max-w-[620px] mx-auto mt-6 bg-surface border border-subtle rounded-xl overflow-hidden p-2 sm:p-4 shadow-lg min-w-0">
          <svg
            viewBox="0 0 560 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
            aria-hidden="true"
          >
            <style>{`@media(prefers-reduced-motion:reduce){animate{display:none}}`}</style>
            {/* Connection lines */}
            <path
              d="M140 80 L240 80"
              stroke="var(--accent-default)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M340 80 L420 130"
              stroke="var(--accent-default)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M140 200 L240 200"
              stroke="var(--accent-default)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M340 200 L420 170"
              stroke="var(--accent-default)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>

            {/* Block 1: Entry Signal */}
            <rect
              x="20"
              y="50"
              width="120"
              height="60"
              rx="10"
              fill="var(--accent-default)"
              fillOpacity="0.08"
              stroke="var(--accent-default)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <text
              x="80"
              y="73"
              textAnchor="middle"
              fill="var(--color-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              ENTRY SIGNAL
            </text>
            <text
              x="80"
              y="93"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              {"Price > 0.65"}
            </text>

            {/* Block 2: Volume Check */}
            <rect
              x="20"
              y="170"
              width="120"
              height="60"
              rx="10"
              fill="var(--accent-default)"
              fillOpacity="0.08"
              stroke="var(--accent-default)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <text
              x="80"
              y="193"
              textAnchor="middle"
              fill="var(--color-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              VOLUME CHECK
            </text>
            <text
              x="80"
              y="213"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              {"Vol > 10k / 24h"}
            </text>

            {/* Block 3: Risk Manager */}
            <rect
              x="240"
              y="50"
              width="120"
              height="60"
              rx="10"
              fill="var(--accent-text)"
              fillOpacity="0.06"
              stroke="var(--accent-text)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="300"
              y="73"
              textAnchor="middle"
              fill="var(--color-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              RISK MANAGER
            </text>
            <text
              x="300"
              y="93"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              Max 5% per trade
            </text>

            {/* Block 4: Position Size */}
            <rect
              x="240"
              y="170"
              width="120"
              height="60"
              rx="10"
              fill="var(--accent-text)"
              fillOpacity="0.06"
              stroke="var(--accent-text)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="300"
              y="193"
              textAnchor="middle"
              fill="var(--color-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              POSITION SIZE
            </text>
            <text
              x="300"
              y="213"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              Kelly criterion
            </text>

            {/* Block 5: Execute */}
            <rect
              x="420"
              y="120"
              width="120"
              height="60"
              rx="10"
              fill="var(--gain)"
              fillOpacity="0.06"
              stroke="var(--gain)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="480"
              y="143"
              textAnchor="middle"
              fill="var(--gain)"
              fontSize="10"
              fontWeight="600"
            >
              EXECUTE
            </text>
            <text
              x="480"
              y="163"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              Buy YES @ market
            </text>

            {/* Live pulse */}
            <circle cx="530" cy="128" r="4" fill="var(--gain)">
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
