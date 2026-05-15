import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Nav } from "../components/nav";

const Footer = dynamic(() =>
  import("../components/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Privacy Policy — Polyforge",
  description:
    "Learn how Polyforge collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "April 15, 2026";

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

function SubSection({ title, children }: SectionProps) {
  return (
    <div className="mt-4">
      <h3 className="text-heading font-semibold text-primary mb-2">{title}</h3>
      {children}
    </div>
  );
}

const linkClass =
  "text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm";

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-display-lg font-semibold text-primary">
            Privacy Policy
          </h1>
          <p className="text-label text-tertiary mt-2 mb-10">
            Effective date: {LAST_UPDATED} &middot; Last updated: {LAST_UPDATED}
          </p>

          {/* 1 */}
          <Section title="1. Introduction and Scope">
            <p>
              PolyForge, Inc. (&ldquo;PolyForge,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the PolyForge
              platform&nbsp;&mdash; a SaaS strategy automation tool for
              Polymarket prediction markets. This Privacy Policy explains what
              personal data we collect about you and why, how we use, store, and
              protect it, how long we keep it, who we share it with, and what
              rights you have over your data.
            </p>
            <p>
              This Policy applies to all users of the PolyForge website,
              platform, APIs, and associated services (collectively, the
              &ldquo;Service&rdquo;), regardless of where you are located.
            </p>
            <p>
              <strong className="font-semibold text-primary">
                Users in the EEA, UK, and Switzerland
              </strong>{" "}
              benefit from additional rights and protections under GDPR and
              applicable national laws (see Sections 6, 14, and 17).{" "}
              <strong className="font-semibold text-primary">
                California residents
              </strong>{" "}
              have additional rights under the CCPA/CPRA (see Section 15).
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Data Controller Information">
            <p>
              For the purposes of GDPR and comparable data protection laws, the
              data controller is{" "}
              <strong className="font-semibold text-primary">
                PolyForge, Inc.
              </strong>{" "}
              Legal contact:{" "}
              <a href="mailto:legal@polyforge.io" className={linkClass}>
                legal@polyforge.io
              </a>
            </p>
          </Section>

          {/* 3 */}
          <Section title="3. Data Protection Officer">
            <p>
              PolyForge has designated a Data Protection Officer (DPO) to
              oversee our data protection strategy and compliance. DPO contact:{" "}
              <a href="mailto:dpo@polyforge.io" className={linkClass}>
                dpo@polyforge.io
              </a>
            </p>
            <p>
              EEA and UK users may contact the DPO directly for any
              privacy-related concern. We aim to respond within 72 hours for
              urgent matters and within 30 days for all formal requests.
            </p>
          </Section>

          {/* 4 */}
          <Section title="4. Data We Collect">
            <SubSection title="4.1 Account and Identity Data">
              <p>
                Email address, username/display name, bcrypt password hash,
                account creation date, and account status. Plaintext passwords
                are never retained.
              </p>
            </SubSection>
            <SubSection title="4.2 Usage and Behavioural Data">
              <p>
                Server-side log data (IP address, timestamps, HTTP method/path,
                response codes, user-agent), session tokens in encrypted
                cookies, feature usage events, and error/crash reports. This
                data is collected via server-side logs and does not include
                third-party analytics trackers.
              </p>
            </SubSection>
            <SubSection title="4.3 Trading Strategy Data">
              <p>
                Strategy configurations, backtest inputs and results, paper
                trade history, live order history, and bot execution logs.
                Strategy data is treated as your intellectual property.
              </p>
            </SubSection>
            <SubSection title="4.4 Polymarket Wallet and API Credentials">
              <p>
                If you connect a Polymarket wallet, we store an encrypted copy
                of your signing key. Keys are encrypted using AES-256-GCM with
                envelope encryption (a data encryption key wrapped by a
                key-encryption key). Key material is handled exclusively by a
                dedicated signer service with memory-locked buffers and
                automatic zeroization. We never store plaintext private keys at
                rest. The signer service is architecturally isolated and
                operates exclusively within an encrypted Rust/WASM context.
              </p>
            </SubSection>
            <SubSection title="4.5 Financial and Billing Data">
              <p>
                Subscription plan, billing records, and payment method metadata
                (last 4 digits, card brand, expiry&nbsp;&mdash; provided by
                Stripe). We never see or store full card numbers. Full payment
                card data is handled exclusively by Stripe, Inc. under their
                PCI-DSS certified infrastructure.
              </p>
            </SubSection>
            <SubSection title="4.6 Communications Data">
              <p>
                Support messages, email correspondence, notification
                preferences, and optional feedback/survey responses.
              </p>
            </SubSection>
            <SubSection title="4.7 Technical and Device Data">
              <p>
                Browser type and version, operating system, screen resolution,
                timezone, and referral source&nbsp;&mdash; collected via
                user-agent string and standard HTTP headers.
              </p>
            </SubSection>
          </Section>

          {/* 5 */}
          <Section title="5. How We Collect Data">
            <p>
              <strong className="font-semibold text-primary">
                Directly from you:
              </strong>{" "}
              when you register, create strategies, enter billing information,
              or contact support.
            </p>
            <p>
              <strong className="font-semibold text-primary">
                Automatically:
              </strong>{" "}
              server logs, session cookies, and analytics events within the
              platform.
            </p>
            <p>
              <strong className="font-semibold text-primary">
                From third parties:
              </strong>{" "}
              Stripe (payment confirmations, fraud signals), Polymarket API
              (market data, order status, wallet queries), and authentication
              providers (OAuth/SSO profile tokens).
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Legal Bases for Processing (GDPR)">
            <p>
              For EEA, UK, and Swiss users, every processing activity has a
              lawful basis under Art. 6 GDPR:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Contract (Art. 6(1)(b))
                </strong>{" "}
                &mdash; account management, authentication, strategy execution,
                order submission, billing.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Legitimate Interests (Art. 6(1)(f))
                </strong>{" "}
                &mdash; security logging, fraud prevention, aggregate usage
                analytics. You may opt out of analytics at any time.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Consent (Art. 6(1)(a))
                </strong>{" "}
                &mdash; marketing communications (opt-in only; withdrawable at
                any time).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Legal Obligation (Art. 6(1)(c))
                </strong>{" "}
                &mdash; tax records, regulatory requests, court orders.
              </li>
            </ul>
            <p>
              Where we rely on Legitimate Interests, we have conducted a
              balancing test. You may request our Legitimate Interests
              Assessment by contacting{" "}
              <a href="mailto:dpo@polyforge.io" className={linkClass}>
                dpo@polyforge.io
              </a>
              .
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. How We Use Your Data">
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                Create and maintain your account, authenticate you, and maintain
                your session.
              </li>
              <li>
                Build, store, and execute your trading strategies; submit orders
                to Polymarket on your behalf.
              </li>
              <li>
                Process subscription payments via Stripe; manage plan changes
                and invoices.
              </li>
              <li>
                Detect and prevent fraudulent access or abuse; maintain audit
                logs.
              </li>
              <li>
                Analyse aggregate usage patterns to improve features; diagnose
                errors.
              </li>
              <li>
                Send transactional emails (confirmations, resets, alerts) and
                marketing emails where you have consented.
              </li>
              <li>
                Comply with applicable law, enforce our Terms of Service, and
                resolve disputes.
              </li>
            </ul>
            <p>
              We do not use your data to train external machine learning models,
              sell to data brokers, or share for purposes unrelated to operating
              the Service.
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Third-Party Sharing and Processors">
            <p>
              We share your data only as necessary to operate the Service or
              comply with legal obligations. All third-party processors are
              bound by data processing agreements.
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Stripe, Inc.
                </strong>{" "}
                &mdash; payment processing (email, billing records, payment
                metadata). US-based; SCCs in place.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Polymarket (CLOB)
                </strong>{" "}
                &mdash; market data and order execution (wallet address, signed
                payloads).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Cloud infrastructure provider
                </strong>{" "}
                &mdash; hosting, storage, compute (all data encrypted at rest
                and in transit). EU-based or SCC-covered.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Email delivery provider
                </strong>{" "}
                &mdash; transactional and marketing email (email address, name).
                Covered by DPA.
              </li>
            </ul>
            <p>
              We may disclose personal data to law enforcement, regulators, or
              courts when required by valid legal process or to prevent imminent
              harm. Where legally permitted, we will notify you before
              disclosing.
            </p>
            <p>
              If PolyForge is involved in a merger, acquisition, or asset sale,
              your data may be transferred to the successor entity with prior
              notice. We do not sell your personal data. We do not share your
              strategy configurations without your explicit consent. We do not
              allow third parties to use your data for their own marketing.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. International Data Transfers">
            <p>
              PolyForge is operated from servers within the EU or jurisdictions
              with an EU adequacy decision where possible. For transfers to
              third countries, we rely on Standard Contractual Clauses (SCCs) or
              adequacy decisions. You may request a copy of applicable SCCs by
              emailing{" "}
              <a href="mailto:dpo@polyforge.io" className={linkClass}>
                dpo@polyforge.io
              </a>
              .
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Data Retention">
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Account data
                </strong>{" "}
                &mdash; duration of account + 30 days after deletion (grace
                period for recovery).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Strategy configurations and orders
                </strong>{" "}
                &mdash; duration of account + 90 days after deletion (for
                export), then permanently deleted.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Server and access logs
                </strong>{" "}
                &mdash; 90 days.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Billing records and invoices
                </strong>{" "}
                &mdash; 7 years (tax and accounting obligations).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Support correspondence
                </strong>{" "}
                &mdash; 3 years from resolution.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Encrypted API credentials
                </strong>{" "}
                &mdash; deleted immediately upon user deletion or credential
                removal.
              </li>
            </ul>
            <p>
              After the applicable retention period, data is securely deleted or
              irreversibly anonymised. You may delete your account at any time
              via Settings. Within 30 days of deletion, we permanently erase all
              personal data except where retention is legally required.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Cookies and Tracking Technologies">
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Strictly necessary
                </strong>{" "}
                &mdash; session authentication, CSRF protection (cannot be
                disabled).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Functional
                </strong>{" "}
                &mdash; theme, timezone, notification preferences (can be
                disabled).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Analytics
                </strong>{" "}
                &mdash; aggregate usage metrics (can be disabled or opted out).
              </li>
            </ul>
            <p>
              We do not use third-party advertising cookies or retargeting
              pixels.
            </p>
          </Section>

          {/* 12 */}
          <Section title="12. Security Measures">
            <p>
              All data transmitted over HTTPS/TLS 1.3. API credentials encrypted
              at rest using AES-256-GCM within an isolated Rust/WASM signer
              module. Passwords hashed with bcrypt (cost factor &ge; 12).
              Session tokens in HttpOnly, Secure, SameSite=Strict cookies.
              Database encrypted at rest. Role-based access controls. Dependency
              and vulnerability scanning.
            </p>
            <p>
              If we experience a breach likely to result in high risk to your
              rights, we will notify you without undue delay and the supervisory
              authority within 72 hours (GDPR Art. 33).
            </p>
          </Section>

          {/* 13 */}
          <Section title="13. Children&rsquo;s Privacy">
            <p>
              The Service is not directed at anyone under the age of 18. We do
              not knowingly collect personal data from children. If you believe
              a child has provided us with personal data, contact{" "}
              <a href="mailto:privacy@polyforge.io" className={linkClass}>
                privacy@polyforge.io
              </a>{" "}
              immediately.
            </p>
          </Section>

          {/* 14 */}
          <Section title="14. Your Rights Under GDPR">
            <p>
              If you are in the EEA, UK, or Switzerland, you have the following
              rights:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Access (Art. 15)
                </strong>{" "}
                &mdash; obtain confirmation of processing and a copy of your
                data.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Rectification (Art. 16)
                </strong>{" "}
                &mdash; correct inaccurate or incomplete data.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Erasure (Art. 17)
                </strong>{" "}
                &mdash; request deletion where data is no longer necessary, you
                withdraw consent, or data was unlawfully processed (subject to
                legal retention requirements).
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Restriction (Art. 18)
                </strong>{" "}
                &mdash; restrict processing while you contest accuracy or object
                to processing.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Data Portability (Art. 20)
                </strong>{" "}
                &mdash; receive your data in JSON or CSV format.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Object (Art. 21)
                </strong>{" "}
                &mdash; object to processing based on legitimate interests,
                including direct marketing.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Withdraw Consent
                </strong>{" "}
                &mdash; at any time, without affecting lawfulness of prior
                processing.
              </li>
            </ul>
            <p>
              We do not make decisions based solely on automated processing that
              produce legal or similarly significant effects (Art. 22).
            </p>
          </Section>

          {/* 15 */}
          <Section title="15. Your Rights Under CCPA (California Residents)">
            <p>
              California residents have the following rights under the CCPA as
              amended by the CPRA:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-1">
              <li>
                <strong className="font-semibold text-primary">
                  Right to Know
                </strong>{" "}
                &mdash; disclosure of categories and specific pieces of personal
                information collected, sources, purposes, and third-party
                sharing.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Right to Delete
                </strong>{" "}
                &mdash; deletion of personal information, subject to legal
                exceptions.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Right to Correct
                </strong>{" "}
                &mdash; correction of inaccurate personal information.
              </li>
              <li>
                <strong className="font-semibold text-primary">
                  Right to Non-Discrimination
                </strong>{" "}
                &mdash; we will not deny service or charge different prices for
                exercising privacy rights.
              </li>
            </ul>
            <p>
              We do not sell your personal information for money. We do not
              share it for cross-context behavioural advertising. We do not use
              sensitive personal information beyond what is necessary to perform
              the Service.
            </p>
          </Section>

          {/* 16 */}
          <Section title="16. How to Exercise Your Rights">
            <p>
              <strong className="font-semibold text-primary">
                Self-service (fastest):
              </strong>{" "}
              Settings &rarr; Privacy &rarr; Download My Data (JSON/CSV);
              Settings &rarr; Account &rarr; Delete Account; Settings &rarr;
              Profile &rarr; Edit Profile.
            </p>
            <p>
              <strong className="font-semibold text-primary">
                Direct requests:
              </strong>{" "}
              <a href="mailto:privacy@polyforge.io" className={linkClass}>
                privacy@polyforge.io
              </a>
            </p>
            <p>
              <strong className="font-semibold text-primary">
                DPO (EEA/UK/Switzerland):
              </strong>{" "}
              <a href="mailto:dpo@polyforge.io" className={linkClass}>
                dpo@polyforge.io
              </a>
            </p>
            <p>
              GDPR response: within 30 days (extendable to 60). CCPA response:
              within 45 days (extendable to 90). Requests are fulfilled free of
              charge unless manifestly unfounded or excessive.
            </p>
          </Section>

          {/* 17 */}
          <Section title="17. Complaints and Supervisory Authority">
            <p>
              If you have a concern about how we handle your data, contact{" "}
              <a href="mailto:privacy@polyforge.io" className={linkClass}>
                privacy@polyforge.io
              </a>{" "}
              first. EEA users may lodge a complaint with their supervisory
              authority. UK residents may contact the ICO at{" "}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                ico.org.uk
              </a>
              .
            </p>
          </Section>

          {/* 18 */}
          <Section title="18. Changes to This Policy">
            <p>
              We may update this Privacy Policy to reflect changes in our
              practices, technology, or applicable law. Material changes will be
              communicated via email at least 14 days before taking effect, and
              a notice will be displayed on the platform upon your next login.
              Continued use after the effective date constitutes acceptance.
            </p>
          </Section>

          {/* 19 */}
          <Section title="19. Contact Us">
            <address className="not-italic space-y-2">
              <p>
                <strong className="font-semibold text-primary">
                  Privacy Team:
                </strong>{" "}
                <a href="mailto:privacy@polyforge.io" className={linkClass}>
                  privacy@polyforge.io
                </a>
              </p>
              <p>
                <strong className="font-semibold text-primary">
                  Data Protection Officer:
                </strong>{" "}
                <a href="mailto:dpo@polyforge.io" className={linkClass}>
                  dpo@polyforge.io
                </a>
              </p>
              <p>
                <strong className="font-semibold text-primary">
                  General Legal:
                </strong>{" "}
                <a href="mailto:legal@polyforge.io" className={linkClass}>
                  legal@polyforge.io
                </a>
              </p>
            </address>
            <p className="text-label text-tertiary mt-6">
              This Privacy Policy is provided for informational purposes and
              does not constitute legal advice. Last reviewed by Lex (Legal
              &amp; Compliance @ PolyForge)&nbsp;&mdash; April 15, 2026.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}
