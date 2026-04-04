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
      className="relative overflow-hidden pt-16 sm:pt-[100px] pb-12 sm:pb-20 text-center"
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
            className="absolute rounded-pf-full bg-pf-cyan-500/25 hero-particle"
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
        <div className="inline-flex items-center gap-2 text-pf-body-sm font-medium text-pf-cyan-400 bg-pf-cyan-500/8 border border-pf-cyan-500/20 rounded-pf-full px-4 py-1 mb-7">
          <span className="w-[7px] h-[7px] rounded-pf-full bg-pf-cyan-400 animate-[pulse-dot_2s_infinite]" />
          Early Access &mdash; Limited Invites
        </div>

        <h1
          id="hero-heading"
          className="text-[clamp(40px,7vw,72px)] font-extrabold leading-[1.15] tracking-[-0.035em] text-pf-text mb-6"
        >
          Trade Smarter. Copy the Best.
          <br />
          <span className="bg-gradient-to-br from-pf-cyan-300 to-pf-cyan-500 bg-clip-text text-transparent">
            Win More.
          </span>
        </h1>

        <p className="text-[clamp(16px,2vw,19px)] text-pf-text-secondary max-w-[600px] mx-auto mb-9 leading-relaxed">
          PolyForge is the prediction market platform where data-driven
          strategies meet social trading. Build automated strategies, copy top
          traders, and track every edge.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <a
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pf bg-pf-cyan-500 hover:bg-pf-cyan-400 text-pf-text-contrast font-semibold text-pf-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            Start Trading Free
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pf border border-pf-cyan-500/40 hover:border-pf-cyan-500/70 text-pf-cyan-400 hover:text-pf-cyan-300 font-semibold text-pf-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            See How It Works
          </a>
        </div>

        {/* Stat badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          {[
            "12,400+ Active Traders",
            "$2.3M+ Volume This Month",
            "94% Uptime",
          ].map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-2 text-pf-body-sm font-medium text-pf-text-secondary bg-pf-surface border border-pf-border-subtle rounded-pf-full px-4 py-2"
            >
              <span
                className="w-2 h-2 rounded-pf-full bg-pf-cyan-400"
                aria-hidden="true"
              />
              {badge}
            </span>
          ))}
        </div>

        {/* Hero strategy builder canvas */}
        <div className="max-w-[620px] mx-auto mt-6 bg-pf-surface border border-pf-border-subtle rounded-pf-lg overflow-hidden p-2 sm:p-4 shadow-pf-lg min-w-0">
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
              stroke="var(--color-pf-cyan-500)"
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
              stroke="var(--color-pf-cyan-500)"
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
              stroke="var(--color-pf-cyan-500)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M340 200 L420 170"
              stroke="var(--color-pf-cyan-500)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="20"
                to="0"
                dur="2.5s"
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
              fill="var(--color-pf-cyan-500)"
              fillOpacity="0.08"
              stroke="var(--color-pf-cyan-500)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <text
              x="80"
              y="73"
              textAnchor="middle"
              fill="var(--color-pf-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              ENTRY SIGNAL
            </text>
            <text
              x="80"
              y="93"
              textAnchor="middle"
              fill="var(--color-pf-text-muted)"
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
              fill="var(--color-pf-cyan-500)"
              fillOpacity="0.08"
              stroke="var(--color-pf-cyan-500)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <text
              x="80"
              y="193"
              textAnchor="middle"
              fill="var(--color-pf-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              VOLUME CHECK
            </text>
            <text
              x="80"
              y="213"
              textAnchor="middle"
              fill="var(--color-pf-text-muted)"
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
              fill="var(--color-pf-cyan-400)"
              fillOpacity="0.06"
              stroke="var(--color-pf-cyan-400)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="300"
              y="73"
              textAnchor="middle"
              fill="var(--color-pf-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              RISK MANAGER
            </text>
            <text
              x="300"
              y="93"
              textAnchor="middle"
              fill="var(--color-pf-text-muted)"
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
              fill="var(--color-pf-cyan-400)"
              fillOpacity="0.06"
              stroke="var(--color-pf-cyan-400)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="300"
              y="193"
              textAnchor="middle"
              fill="var(--color-pf-cyan-300)"
              fontSize="10"
              fontWeight="600"
            >
              POSITION SIZE
            </text>
            <text
              x="300"
              y="213"
              textAnchor="middle"
              fill="var(--color-pf-text-muted)"
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
              fill="var(--color-pf-success)"
              fillOpacity="0.06"
              stroke="var(--color-pf-success)"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <text
              x="480"
              y="143"
              textAnchor="middle"
              fill="var(--color-pf-success)"
              fontSize="10"
              fontWeight="600"
            >
              EXECUTE
            </text>
            <text
              x="480"
              y="163"
              textAnchor="middle"
              fill="var(--color-pf-text-muted)"
              fontSize="9"
            >
              Buy YES @ market
            </text>

            {/* Live pulse */}
            <circle cx="530" cy="128" r="4" fill="var(--color-pf-success)">
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
