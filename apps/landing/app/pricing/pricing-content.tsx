"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const TIERS = [
  {
    name: "Free",
    description: "Paper trade and learn the ropes",
    monthlyPrice: 0,
    annualPrice: 0,
    cta: "Get started",
    ctaHref: "/register",
    recommended: false,
    features: [
      "3 active strategies",
      "Paper trading only",
      "Basic analytics dashboard",
      "Community support",
      "Strategy import/export",
    ],
  },
  {
    name: "Pro",
    description: "For serious traders who want an edge",
    monthlyPrice: 29,
    annualPrice: 23,
    cta: "Start free trial",
    ctaHref: "/register?plan=pro",
    recommended: true,
    features: [
      "Unlimited strategies",
      "Live 24/7 automated trading",
      "Whale tracker & alerts",
      "Full API access",
      "Advanced analytics & backtesting",
      "Priority support",
      "Strategy marketplace access",
      "Custom notifications",
    ],
  },
  {
    name: "Enterprise",
    description: "For institutions and funds",
    monthlyPrice: null,
    annualPrice: null,
    cta: "Contact sales",
    ctaHref: "mailto:enterprise@polyforge.app",
    recommended: false,
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "Custom rate limits",
      "SLA & uptime guarantee",
      "SSO / SAML integration",
      "Audit logs",
      "Custom integrations",
      "On-call engineering support",
    ],
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. Upgrade or downgrade at any time. When upgrading, you only pay the prorated difference. When downgrading, the remaining credit is applied to your next billing cycle.",
  },
  {
    question: "What happens when my free trial ends?",
    answer:
      "Your Pro trial lasts 14 days. After that, you'll be moved to the Free tier automatically — no charge. Your strategies are preserved but paused if they exceed the Free tier limits.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a full refund within the first 7 days of any paid subscription. After that, you can cancel anytime and retain access until the end of your billing period.",
  },
  {
    question: "Is my trading data secure?",
    answer:
      "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We never store your exchange API secrets in plaintext. Enterprise plans include additional audit logging and compliance features.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards via Stripe. Enterprise customers can pay by invoice with net-30 terms.",
  },
  {
    question: "Can I use the API on the Free plan?",
    answer:
      "API access is available on Pro and Enterprise plans only. The Free plan includes the full web interface for building, backtesting, and paper trading strategies.",
  },
];

function BillingToggle({
  isAnnual,
  onToggle,
}: {
  isAnnual: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span
        className={`text-sm ${!isAnnual ? "text-primary font-medium" : "text-secondary"}`}
      >
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        aria-label="Toggle annual billing"
        onClick={onToggle}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-subtle bg-elevated transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-accent shadow-sm transition-transform duration-150 ${
            isAnnual ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span
        className={`text-sm ${isAnnual ? "text-primary font-medium" : "text-secondary"}`}
      >
        Annual
      </span>
      {isAnnual && (
        <span className="inline-flex items-center h-5 px-2 rounded text-[11px] font-medium bg-accent/10 text-accent-text border border-accent/20">
          Save 20%
        </span>
      )}
    </div>
  );
}

function PricingCard({
  tier,
  isAnnual,
}: {
  tier: (typeof TIERS)[number];
  isAnnual: boolean;
}) {
  const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
  const isCustom = price === null;

  return (
    <div
      className={`flex flex-col rounded-lg p-6 ${
        tier.recommended
          ? "border border-accent/40 bg-accent/[0.03] ring-1 ring-accent/10"
          : "border border-subtle bg-surface"
      }`}
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-semibold text-primary">{tier.name}</h3>
          {tier.recommended && (
            <span className="inline-flex items-center h-5 px-2 rounded text-[11px] font-medium bg-accent/10 text-accent-text border border-accent/20">
              Recommended
            </span>
          )}
        </div>
        <p className="text-sm text-secondary">{tier.description}</p>
      </div>

      <div className="mb-6">
        {isCustom ? (
          <span className="text-4xl font-semibold font-mono tabular-nums text-primary">
            Custom
          </span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold font-mono tabular-nums text-primary">
              ${price}
            </span>
            <span className="text-sm text-secondary">/mo</span>
          </div>
        )}
        {!isCustom && isAnnual && price !== null && price > 0 && (
          <p className="text-xs text-tertiary mt-1">
            ${price * 12}/year — billed annually
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-2 mb-8 flex-1" role="list">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check
              size={14}
              strokeWidth={2}
              className="text-accent-text mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm text-secondary">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={tier.ctaHref}
        className={`inline-flex items-center justify-center w-full h-9 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text ${
          tier.recommended
            ? "bg-accent text-white hover:bg-accent-hover"
            : "bg-transparent text-primary border border-default hover:bg-elevated"
        }`}
      >
        {tier.cta}
      </a>
    </div>
  );
}

function FaqSection() {
  return (
    <section
      className="max-w-[680px] mx-auto mt-20 md:mt-28"
      aria-labelledby="faq-heading"
    >
      <h2
        id="faq-heading"
        className="text-display-sm font-semibold text-primary mb-8"
      >
        Frequently asked questions
      </h2>
      <div className="divide-y divide-subtle">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group">
            <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer text-sm font-medium text-primary hover:text-accent-text transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="text-secondary shrink-0 transition-transform duration-150 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-4 text-sm text-secondary leading-relaxed">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function PricingContent() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section className="py-20 md:py-28" aria-labelledby="pricing-heading">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="text-center mb-12">
          <h1
            id="pricing-heading"
            className="text-display-lg font-semibold text-primary mb-3"
          >
            Simple, transparent pricing
          </h1>
          <p className="text-body-lg text-secondary max-w-[480px] mx-auto mb-8">
            Start free. Upgrade when you're ready to trade live.
          </p>
          <BillingToggle
            isAnnual={isAnnual}
            onToggle={() => setIsAnnual((prev) => !prev)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[960px] mx-auto">
          {TIERS.map((tier) => (
            <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual} />
          ))}
        </div>

        <FaqSection />
      </div>
    </section>
  );
}
