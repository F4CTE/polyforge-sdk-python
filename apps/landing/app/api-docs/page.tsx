import type { Metadata } from "next";
import { Nav } from "../components/nav";
import { Footer } from "../components/footer";

export const metadata: Metadata = {
  title: "API Documentation — Polyforge",
  description:
    "REST API reference, SDK guides, and MCP Server docs for building automated trading strategies on Polymarket with Polyforge.",
};

const SDK_CARDS = [
  {
    id: "typescript",
    label: "TypeScript SDK",
    install: "npm install @polyforge/sdk",
    description:
      "Typed client for Node.js and browser. Stream strategy events, place orders, and query positions with full IntelliSense support.",
    href: "https://www.npmjs.com/package/@polyforge/sdk",
    external: true,
  },
  {
    id: "python",
    label: "Python SDK",
    install: "pip install polyforge",
    description:
      "Async-first Python library. Native asyncio support, Pydantic models for all responses, and a sync wrapper for scripts.",
    href: "https://pypi.org/project/polyforge",
    external: true,
  },
  {
    id: "rust",
    label: "Rust SDK",
    install: "cargo add polyforge",
    description:
      "Zero-cost abstractions for high-frequency bots. Tokio-native, strongly typed, with optional WASM compilation target.",
    href: "https://crates.io/crates/polyforge",
    external: true,
  },
  {
    id: "mcp",
    label: "MCP Server",
    install: "npx @polyforge/mcp-server",
    description:
      "Connect Polyforge to any MCP-compatible AI agent. Expose strategies, positions, and market data as model context.",
    href: "https://www.npmjs.com/package/@polyforge/mcp-server",
    external: true,
  },
] as const;

function SdkCard({ card }: { card: (typeof SDK_CARDS)[number] }) {
  return (
    <div className="flex flex-col rounded-lg border border-subtle bg-elevated p-6 hover:border-accent/25 transition-colors duration-micro">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-text mb-3">
        {card.label}
      </p>

      <pre className="text-xs font-mono text-secondary bg-app border border-subtle rounded-sm px-3 py-2 mb-4 overflow-x-auto">
        {card.install}
      </pre>

      <p className="text-sm text-secondary leading-relaxed flex-1 mb-5">
        {card.description}
      </p>

      <a
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-accent-text hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
      >
        View docs →<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <>
      <Nav />
      <main id="main-content">
        {/* Hero */}
        <section
          className="py-20 md:py-28 border-b border-subtle"
          aria-labelledby="api-docs-heading"
        >
          <div className="max-w-container-landing mx-auto px-6">
            <p className="text-label font-medium text-accent-text uppercase tracking-wider mb-4">
              Developer API
            </p>
            <h1
              id="api-docs-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-primary tracking-tight mb-4 max-w-2xl"
            >
              API Documentation
            </h1>
            <p className="text-base text-secondary leading-relaxed max-w-[560px] mb-8">
              Every Polyforge feature is available via REST API. Build bots,
              integrate dashboards, and automate strategies using SDKs in
              TypeScript, Python, and Rust — or connect any AI agent via MCP.
            </p>
            <div className="flex flex-wrap gap-2">
              {SDK_CARDS.map(({ id, label, href }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-sm text-secondary bg-elevated border border-subtle rounded-sm hover:border-accent/25 hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                >
                  {label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* SDK cards */}
        <section
          className="py-20 border-b border-subtle"
          aria-labelledby="sdk-heading"
        >
          <div className="max-w-container-landing mx-auto px-6">
            <h2
              id="sdk-heading"
              className="text-xl font-semibold text-primary mb-2"
            >
              SDKs &amp; integrations
            </h2>
            <p className="text-sm text-secondary mb-8">
              Official libraries maintained by the Polyforge team.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SDK_CARDS.map((card) => (
                <SdkCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>

        {/* REST reference — coming soon */}
        <section
          className="py-20"
          aria-labelledby="reference-heading"
        >
          <div className="max-w-container-landing mx-auto px-6">
            <div className="rounded-lg border border-subtle bg-surface p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8">
              <div className="flex-1">
                <p className="text-label font-medium text-accent-text uppercase tracking-wider mb-3">
                  REST Reference
                </p>
                <h2
                  id="reference-heading"
                  className="text-2xl font-semibold text-primary mb-3"
                >
                  Interactive reference coming soon
                </h2>
                <p className="text-sm text-secondary leading-relaxed max-w-[480px]">
                  A full interactive API reference (Scalar UI) is in progress.
                  In the meantime, explore the SDK docs above or use the base
                  URL{" "}
                  <code className="font-mono text-xs text-accent-text bg-elevated border border-subtle rounded-sm px-1.5 py-0.5">
                    https://api.polyforge.app/v1
                  </code>{" "}
                  with your API key from the dashboard.
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-3">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-pf bg-accent text-inverse hover:bg-accent-text transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                >
                  Get API key
                </a>
                <a
                  href="https://discord.gg/polyforge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-pf border border-subtle text-secondary hover:text-primary hover:bg-elevated transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                >
                  Ask in Discord
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
