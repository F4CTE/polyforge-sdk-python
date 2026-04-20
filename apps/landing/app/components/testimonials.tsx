"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { TESTIMONIALS } from "../data/landing-data";

export function Testimonials() {
  const { ref: headRef, inView: headInView } = useInViewAnimation();
  const { ref: gridRef, inView: gridInView } = useInViewAnimation({
    threshold: 0.1,
  });

  return (
    <section className="py-20 md:py-28" aria-labelledby="testimonials-heading">
      <div className="max-w-container-landing mx-auto px-6">
        <div
          ref={headRef}
          className={`max-w-[560px] mb-12 transition-all duration-500 ease-out ${
            headInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-label font-mono font-medium text-tertiary uppercase tracking-wider mb-3">
            05 · Operators
          </p>
          <h2
            id="testimonials-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-3"
          >
            Built with the people who trade it.
          </h2>
          <p className="text-base text-secondary leading-relaxed">
            Private beta. Public feedback.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {TESTIMONIALS.map((t, i) => {
            const initials = t.who
              .split(" ")
              .map((s) => s[0])
              .join("");
            return (
              <figure
                key={t.who}
                style={{
                  transitionDelay: gridInView ? `${i * 80}ms` : "0ms",
                }}
                className={`bg-surface border border-subtle rounded-xl p-7 transition-all duration-500 ease-out hover:border-accent/20 ${
                  gridInView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
              >
                <div
                  className="text-5xl font-semibold leading-none text-accent/15 -mb-2 font-sans select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </div>
                <blockquote>
                  <p className="text-sm text-secondary leading-7 mb-6">
                    {t.quote}
                  </p>
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/25 flex items-center justify-center text-xs font-semibold text-accent-text font-mono shrink-0"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <cite className="not-italic">
                    <div className="text-body-sm font-medium text-primary">
                      {t.who}
                    </div>
                    <div className="text-caption text-tertiary mt-0.5">
                      {t.role}
                    </div>
                  </cite>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
