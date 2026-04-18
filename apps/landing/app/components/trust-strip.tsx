"use client";

import { Key, Lock, Shield, Check } from "lucide-react";
import { useInViewAnimation } from "../hooks/use-in-view-animation";
import { TRUST_ITEMS } from "../data/landing-data";

const ICON_MAP = {
  key: Key,
  lock: Lock,
  shield: Shield,
  check: Check,
} as const;

export function TrustStrip() {
  const { ref, inView } = useInViewAnimation<HTMLDivElement>({
    threshold: 0.15,
  });

  return (
    <section className="bg-surface border-t border-b border-subtle">
      <div className="max-w-container-landing mx-auto px-6 py-14">
        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-subtle rounded-xl overflow-hidden bg-subtle"
          style={{ gap: 1 }}
        >
          {TRUST_ITEMS.map((item, i) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <div
                key={item.title}
                style={{ transitionDelay: inView ? `${i * 80}ms` : "0ms" }}
                className={`bg-surface p-5 flex flex-col gap-2 transition-all duration-500 ease-out ${
                  inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3"
                }`}
              >
                <Icon
                  size={18}
                  className="text-accent-text"
                  aria-hidden="true"
                />
                <div className="text-sm font-semibold text-primary">
                  {item.title}
                </div>
                <div className="text-xs text-secondary leading-relaxed">
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
