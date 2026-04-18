"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";

const testimonials = [
  {
    initials: "AK",
    name: "Alex Kowalski",
    role: "Quantitative Analyst",
    text: "The visual canvas builder is precise. I wired up IF/THEN blocks, logic gates, and variables into a full strategy in under an hour. Backtesting gave me the confidence to go live, and the advanced orders keep my risk locked down.",
  },
  {
    initials: "SR",
    name: "Sarah Reeves",
    role: "Independent Trader",
    text: "Copy trading changed everything for me. I follow two whale wallets and mirror their trades automatically. The whale tracker alerts me the moment big money moves, and I can react instantly without staring at screens all day.",
  },
  {
    initials: "MC",
    name: "Marcus Chen",
    role: "Crypto Fund Analyst",
    text: "The AI signals pipeline cut my decision latency by 60%. It picks up breaking news, matches it to markets I care about, and generates trade signals before I even see the headline. I just review and approve. My hit rate has never been higher.",
  },
];

export function Testimonials() {
  const { ref: headingRef, inView: headingInView } = useInViewAnimation();
  const { ref: gridRef, inView: gridInView } = useInViewAnimation({ threshold: 0.1 });

  return (
    <section
      className="py-24 bg-surface border-t border-b border-subtle"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div
          ref={headingRef}
          className={`text-center max-w-content-sm mx-auto mb-14 transition-all duration-500 ease-out ${
            headingInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            id="testimonials-heading"
            className="text-2xl sm:text-3xl font-semibold text-primary mb-4"
          >
            Trusted by traders
          </h2>
          <p className="text-display-sm text-secondary">
            Early adopters are already building their edge.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {testimonials.map((t, i) => (
            <figure
              key={t.name}
              style={{
                transitionDelay: gridInView ? `${i * 80}ms` : "0ms",
              }}
              className={`bg-app border border-subtle rounded-xl p-6 sm:p-8 transition-all duration-500 ease-out hover:border-accent/20 ${
                gridInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <div
                className="text-5xl font-semibold leading-none text-accent/15 -mb-2 font-sans"
                aria-hidden="true"
              >
                &ldquo;
              </div>
              <blockquote>
                <p className="text-sm text-secondary leading-7 italic mb-6">
                  {t.text}
                </p>
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/25 flex items-center justify-center text-body-sm font-semibold text-accent-text font-mono shrink-0"
                  aria-hidden="true"
                >
                  {t.initials}
                </div>
                <cite className="not-italic">
                  <div className="text-sm font-semibold text-primary">
                    {t.name}
                  </div>
                  <div className="text-xs text-tertiary mt-1">
                    {t.role}
                  </div>
                </cite>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
