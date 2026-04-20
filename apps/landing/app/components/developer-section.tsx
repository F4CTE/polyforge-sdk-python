"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { CODE_TOKENS } from "../data/landing-data";

const SDK_CHIPS = [
  "typescript sdk",
  "python sdk",
  "rust sdk",
  "mcp server",
  "openapi 3.1",
  "webhooks",
] as const;

const API_FEATURES = [
  {
    title: "Event streams",
    desc: "ORDER_FILLED, STRATEGY_PAUSED, BACKTEST_PROGRESS over WS.",
  },
  {
    title: "Strategy import/export",
    desc: "Every strategy is a .polyforge JSON document.",
  },
  {
    title: "MCP server",
    desc: "Let an agent prototype and deploy via natural language.",
  },
  {
    title: "Builder attribution",
    desc: "HMAC-signed headers on every order.",
  },
] as const;

const TOKEN_COLORS: Record<string, string> = {
  kw: "var(--accent-text)",
  str: "var(--color-purple-400)",
  cm: "var(--text-tertiary)",
  fn: "var(--color-cyan-300, var(--gain-text))",
  tx: "var(--text-primary)",
};

export function DeveloperSection() {
  const { ref: textRef, inView: textInView } = useInViewAnimation();
  const { ref: codeRef, inView: codeInView } = useInViewAnimation({
    threshold: 0.1,
  });

  return (
    <section
      className="py-20 md:py-28 bg-surface border-t border-subtle"
      id="developers"
      aria-labelledby="developer-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-10 lg:gap-[72px]">
          <div
            ref={textRef}
            className={`transition-all duration-600 ease-out ${
              textInView
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-6"
            }`}
          >
            <p className="text-label font-mono font-medium text-tertiary uppercase tracking-wider mb-3">
              04 · Developer API
            </p>
            <h2
              id="developer-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4"
            >
              Built for the API-first trader.
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[480px] mb-5">
              Everything in the product ships as REST, WebSocket, and MCP.
              TypeScript, Python, and Rust SDKs. Strategies are JSON you can
              version in git. Builder attribution baked into every order.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-6">
              {SDK_CHIPS.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-mono text-secondary bg-elevated border border-subtle rounded-sm"
                >
                  {label}
                </span>
              ))}
            </div>

            <ul className="flex flex-col gap-3 mb-6">
              {API_FEATURES.map(({ title, desc }) => (
                <li key={title} className="flex gap-2.5 items-start text-sm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-accent-text mt-0.5 shrink-0"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    <strong className="text-primary font-medium">
                      {title}.
                    </strong>{" "}
                    <span className="text-secondary">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <a
              href="/api-docs"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
            >
              Read the API docs
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
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </a>
          </div>

          <div
            ref={codeRef}
            style={{ transitionDelay: "80ms" }}
            className={`transition-all duration-600 ease-out ${
              codeInView
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-6"
            }`}
          >
            <div
              className="bg-elevated border border-default rounded-lg overflow-hidden"
              aria-label="TypeScript SDK code example"
            >
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-default bg-surface">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-loss/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gain/60" />
                </div>
                <span className="ml-2 font-mono text-caption text-tertiary">
                  strategy-watcher.ts
                </span>
                <button
                  className="ml-auto p-1 text-tertiary hover:text-primary transition-colors duration-micro rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                  aria-label="Copy code"
                  type="button"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
              <pre className="p-4 text-body-sm font-mono leading-6 overflow-x-auto">
                <code>
                  {CODE_TOKENS.map(({ line, tokens }) => (
                    <div key={line} className="flex">
                      <span className="w-8 shrink-0 text-right pr-4 text-tertiary select-none text-label">
                        {line}
                      </span>
                      <span>
                        {tokens.map((tok, i) => (
                          <span
                            key={i}
                            style={{ color: TOKEN_COLORS[tok.cls] }}
                          >
                            {tok.text || "\u00A0"}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-caption px-1">
              <span className="text-tertiary">
                $ npm install @polyforge/sdk
              </span>
              <span className="text-gain-text">✓ v1.4.2 · 18kb gzipped</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
