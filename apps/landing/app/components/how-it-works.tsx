const steps = [
  {
    number: "01",
    title: "Connect Your Polymarket Account",
    description:
      "Link your Polymarket wallet in one click. Your positions sync automatically.",
    visual: (
      <svg
        className="w-20 h-20"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="8"
          y="15"
          width="28"
          height="18"
          rx="4"
          fill="var(--accent-default)"
          fillOpacity="0.1"
          stroke="var(--accent-default)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <rect
          x="44"
          y="15"
          width="28"
          height="18"
          rx="4"
          fill="var(--accent-default)"
          fillOpacity="0.1"
          stroke="var(--accent-default)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <rect
          x="26"
          y="48"
          width="28"
          height="18"
          rx="4"
          fill="var(--gain)"
          fillOpacity="0.1"
          stroke="var(--gain)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <path
          d="M22 33 L36 48"
          stroke="var(--accent-default)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <path
          d="M58 33 L44 48"
          stroke="var(--accent-default)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Choose Your Trading Style",
    description:
      "Build your own strategy, copy a top trader, or browse the marketplace for proven systems.",
    visual: (
      <svg
        className="w-20 h-20"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="10"
          y1="65"
          x2="70"
          y2="65"
          stroke="var(--text-primary)"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        <polyline
          points="10,55 20,50 30,52 40,40 50,35 60,30 70,22"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx="70"
          cy="22"
          r="3"
          fill="var(--accent-text)"
          opacity="0.7"
        />
        <text
          x="70"
          y="17"
          textAnchor="middle"
          fill="var(--gain)"
          fontSize="7"
        >
          +34%
        </text>
      </svg>
    ),
  },
  {
    number: "03",
    title: "Track, Optimize, Profit",
    description:
      "Monitor live P&L, review AI insights, and refine your edge over time.",
    visual: (
      <svg
        className="w-20 h-20"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`@media(prefers-reduced-motion:reduce){animate{display:none}}`}</style>
        <rect
          x="12"
          y="20"
          width="56"
          height="40"
          rx="6"
          fill="var(--accent-default)"
          fillOpacity="0.06"
          stroke="var(--accent-default)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle cx="40" cy="36" r="4" fill="var(--gain)">
          <animate
            attributeName="r"
            values="4;5;4"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.6;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <text
          x="40"
          y="52"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="7"
        >
          Running
        </text>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="py-24" id="how-it-works" aria-labelledby="hiw-heading">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="text-center max-w-content-sm mx-auto mb-14">
          <h2
            id="hiw-heading"
            className="text-2xl sm:text-3xl font-semibold text-primary mb-4"
          >
            Get started in three steps
          </h2>
          <p className="text-display-sm text-secondary">
            From connection to profit in minutes, not months.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-content-md mx-auto stagger-children list-none p-0 m-0">
          {steps.map((step) => (
            <li
              key={step.number}
              className="flex flex-col items-center animate-fade-in"
            >
              <div
                className="flex flex-col items-center gap-3 mb-5"
                aria-hidden="true"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-elevated border border-accent/35 rounded-full flex items-center justify-center text-body-md font-semibold font-mono text-accent-text shadow-md">
                  {step.number}
                </div>
                {step.visual}
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  <span className="sr-only">Step {step.number}: </span>
                  {step.title}
                </h3>
                <p className="text-sm text-secondary leading-7">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
