"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";

const stats = [
  { number: "12,400+", label: "Traders" },
  { number: "847", label: "Strategies" },
  { number: "$2.3M", label: "Monthly Volume" },
  { number: "Polymarket", label: "Native" },
];

export function MetricsStrip() {
  const { ref, inView } = useInViewAnimation<HTMLDListElement>({ threshold: 0.2 });

  return (
    <section
      className="py-7 border-t border-b border-subtle bg-surface"
      aria-label="Platform statistics"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <dl ref={ref} className="flex items-center justify-center flex-wrap m-0">
          {stats.map((stat, i) => (
            <div key={stat.label} className="contents">
              {i > 0 && (
                <div
                  className="w-px h-12 bg-subtle hidden sm:block"
                  role="separator"
                  aria-hidden="true"
                />
              )}
              <div
                style={{ transitionDelay: inView ? `${i * 60}ms` : "0ms" }}
                className={`flex flex-col items-center gap-1 px-4 sm:px-10 py-3 transition-all duration-500 ease-out ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
              >
                <dt className="order-2 text-xs sm:text-body-sm text-tertiary">
                  {stat.label}
                </dt>
                <dd className="order-1 m-0 text-xl sm:text-2xl font-semibold font-mono text-accent-text tracking-tight tabular-nums">
                  {stat.number}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
