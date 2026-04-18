import { Check } from "lucide-react";
import { WHALES } from "../data/landing-data";

function WhaleFeed() {
  return (
    <div
      className="bg-surface border border-subtle rounded-xl overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="grid items-center gap-2 px-4 py-2 text-[9px] font-mono font-medium uppercase tracking-widest text-tertiary border-b border-subtle"
        style={{
          gridTemplateColumns: "28px 1fr 72px 56px 64px 40px",
          background: "color-mix(in srgb, var(--text-primary) 3%, transparent)",
        }}
      >
        <span />
        <span>Wallet · Market</span>
        <span>Side</span>
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">t</span>
      </div>

      {WHALES.map((w) => (
        <div
          key={w.wallet + w.t}
          className="grid items-center gap-2 px-4 py-3 border-b border-subtle"
          style={{
            gridTemplateColumns: "28px 1fr 72px 56px 64px 40px",
            background:
              w.tone === "gain"
                ? "color-mix(in srgb, var(--gain) 4%, transparent)"
                : "color-mix(in srgb, var(--loss) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-semibold font-mono"
            style={{
              color: `var(--${w.tone})`,
              background: `color-mix(in srgb, var(--${w.tone}) 15%, transparent)`,
              border: `0.5px solid color-mix(in srgb, var(--${w.tone}) 30%, transparent)`,
            }}
          >
            {w.init}
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs text-primary">{w.wallet}</div>
            <div className="text-[11px] text-tertiary truncate">{w.market}</div>
          </div>
          <span
            className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium w-fit"
            style={{
              color: `var(--${w.tone})`,
              background: `color-mix(in srgb, var(--${w.tone}) 10%, transparent)`,
            }}
          >
            {w.side}
          </span>
          <span className="font-mono text-xs text-primary tabular-nums">
            ¢{Math.round(parseFloat(w.px) * 100)}
          </span>
          <span className="font-mono text-xs text-primary tabular-nums text-right">
            {w.size}
          </span>
          <span className="font-mono text-[11px] text-tertiary text-right">
            {w.t}
          </span>
        </div>
      ))}

      <div className="flex items-center gap-2 px-4 py-3 bg-subtle border-t border-subtle text-xs">
        <span className="font-mono text-[10px] text-tertiary uppercase tracking-widest">
          copy mode
        </span>
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono text-accent-text bg-[color-mix(in_srgb,var(--accent-default)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent-default)_20%,transparent)]">
          kelly
        </span>
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono text-tertiary bg-[color-mix(in_srgb,var(--accent-default)_6%,transparent)] border border-[color-mix(in_srgb,var(--accent-default)_12%,transparent)]">
          proportional
        </span>
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono text-tertiary bg-[color-mix(in_srgb,var(--accent-default)_6%,transparent)] border border-[color-mix(in_srgb,var(--accent-default)_12%,transparent)]">
          fixed
        </span>
        <span className="ml-auto font-mono text-[11px] text-tertiary">
          42 wallets · alerts on
        </span>
      </div>
    </div>
  );
}

export function WhaleSection() {
  return (
    <section className="py-20 md:py-28 border-t border-subtle" id="whales">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-10 lg:gap-[72px]">
          <div className="order-last lg:order-first overflow-x-auto">
            <div className="min-w-[480px]">
              <WhaleFeed />
            </div>
          </div>
          <div className="order-first lg:order-last">
            <p className="text-label font-medium text-accent-text uppercase tracking-wider font-mono mb-4">
              02 · Whale intelligence
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4">
              Follow the smart money.
            </h2>
            <p className="text-base text-secondary leading-relaxed max-w-[520px] mb-6">
              Real-time wallet tracking on every Polymarket address. Mirror
              trades with{" "}
              <strong className="text-primary font-medium">Fixed</strong>,{" "}
              <strong className="text-primary font-medium">Proportional</strong>
              , or{" "}
              <strong className="text-primary font-medium">Kelly</strong>{" "}
              sizing. Alerts hit Telegram, Discord, or webhook before they hit
              X.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                "Track any number of wallets",
                "One-click copy with your own sizing",
                "Full P&L attribution per mirrored wallet",
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
        </div>
      </div>
    </section>
  );
}
