"use client";

import { useTicker } from "../hooks/use-ticker";
import { MARKETS } from "../data/landing-data";

export function Tape() {
  const tape = useTicker(MARKETS, { interval: 2000 });
  const items = [...tape, ...tape];

  return (
    <div
      className="border-t border-b border-subtle bg-surface overflow-hidden py-3"
      aria-hidden="true"
    >
      <div
        className="flex gap-10 whitespace-nowrap font-mono"
        style={{ animation: "tape-slide 60s linear infinite" }}
      >
        {items.map((m, i) => (
          <div key={i} className="inline-flex items-center gap-2.5 text-xs">
            <span className="text-primary font-medium">{m.sym}</span>
            <span className="tabular-nums text-secondary">
              ¢{Math.round(m.px * 100)}
            </span>
            <span
              className={`tabular-nums ${m.chg >= 0 ? "text-gain-text" : "text-loss-text"}`}
            >
              {m.chg >= 0 ? "+" : ""}
              {m.chg.toFixed(1)}%
            </span>
            <span className="text-tertiary">{m.vol}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
