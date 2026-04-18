"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { FEATURE_CELLS } from "../data/landing-data";

const ICON_PATHS: Record<string, string> = {
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  split: "M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  store:
    "M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9ZM3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9M12 3v6",
  cpu: "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  "chart-bar": "M12 20V10M18 20V4M6 20v-4",
  "layout-grid": "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  coins:
    "M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM16 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z",
  rocket:
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09ZM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z",
};

function FeatureIcon({ name }: { name: string }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function FeatureMatrix() {
  const { ref: headRef, inView: headInView } = useInViewAnimation();
  const { ref: gridRef, inView: gridInView } = useInViewAnimation({
    threshold: 0.05,
  });

  return (
    <section
      className="py-20 sm:py-28"
      id="everything"
      aria-labelledby="features-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div
          ref={headRef}
          className={`max-w-[600px] mb-12 transition-all duration-500 ease-out ${
            headInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-label font-mono font-medium text-tertiary uppercase tracking-wider mb-3">
            08 · Everything else
          </p>
          <h2
            id="features-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-3"
          >
            A full stack for serious prediction-market traders.
          </h2>
          <p className="text-base text-secondary leading-relaxed">
            Beyond the builder, the whale feed, and the backtest — these are the
            pieces that turn the terminal into a workflow.
          </p>
        </div>

        <div
          ref={gridRef}
          className={`grid overflow-hidden rounded-[14px] border border-subtle transition-all duration-600 ease-out ${
            gridInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{
            gap: 1,
            background: "var(--border-subtle)",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {FEATURE_CELLS.map((cell) => (
            <div
              key={cell.title}
              className="bg-surface p-6 pb-7 transition-colors duration-micro hover:bg-elevated cursor-default"
            >
              <span className="inline-flex text-accent-text mb-3.5">
                <FeatureIcon name={cell.icon} />
              </span>
              <div className="text-[15px] font-semibold text-primary tracking-tight mb-1.5">
                {cell.title}
              </div>
              <div className="text-[13px] text-secondary leading-relaxed">
                {cell.desc}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2.5 flex-wrap font-mono text-xs text-tertiary">
          <span>100+ API endpoints</span>
          <span aria-hidden="true">·</span>
          <span>33 MCP tools</span>
          <span aria-hidden="true">·</span>
          <span>15 achievement badges</span>
          <span aria-hidden="true">·</span>
          <span>13 backend services</span>
          <span aria-hidden="true">·</span>
          <span>3 SDKs</span>
        </div>
      </div>
    </section>
  );
}
