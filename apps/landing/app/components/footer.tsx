"use client";

import { PolyforgeLogomark } from "@polyforge/ui";
import { FOOTER_LINKS } from "../data/landing-data";

const SOCIAL_ICONS: { label: string; href: string; letter: string }[] = [
  { label: "Follow on X", href: "https://twitter.com/polyforge", letter: "X" },
  { label: "Join Discord", href: "https://discord.gg/polyforge", letter: "D" },
  {
    label: "Join Telegram",
    href: "https://t.me/polyforge",
    letter: "T",
  },
  {
    label: "GitHub",
    href: "https://github.com/polyforge",
    letter: "G",
  },
];

export function Footer() {
  return (
    <footer className="bg-surface border-t border-subtle pt-14 pb-8">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-14">
          {/* Brand column — spans 2 cols on md+ */}
          <div className="col-span-2">
            <a
              href="#top"
              className="inline-flex items-center gap-2 text-base font-semibold text-primary mb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
              aria-label="Polyforge home"
            >
              <PolyforgeLogomark size={22} className="text-accent-text" />
              <span>polyforge</span>
            </a>
            <p className="text-[13px] text-tertiary mt-3 max-w-[280px] leading-relaxed">
              Algorithmic trading for prediction markets. Dark by default.
              Precise by design.
            </p>
            <div className="flex gap-1.5 mt-5">
              {SOCIAL_ICONS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="w-8 h-8 rounded-sm border border-subtle flex items-center justify-center text-xs font-mono text-tertiary hover:text-accent-text hover:border-accent/30 transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
                >
                  {s.letter}
                </a>
              ))}
            </div>
            <div className="font-mono text-[11px] text-tertiary mt-7 tracking-wide leading-relaxed">
              v6.32.0 · eu-west-2
              <br />
              builder program · tier 3
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col) => (
            <nav key={col.title} aria-label={`${col.title} links`}>
              <p className="text-xs font-medium text-primary mb-4">
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((label) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="text-[13px] text-secondary hover:text-primary transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-subtle flex justify-between items-center flex-wrap gap-4 font-mono text-xs text-tertiary">
          <span>
            © 2026 Polyforge · Algorithmic trading involves risk of loss.
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-gain animate-[dot-pulse_2s_ease-in-out_infinite]"
              aria-hidden="true"
            />
            all systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
