"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Nav } from "../components/nav";
import { Footer } from "../components/footer";
import type { Metadata } from "next";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started with paper trading and basic analytics.",
    features: [
      "3 active strategies",
      "Paper trading",
      "Basic analytics",
      "Community support",
    ],
    cta: "Start free",
    ctaHref: "/register",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 23,
    description: "Unlimited strategies, live trading, and advanced tools.",
    features: [
      "Unlimited strategies",
      "Live trading execution",
      "Whale tracker",
      "API access",
      "AI trade signals",
      "Priority support",
    ],
    cta: "Start Pro",
    ctaHref: "/register?plan=pro",
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    annualPrice: null,
    description: "Custom limits and dedicated support for power users.",
    features: [
      "Everything in Pro",
      "Custom strategy limits",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Onboarding call",
    ],
    cta: "Contact us",
    ctaHref: "mailto:enterprise@polyforge.app",
    recommended: false,
  },
] as const;

const FAQS = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time from your account settings. Upgrades take effect immediately; downgrades apply at the start of the next billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, Amex) via Stripe. Annual plans are billed once per year.",
  },
  {
    question: "Is there a free trial for Pro?",
    answer:
      "Pro includes a 14-day free trial — no credit card required. After the trial, you'll be asked to add a payment method to continue.",
  },
  {
    question: "What markets can I trade on?",
    answer:
      "Polyforge connects directly to Polymarket. We are evaluating additional prediction market integrations and will announce them to Pro subscribers first.",
  },
  {
    question: "How does paper trading work?",
    answer:
      "Paper trading simulates live market conditions using real-time Polymarket data without placing actual orders. It's ideal for testing strategies before committing capital.",
  },
  {
    question: "What is the Whale Tracker?",
    answer:
      "Whale Tracker monitors large-position market participants on Polymarket and sends you real-time alerts when they move. Available on Pro and above.",
  },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function BillingToggle({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label="Billing period">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm ${
          !annual ? "text-primary" : "text-secondary hover:text-primary"
        }`}
        aria-pressed={!annual}
      >
        Monthly
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={annual}
        onClick={() => onChange(!annual)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text ${
          annual ? "bg-accent" : "bg-elevated"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 translate-y-0 rounded-full bg-primary shadow-sm transition-transform duration-micro ${
            annual ? "translate-x-4" : "translate-x-0"
          }`}
        />
        <span className="sr-only">Toggle annual billing</span>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm ${
            annual ? "text-primary" : "text-secondary hover:text-primary"
          }`}
          aria-pressed={annual}
        >
          Annual
        </button>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-semibold bg-accent/[0.12] text-accent-text border border-accent/20">
          Save 20%
        </span>
      </div>
    </div>
  );
}

function PricingCard({
  tier,
  annual,
}: {
  tier: (typeof TIERS)[number];
  annual: boolean;
}) {
  const price = annual ? tier.annualPrice : tier.monthlyPrice;
  const isRecommended = tier.recommended;

  return (
    <div
      className={`relative flex flex-col rounded-lg p-6 ${
        isRecommended
          ? "border border-accent/40 bg-accent/[0.03]"
          : "bg-surface border border-subtle"
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-accent text-inverse">
            Recommended
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-semibold text-primary">{tier.name}</h3>
        <p className="mt-1 text-sm text-secondary">{tier.description}</p>
      </div>

      <div className="mb-6">
        {price !== null ? (
          <div className="flex items-end gap-1">
            <span className="text-4xl font-semibold font-mono tabular-nums text-primary">
              ${price}
            </span>
            <span className="text-sm text-secondary mb-1.5">/mo</span>
          </div>
        ) : (
          <span className="text-4xl font-semibold font-mono tabular-nums text-primary">
            Custom
          </span>
        )}
        {annual && price !== null && price > 0 && (
          <p className="mt-1 text-xs text-tertiary">
            Billed annually (${price * 12}/yr)
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-2 mb-8 flex-1" role="list">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check
              size={14}
              strokeWidth={2.5}
              className="text-accent-text shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm text-secondary">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={tier.ctaHref}
        className={`inline-flex w-full items-center justify-center rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text ${
          isRecommended
            ? "bg-accent hover:bg-accent-hover text-inverse"
            : "bg-transparent border border-subtle text-secondary hover:text-primary hover:bg-elevated"
        }`}
      >
        {tier.cta}
      </a>
    </div>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group border-b border-subtle last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          size={16}
          strokeWidth={2}
          className="shrink-0 text-tertiary transition-transform duration-micro group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <p className="pb-4 text-sm text-secondary leading-relaxed">{answer}</p>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <Nav />
      <main id="main-content">
        {/* Hero */}
        <section
          className="py-20 md:py-28 text-center"
          aria-labelledby="pricing-heading"
        >
          <div className="max-w-container-landing mx-auto px-6">
            <h1
              id="pricing-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-primary mb-4"
            >
              Simple, transparent pricing
            </h1>
            <p className="text-base text-secondary max-w-[480px] mx-auto mb-8 leading-relaxed">
              Start free. Scale when you're ready.
            </p>
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>
        </section>

        {/* Pricing grid */}
        <section aria-label="Pricing tiers">
          <div className="max-w-container-landing mx-auto px-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {TIERS.map((tier) => (
                <PricingCard key={tier.id} tier={tier} annual={annual} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 border-t border-subtle" aria-labelledby="faq-heading">
          <div className="max-w-content-md mx-auto px-6">
            <h2
              id="faq-heading"
              className="text-2xl font-semibold text-primary mb-10 text-center"
            >
              Frequently asked questions
            </h2>
            <div role="list">
              {FAQS.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
