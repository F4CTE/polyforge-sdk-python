"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { METRICS } from "../data/landing-data";

export function MetricsStrip() {
  const { ref, inView } = useInViewAnimation<HTMLDListElement>({
    threshold: 0.2,
  });

  return (
    <section
      className="border-t border-b border-subtle bg-surface"
      aria-label="Platform statistics"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <dl
          ref={ref}
          className="flex items-stretch justify-center flex-wrap m-0"
        >
          {METRICS.map((stat, i) => (
            <div key={stat.label} className="contents">
              {i > 0 && (
                <div
                  className="w-px bg-subtle self-stretch my-4 hidden sm:block"
                  role="separator"
                  aria-hidden="true"
                />
              )}
              <div
                style={{ transitionDelay: inView ? `${i * 60}ms` : "0ms" }}
                className={`flex flex-col items-center gap-1 px-5 sm:px-10 py-6 min-w-[180px] transition-all duration-500 ease-out ${
                  inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3"
                }`}
              >
                <dt className="order-2 text-xs text-tertiary">{stat.label}</dt>
                <dd className="order-1 m-0 text-[22px] font-semibold font-mono text-accent-text tracking-tight tabular-nums">
                  {stat.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
