"use client";

import { useInViewAnimation } from "../hooks/use-in-view-animation";

const SDK_LINKS = [
  { label: "TypeScript SDK", href: "/docs/sdk/typescript" },
  { label: "Python SDK", href: "/docs/sdk/python" },
  { label: "Rust SDK", href: "/docs/sdk/rust" },
  { label: "MCP Server", href: "/docs/mcp" },
] as const;

export function DeveloperSection() {
  const { ref: textRef, inView: textInView } = useInViewAnimation();
  const { ref: codeRef, inView: codeInView } = useInViewAnimation({ threshold: 0.1 });

  return (
    <section
      className="py-20 sm:py-28 border-t border-subtle bg-surface"
      aria-labelledby="developer-heading"
    >
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20">
          <div
            ref={textRef}
            className={`transition-all duration-600 ease-out ${
              textInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
            }`}
          >
            <p className="text-label font-medium text-accent-text uppercase tracking-wider mb-4">
              Developer API
            </p>
            <h2
              id="developer-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4"
            >
              Built for the API-first trader.
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[480px] mb-8">
              Every platform feature available via REST API. Integrate PolyForge
              into your bots, dashboards, and workflows. SDKs in 3 languages.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {SDK_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-secondary bg-elevated border border-subtle rounded-sm hover:border-accent/25 hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                >
                  {label}
                </a>
              ))}
            </div>

            <a
              href="/api-docs"
              className="text-body-md font-medium text-accent-text hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
            >
              View API docs →
            </a>
          </div>

          <div
            ref={codeRef}
            style={{ transitionDelay: "80ms" }}
            className={`bg-elevated border border-default rounded-lg overflow-hidden transition-all duration-600 ease-out ${
              codeInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
            }`}
            aria-label="TypeScript SDK code example"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-subtle">
              <span className="w-2.5 h-2.5 rounded-full bg-loss opacity-60" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning opacity-60" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-gain opacity-60" aria-hidden="true" />
              <span className="ml-3 text-label font-mono text-tertiary">strategy-watcher.ts</span>
            </div>

            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span style={{ color: "var(--text-tertiary)" }}>{"// TypeScript\n"}</span>
                <span style={{ color: "var(--accent-text)" }}>{"import "}</span>
                <span style={{ color: "var(--text-primary)" }}>{"{ PolyforgeClient } "}</span>
                <span style={{ color: "var(--accent-text)" }}>{"from"}</span>
                <span style={{ color: "var(--color-purple-400)" }}>{" '@polyforge/sdk';\n\n"}</span>
                <span style={{ color: "var(--accent-text)" }}>{"const "}</span>
                <span style={{ color: "var(--text-primary)" }}>{"client = "}</span>
                <span style={{ color: "var(--accent-text)" }}>{"new "}</span>
                <span style={{ color: "var(--color-cyan-300)" }}>{"PolyforgeClient"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"({\n"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"  apiKey: "}</span>
                <span style={{ color: "var(--color-purple-400)" }}>{"process.env.POLYFORGE_KEY\n"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"});\n\n"}</span>
                <span style={{ color: "var(--accent-text)" }}>{"for await "}</span>
                <span style={{ color: "var(--text-primary)" }}>{"(const event "}</span>
                <span style={{ color: "var(--accent-text)" }}>{"of\n"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"  client."}</span>
                <span style={{ color: "var(--color-cyan-300)" }}>{"watchStrategy"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"(strategyId)) {\n"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"  console."}</span>
                <span style={{ color: "var(--color-cyan-300)" }}>{"log"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"(event.type, event.payload);\n"}</span>
                <span style={{ color: "var(--text-primary)" }}>{"}"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
