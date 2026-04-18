import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Nav } from "../components/nav";

const Footer = dynamic(() =>
  import("../components/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Terms of Service — Polyforge",
  description:
    "Read the Polyforge Terms of Service. Understand your rights and responsibilities when using the Polyforge algorithmic trading platform.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "April 16, 2026";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-b border-subtle py-10 last:border-b-0">
      <h2 className="text-display-sm font-semibold text-primary mb-4">
        {title}
      </h2>
      <div className="text-body-md text-secondary leading-[1.75] space-y-4">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-display-lg text-primary">Terms of Service</h1>
          <p className="text-label text-tertiary mt-2 mb-10">
            Last updated: {LAST_UPDATED}
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using Polyforge (&ldquo;the Platform&rdquo;,
              &ldquo;we&rdquo;, &ldquo;our&rdquo;), you agree to be bound by
              these Terms of Service and our Privacy Policy. If you do not
              agree to these terms, do not use the Platform.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Polyforge is an algorithmic trading platform that allows users to
              build, backtest, and deploy automated trading strategies on
              prediction markets. The Platform provides data, tooling, and
              execution infrastructure. It does not provide financial advice.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least 18 years old and legally permitted to
              participate in prediction markets in your jurisdiction to use the
              Platform. By creating an account you represent and warrant that
              you meet these requirements.
            </p>
          </Section>

          <Section title="4. Accounts and Security">
            <p>
              You are responsible for maintaining the confidentiality of your
              credentials. You agree to notify us immediately of any
              unauthorized use of your account. Polyforge is not liable for
              losses arising from unauthorized account access where you have
              not reported the issue promptly.
            </p>
            <p>
              Polyforge is currently in open beta. Any eligible user may
              register and gain immediate access to the Platform upon email
              verification. We reserve the right to suspend or terminate
              accounts that violate these Terms.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                Use the Platform for any unlawful purpose or in violation of
                any regulations;
              </li>
              <li>
                Attempt to circumvent rate limits, access controls, or security
                measures;
              </li>
              <li>
                Scrape, reverse-engineer, or reproduce any part of the Platform
                without written consent;
              </li>
              <li>
                Submit strategies designed to manipulate markets or harm other
                users;
              </li>
              <li>Share your account credentials with third parties.</li>
            </ul>
          </Section>

          <Section title="6. Trading Risks">
            <p>
              Prediction market trading involves substantial risk of loss. Past
              strategy performance is not indicative of future results. The
              Platform provides no guarantee of profit, and you may lose some
              or all of the funds you deploy. You trade at your own risk.
            </p>
            <p>
              Automated strategies may continue to place orders without your
              active supervision. You are solely responsible for monitoring
              your strategies and the positions they create.
            </p>
          </Section>

          <Section title="7. Copy Trading">
            <p>
              When you enable copy trading for a strategy, other users may
              allocate funds to automatically replicate your trades. You do not
              have fiduciary duties to copiers; you may modify or stop your
              strategy at any time. Copiers are solely responsible for their
              own risk management and fund allocation.
            </p>
            <p>
              By publishing a strategy for copy trading, you consent to your
              username, strategy name, and historical performance being visible
              to other Platform users.
            </p>
          </Section>

          <Section title="8. API Access">
            <p>
              API keys issued through the Platform grant programmatic access to
              your account. You are responsible for securing your API keys. Do
              not share them in public repositories, chat channels, or
              client-side code. Compromised keys should be revoked immediately
              from your Settings page.
            </p>
            <p>
              We reserve the right to rate-limit or revoke API access that
              degrades Platform performance or violates the acceptable-use
              policy.
            </p>
          </Section>

          <Section title="9. Intellectual Property">
            <p>
              You retain ownership of the strategies you create. By publishing
              a strategy as public or community-visible, you grant Polyforge
              and other users a non-exclusive license to view, fork, and learn
              from your strategy under the terms of the Platform&rsquo;s
              community sharing features.
            </p>
            <p>
              All Platform software, design, trademarks, and content are owned
              by Polyforge and may not be used without explicit permission.
            </p>
          </Section>

          <Section title="10. Fees and Payments">
            <p>
              Current Platform access is provided free of charge during the
              early-access beta. Fee structures, if introduced, will be
              communicated with at least 30 days&rsquo; notice.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              We reserve the right to suspend or terminate accounts that
              violate these terms, without prior notice. You may delete your
              account at any time from the Settings page.
            </p>
          </Section>

          <Section title="12. Disclaimers">
            <p className="uppercase text-label tracking-wide">
              THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF
              ANY KIND. POLYFORGE MAKES NO WARRANTIES, EXPRESS OR IMPLIED,
              INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, OR NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED
              OR ERROR-FREE OPERATION.
            </p>
          </Section>

          <Section title="13. Limitation of Liability">
            <p className="uppercase text-label tracking-wide">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, POLYFORGE SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR DATA, ARISING FROM
              YOUR USE OF THE PLATFORM.
            </p>
          </Section>

          <Section title="14. Governing Law">
            <p>
              These terms shall be governed by the laws of the jurisdiction in
              which Polyforge is incorporated, without regard to
              conflict-of-law principles.
            </p>
          </Section>

          <Section title="15. Changes to Terms">
            <p>
              We may update these terms at any time. Continued use of the
              Platform after changes are posted constitutes acceptance of the
              revised terms. We will notify registered users of material
              changes by email.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              For questions about these terms, contact us at{" "}
              <a
                href="mailto:legal@polyforge.app"
                className="text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
              >
                legal@polyforge.app
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}
