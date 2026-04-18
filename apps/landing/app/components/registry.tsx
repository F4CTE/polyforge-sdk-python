"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { BLOCKS, REGISTRY_GROUPS } from "../data/landing-data";

export function Registry() {
  const { ref: headRef, inView: headInView } = useInViewAnimation();
  const { ref: gridRef, inView: gridInView } = useInViewAnimation({
    threshold: 0.1,
  });

  return (
    <section
      className="py-20 md:py-28"
      id="blocks"
      aria-labelledby="registry-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div
          ref={headRef}
          className={`max-w-[560px] mb-12 transition-all duration-500 ease-out ${
            headInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-label font-mono font-medium text-tertiary uppercase tracking-wider mb-3">
            06 · Block registry
          </p>
          <h2
            id="registry-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-3"
          >
            36 primitives. Zero code.
          </h2>
          <p className="text-base text-secondary leading-relaxed">
            Every block is typed, wired, and validated. Four categories. Drop on
            the canvas, connect, deploy.
          </p>
        </div>

        <div
          ref={gridRef}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-[14px] border border-subtle transition-all duration-600 ease-out ${
            gridInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ gap: 1, background: "var(--border-subtle)" }}
        >
          {REGISTRY_GROUPS.map((g) => {
            const count = BLOCKS.filter((b) => b.cat === g.key).length;
            return (
              <div key={g.key} className="bg-surface p-6">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[15px] font-semibold text-primary tracking-tight">
                    {g.label}
                  </span>
                  <span
                    className="font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color: g.color }}
                  >
                    {count}
                  </span>
                </div>
                <p className="font-mono text-[10.5px] text-tertiary uppercase tracking-widest mt-1 mb-4">
                  {g.hint}
                </p>
                <div className="flex flex-col gap-1.5">
                  {g.sample.map((name) => (
                    <div
                      key={name}
                      className="font-mono text-xs text-secondary py-1"
                    >
                      <span className="mr-2" style={{ color: g.color }}>
                        ·
                      </span>
                      {name}
                    </div>
                  ))}
                  <div className="font-mono text-[11px] text-tertiary mt-1">
                    + {count - 3} more
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center gap-4 items-center flex-wrap">
          <a
            href="#docs"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-secondary border border-subtle rounded-sm bg-surface hover:bg-elevated hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            Browse full library
            <svg
              width="13"
              height="13"
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
          <span className="font-mono text-xs text-tertiary">
            + 8 logic / calc blocks · variables · sub-strategies
          </span>
        </div>
      </div>
    </section>
  );
}
