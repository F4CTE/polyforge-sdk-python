import { Check, ArrowRight } from "lucide-react";
import { BUILDER_CATEGORIES } from "../data/landing-data";

function BuilderCanvas() {
  return (
    <div
      className="relative bg-surface border border-subtle rounded-xl overflow-hidden builder-dot-grid"
      style={{ height: 340 }}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-subtle bg-surface">
        <span className="font-mono text-[11px] text-secondary">
          momentum-α3.polyforge
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-secondary bg-surface border border-subtle rounded">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gain"
            style={{ animation: "dot-pulse 2s ease-in-out infinite" }}
          />
          running · 42ms
        </span>
        <span className="ml-auto inline-flex px-2 py-0.5 text-[10px] font-mono text-accent-text bg-[color-mix(in_srgb,var(--accent-default)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent-default)_20%,transparent)] rounded">
          paper
        </span>
      </div>

      <svg
        width="100%"
        height={298}
        className="absolute top-[42px] left-0 pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="var(--accent-text)" />
          </marker>
        </defs>
        <path
          d="M 180,70 C 230,70 260,140 310,140"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 180,180 C 230,180 260,140 310,140"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 450,140 C 510,140 530,70 580,70"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
          markerEnd="url(#arrow)"
        />
        <path
          d="M 450,140 C 510,140 530,220 580,220"
          stroke="var(--accent-text)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
          markerEnd="url(#arrow)"
        />
      </svg>

      <CanvasNode top={44} left={24} cat="trigger" title="price_above_tick" detail="YES ≥ 0.65" />
      <CanvasNode top={154} left={24} cat="trigger" title="volume_rate_tick" detail="vol > 10k/24h" />
      <CanvasNode top={110} left={310} cat="condition" title="max_position" detail="$500 · 5% port" />
      <CanvasNode top={40} left={580} cat="action" title="buy_yes" detail="GTC · Kelly" />
      <CanvasNode top={190} left={580} cat="action" title="set_stop_loss" detail="−8% trailing" />

      <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center font-mono text-[11px] text-tertiary">
        <span>blocks: 5 · edges: 4 · tick 200ms</span>
        <span>last fill · 00:12 · buy_yes 0.67 × $412</span>
      </div>
    </div>
  );
}

const NODE_COLORS: Record<string, string> = {
  trigger: "var(--accent-text)",
  condition: "var(--color-purple-400)",
  action: "var(--gain-text)",
  safety: "var(--warning)",
};

function CanvasNode({
  top,
  left,
  cat,
  title,
  detail,
}: {
  top: number;
  left: number;
  cat: string;
  title: string;
  detail: string;
}) {
  const color = NODE_COLORS[cat] ?? "var(--text-tertiary)";
  return (
    <div
      className="absolute w-[140px] bg-surface border border-default rounded-lg px-2.5 py-2 shadow-sm"
      style={{ top, left, borderLeftWidth: 2, borderLeftColor: color }}
    >
      <div
        className="font-mono text-[9.5px] uppercase tracking-widest"
        style={{ color }}
      >
        {cat}
      </div>
      <div className="font-mono text-xs font-medium text-primary mt-0.5">
        {title}
      </div>
      <div className="font-mono text-[10.5px] text-tertiary mt-0.5">
        {detail}
      </div>
    </div>
  );
}

export function BuilderSection() {
  return (
    <section className="py-20 md:py-28 border-t border-subtle" id="product">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-10 lg:gap-[72px]">
          <div>
            <p className="text-label font-medium text-accent-text uppercase tracking-wider font-mono mb-4">
              01 · Strategy builder
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4">
              Drag. Wire. Deploy.
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[520px] mb-6">
              36 typed primitives across triggers, conditions, actions, and
              safety. Wire them on a visual canvas. Reference values with{" "}
              <code className="font-mono text-sm text-accent-text">
                $syntax
              </code>
              . Branch with IF/THEN gates. Never touch a line of code.
            </p>
            <ul className="flex flex-col gap-2.5 mb-6">
              {[
                "13 event + tick triggers",
                "9 risk conditions & guards",
                "8 order actions with GTC, FOK, scales",
                "6 safety circuit breakers",
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
            <a
              href="#blocks"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
            >
              Explore the block library
              <ArrowRight size={13} aria-hidden="true" />
            </a>
          </div>
          <div className="overflow-x-auto" aria-hidden="true">
            <div className="min-w-[700px]">
              <BuilderCanvas />
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-4 mt-4 border border-subtle rounded-xl overflow-hidden"
          style={{ gap: 1, background: "var(--border-subtle)" }}
        >
          {BUILDER_CATEGORIES.map(({ label, count, sub, color }) => (
            <div key={label} className="bg-surface px-5 py-5">
              <div
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color }}
              >
                {label}
              </div>
              <div className="font-mono text-[28px] font-semibold text-primary tracking-tight mt-1 tabular-nums">
                {count}
              </div>
              <div className="text-xs text-tertiary mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
