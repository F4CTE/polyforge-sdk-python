"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTicker } from "../hooks/use-ticker";
import {
  HEADLINES,
  DASHBOARD_MARKETS,
  type HeroVariant,
} from "../data/landing-data";

function DashboardMock() {
  const live = useTicker(DASHBOARD_MARKETS, { interval: 2200 });

  return (
    <div className="bg-surface border border-subtle rounded-[14px] overflow-hidden shadow-elevation-2">
      {/* Browser chrome */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-elevated border-b border-subtle">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-loss/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-gain/70" />
        </div>
        <div className="flex-1 text-center font-mono text-[11px] text-tertiary bg-app/50 px-2.5 py-1 rounded-md tracking-wide">
          app.polyforge.com · portfolio
        </div>
        <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded bg-accent-subtle border border-accent-border text-accent-text text-[11px] font-medium">
          <span
            className="w-1.5 h-1.5 rounded-full bg-accent"
            style={{ animation: "dot-pulse 2s ease-in-out infinite" }}
          />
          live
        </span>
      </div>

      <div className="p-4">
        {/* Top stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="border border-subtle rounded-lg p-3">
            <div className="text-[11px] text-tertiary">Total P&L</div>
            <div className="tabular-nums font-mono text-gain-text text-xl font-semibold mt-0.5 tracking-tight">
              +$2,847
            </div>
            <div className="text-[11px] tabular-nums text-gain-text">
              +18.3%
            </div>
          </div>
          <div className="border border-subtle rounded-lg p-3">
            <div className="text-[11px] text-tertiary">Win rate</div>
            <div className="tabular-nums font-mono text-primary text-xl font-semibold mt-0.5 tracking-tight">
              67.2%
            </div>
            <div className="text-[11px] tabular-nums text-tertiary">
              142/212
            </div>
          </div>
          <div className="border border-subtle rounded-lg p-3">
            <div className="text-[11px] text-tertiary">Strategies</div>
            <div className="tabular-nums font-mono text-primary text-xl font-semibold mt-0.5 tracking-tight">
              3
            </div>
            <div className="text-[11px] tabular-nums text-accent-text">
              2 paper · 1 live
            </div>
          </div>
        </div>

        {/* Equity curve */}
        <div className="border border-subtle rounded-lg p-3 mb-3">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-medium text-secondary">
              Equity curve · 30d
            </span>
            <span className="tabular-nums font-mono text-gain-text text-xs">
              +18.3%
            </span>
          </div>
          <svg
            width="100%"
            height="80"
            viewBox="0 0 400 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--accent-default)"
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor="var(--accent-default)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <g stroke="var(--border-subtle)" strokeWidth="0.5">
              <line x1="0" y1="20" x2="400" y2="20" />
              <line x1="0" y1="40" x2="400" y2="40" />
              <line x1="0" y1="60" x2="400" y2="60" />
            </g>
            <path
              d="M0 62 Q 30 55 50 52 T 100 48 T 150 50 T 200 38 T 260 32 T 310 20 T 400 10 L 400 80 L 0 80 Z"
              fill="url(#eqGrad)"
            />
            <path
              d="M0 62 Q 30 55 50 52 T 100 48 T 150 50 T 200 38 T 260 32 T 310 20 T 400 10"
              fill="none"
              stroke="var(--accent-default)"
              strokeWidth="1.5"
            />
            <circle cx="400" cy="10" r="3" fill="var(--accent-default)" />
            <circle
              cx="400"
              cy="10"
              r="6"
              fill="var(--accent-default)"
              opacity="0.25"
            />
          </svg>
        </div>

        {/* Markets table */}
        <div className="border border-subtle rounded-lg">
          <div className="grid grid-cols-[1fr_70px_70px] gap-3 px-3.5 py-2 font-mono text-[10px] tracking-widest uppercase text-tertiary border-b border-subtle">
            <span>Market</span>
            <span className="text-right">Yes</span>
            <span className="text-right">Δ</span>
          </div>
          {live.map((m, i) => (
            <div
              key={m.sym}
              className={`grid grid-cols-[1fr_70px_70px] gap-3 px-3.5 py-2.5 text-[13px] items-center ${
                i < live.length - 1 ? "border-b border-subtle" : ""
              }`}
            >
              <span className="text-primary truncate">{m.sym}</span>
              <span className="tabular-nums font-mono text-right text-primary">
                ¢
                {Math.round(m.px * 100)
                  .toString()
                  .padStart(2, "0")}
              </span>
              <span
                className={`tabular-nums font-mono text-right ${
                  m.chg >= 0 ? "text-gain-text" : "text-loss-text"
                }`}
              >
                {m.chg >= 0 ? "+" : ""}
                {m.chg.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface NodeProps {
  top: number;
  left: number;
  cat: "trigger" | "condition" | "action" | "safety";
  title: string;
  detail: string;
}

const NODE_COLORS: Record<NodeProps["cat"], string> = {
  trigger: "var(--accent-text)",
  condition: "var(--color-purple-400)",
  action: "var(--gain-text)",
  safety: "var(--warning)",
};

function CanvasNode({ top, left, cat, title, detail }: NodeProps) {
  const color = NODE_COLORS[cat];
  return (
    <div
      className="absolute w-[140px] bg-surface border border-default rounded-lg p-2 shadow-elevation-2"
      style={{ top, left, borderLeftWidth: 2, borderLeftColor: color }}
    >
      <div
        className="font-mono text-[9.5px] tracking-widest uppercase"
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

function BuilderCanvas() {
  return (
    <div className="relative bg-surface border border-subtle rounded-[14px] h-[440px] overflow-hidden builder-dot-grid">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-subtle bg-surface">
        <span className="font-mono text-[11px] text-secondary">
          momentum-α3.polyforge
        </span>
        <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded bg-elevated border border-subtle text-secondary text-[11px] font-medium">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gain"
            style={{ animation: "dot-pulse 2s ease-in-out infinite" }}
          />
          running · 42ms
        </span>
        <span className="ml-auto inline-flex items-center h-5 px-2 rounded bg-accent-subtle border border-accent-border text-accent-text text-[11px] font-medium">
          paper
        </span>
      </div>

      {/* SVG edges */}
      <svg
        width="100%"
        height={398}
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

      {/* Nodes */}
      <CanvasNode
        top={44}
        left={24}
        cat="trigger"
        title="price_above_tick"
        detail="YES ≥ 0.65"
      />
      <CanvasNode
        top={154}
        left={24}
        cat="trigger"
        title="volume_rate_tick"
        detail="vol > 10k/24h"
      />
      <CanvasNode
        top={110}
        left={310}
        cat="condition"
        title="max_position"
        detail="$500 · 5% port"
      />
      <CanvasNode
        top={40}
        left={580}
        cat="action"
        title="buy_yes"
        detail="GTC · Kelly"
      />
      <CanvasNode
        top={190}
        left={580}
        cat="action"
        title="set_stop_loss"
        detail="−8% trailing"
      />

      {/* Footer stats */}
      <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center font-mono text-[11px] text-tertiary">
        <span>blocks: 5 · edges: 4 · tick 200ms</span>
        <span>last fill · 00:12 · buy_yes 0.67 × $412</span>
      </div>
    </div>
  );
}

const VARIANT_ORDER: HeroVariant[] = ["terminal", "typography", "builder"];

export function Hero() {
  const [variant, setVariant] = useState<HeroVariant>("terminal");
  const copy = HEADLINES[variant];

  return (
    <section
      className="relative overflow-hidden border-b border-subtle"
      id="top"
      aria-labelledby="hero-heading"
    >
      {/* Background effects */}
      <div
        className="hero-glow absolute top-[-200px] left-1/2 -translate-x-1/2 pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="hero-grid-bg absolute inset-0 pointer-events-none z-0"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-8 py-20 md:py-28 lg:py-[112px] lg:pb-[120px]">
        <div className="grid grid-cols-1 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,55%)] items-center gap-12 min-[960px]:gap-14">
          {/* Text column */}
          <div className="flex flex-col items-start">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 h-6 px-2.5 rounded bg-accent-subtle border border-accent-border text-accent-text text-xs font-medium mb-6">
              <span
                className="w-1.5 h-1.5 rounded-full bg-gain"
                style={{ animation: "dot-pulse 2s ease-in-out infinite" }}
              />
              now in early access · v6.32
            </div>

            <h1
              id="hero-heading"
              className="text-[clamp(36px,5.2vw,60px)] font-semibold leading-[1.05] tracking-[-0.03em] text-primary"
            >
              {copy.h}
              <em className="not-italic text-secondary tracking-[-0.03em]">
                {copy.hEm}
              </em>
            </h1>

            <p className="text-[15px] text-secondary leading-relaxed max-w-[480px] mt-5 mb-7">
              {copy.sub}
            </p>

            <div className="flex gap-3 items-center flex-wrap">
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
              >
                start free
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </a>
              <a
                href="/api-docs"
                className="inline-flex items-center h-10 px-5 rounded-lg bg-transparent text-primary border border-default font-medium text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
              >
                read the docs
              </a>
            </div>

            <div className="flex gap-2.5 items-center mt-5 text-xs text-tertiary">
              No credit card · Paper trade unlimited · Polymarket builder
              program
            </div>

            {/* Variant switcher */}
            <div className="flex gap-1 mt-8">
              {VARIANT_ORDER.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={`h-6 px-2 rounded text-[11px] font-medium border transition-colors duration-micro ${
                    variant === v
                      ? "bg-accent-subtle border-accent-border text-accent-text"
                      : "bg-transparent border-subtle text-secondary hover:text-primary hover:border-default"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Visual column */}
          <div aria-hidden="true">
            {variant === "builder" ? <BuilderCanvas /> : <DashboardMock />}
          </div>
        </div>
      </div>
    </section>
  );
}
