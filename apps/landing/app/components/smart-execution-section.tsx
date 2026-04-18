import { Check } from "lucide-react";
import { BRACKET_ORDERS, BRACKET_STATS } from "../data/landing-data";

function BracketOrderMock() {
  return (
    <div
      className="bg-surface border border-subtle rounded-xl overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-subtle">
        <span className="font-mono text-xs text-secondary">Bracket order</span>
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono text-accent-text bg-[color-mix(in_srgb,var(--accent-default)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent-default)_20%,transparent)]">
          active
        </span>
        <span className="ml-auto font-mono text-[11px] text-tertiary">
          BTC&gt;150K · YES · 0.31
        </span>
      </div>
      <div className="p-5">
        {BRACKET_ORDERS.map(({ label, value, status, color }) => (
          <div
            key={label}
            className="grid items-center gap-3 py-3 border-b border-subtle"
            style={{ gridTemplateColumns: "90px 1fr 80px" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: color }}
              />
              <span className="text-xs text-secondary font-medium">
                {label}
              </span>
            </div>
            <span className="font-mono text-[13px] text-primary tabular-nums">
              {value}
            </span>
            <span
              className="font-mono text-[11px] uppercase tracking-wider text-right"
              style={{ color }}
            >
              {status}
            </span>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2.5 mt-3.5">
          {BRACKET_STATS.map(({ label, value, color }) => (
            <div
              key={label}
              className="border border-subtle rounded-lg px-3 py-2.5"
            >
              <div className="text-[10px] text-tertiary uppercase tracking-wider">
                {label}
              </div>
              <div
                className="font-mono text-sm font-semibold mt-0.5 tabular-nums"
                style={{ color }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SmartExecutionSection() {
  return (
    <section
      className="py-20 sm:py-28 border-t border-subtle"
      id="execution"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-12 lg:gap-20">
          <div>
            <p className="text-label font-medium text-accent-text uppercase tracking-wider font-mono mb-4">
              07 · Smart execution
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4">
              Institutional-grade orders. One click.
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[520px] mb-6">
              Bracket orders, TWAP tranches, DCA schedules, OCO pairs, trailing
              stops, scale-in / scale-out. The primitives you&apos;d build
              in-house at a prop shop — available in the builder and via API.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                "Bracket · entry + TP + SL as one linked bundle",
                "TWAP · time-weighted tranches on any interval",
                "DCA · dollar-cost averaging on a schedule",
                "OCO · one-cancels-other linked orders",
                "Trailing stops, scale-in, scale-out, bulk cancel",
              ].map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-center gap-2.5 text-sm text-secondary"
                >
                  <Check
                    size={14}
                    className="text-accent-text shrink-0"
                    aria-hidden="true"
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <BracketOrderMock />
          </div>
        </div>
      </div>
    </section>
  );
}
