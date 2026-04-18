"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";

export function CtaBanner() {
  const { ref, inView } = useInViewAnimation({ threshold: 0.2 });

  return (
    <section className="py-20 md:py-28" aria-labelledby="cta-heading">
      <div className="max-w-container-landing mx-auto px-6">
        <div
          ref={ref}
          className={`relative overflow-hidden bg-surface border border-accent/20 rounded-xl px-8 py-[72px] text-center transition-all duration-600 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none cta-dots"
            aria-hidden="true"
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[8/5] pointer-events-none cta-glow"
            aria-hidden="true"
          />

          <p className="relative text-label font-mono font-medium text-tertiary uppercase tracking-wider mb-3.5">
            Ready for live
          </p>
          <h2
            id="cta-heading"
            className="relative text-2xl sm:text-3xl lg:text-[clamp(32px,4.5vw,48px)] font-semibold text-primary max-w-[640px] mx-auto mb-3.5"
          >
            Forge your edge on prediction markets.
          </h2>
          <p className="relative text-base text-secondary max-w-[480px] mx-auto mb-7 leading-relaxed">
            Paper-trade unlimited. Go live with your Polymarket keys whenever
            you&apos;re ready.
          </p>

          <div className="relative inline-flex gap-2.5 flex-wrap justify-center">
            <a
              href="/signup"
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-pf bg-accent hover:bg-accent-text text-inverse font-semibold text-sm transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            >
              start free
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="/demo"
              className="inline-flex items-center px-6 py-3 rounded-pf border border-subtle bg-surface hover:bg-elevated text-primary font-semibold text-sm transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            >
              book a walkthrough
            </a>
          </div>

          <div className="relative font-mono text-[11px] text-tertiary mt-6 tracking-wider">
            NO CARD · FREE FOREVER FOR PAPER · EU-WEST-2 · 99.97% UPTIME YTD
          </div>
        </div>
      </div>
    </section>
  );
}
