import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Nav } from "../components/nav";

const Footer = dynamic(() =>
  import("../components/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Cookie Policy — Polyforge",
  description:
    "Learn how Polyforge uses cookies and tracking technologies, and how to manage your preferences.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "May 11, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function Sub({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-heading font-semibold text-primary mb-2">{title}</h3>
      {children}
    </div>
  );
}

const linkClass =
  "text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm";

export default function CookiesPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-display-lg font-semibold text-primary">
            Cookie Policy
          </h1>
          <p className="text-label text-tertiary mt-2 mb-10">
            Effective date: {LAST_UPDATED} &middot; Last updated: {LAST_UPDATED}
          </p>

          <Section title="1. What Are Cookies?">
            <p>
              Cookies are small text files stored on your device by websites you
              visit. They are widely used to make websites work, or work more
              efficiently, as well as to provide information to the site owners.
            </p>
            <p>
              Cookies set by us are called &ldquo;first-party cookies.&rdquo;
              Cookies set by parties other than us are called &ldquo;third-party
              cookies.&rdquo; Third-party cookies enable features or
              functionality provided by third parties on or through our website.
            </p>
          </Section>

          <Section title="2. How We Use Cookies">
            <Sub title="2.1 Essential Cookies">
              <p>
                These cookies are strictly necessary to provide you with
                services available through our website. They enable core
                functionality such as authentication, security, and session
                management. You cannot opt out of essential cookies as our
                website cannot function properly without them.
              </p>
              <table className="w-full text-left border-collapse mt-4">
                <thead>
                  <tr className="border-b border-subtle">
                    <th className="pr-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="pl-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Provider
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-subtle">
                    <td className="pr-4 py-3 font-mono text-xs">
                      polyforge:theme
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Stores your theme preference (dark/light)
                    </td>
                    <td className="px-4 py-3 text-secondary">Persistent</td>
                    <td className="pl-4 py-3 text-secondary">Polyforge</td>
                  </tr>
                  <tr className="border-b border-subtle">
                    <td className="pr-4 py-3 font-mono text-xs">
                      polyforge:consent
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Stores your cookie consent preferences
                    </td>
                    <td className="px-4 py-3 text-secondary">12 months</td>
                    <td className="pl-4 py-3 text-secondary">Polyforge</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-3 font-mono text-xs">__Host-auth</td>
                    <td className="px-4 py-3 text-secondary">
                      Authentication session token
                    </td>
                    <td className="px-4 py-3 text-secondary">Session</td>
                    <td className="pl-4 py-3 text-secondary">Polyforge</td>
                  </tr>
                </tbody>
              </table>
            </Sub>

            <Sub title="2.2 Analytics Cookies (Opt-in)">
              <p>
                With your consent, we use analytics cookies to understand how
                visitors interact with our website. This helps us improve
                performance and user experience. These cookies are only set
                after you accept analytics cookies via our consent banner.
              </p>
              <table className="w-full text-left border-collapse mt-4">
                <thead>
                  <tr className="border-b border-subtle">
                    <th className="pr-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Data Collected
                    </th>
                    <th className="pl-4 py-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      Privacy Policy
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-subtle">
                    <td className="pr-4 py-3 font-medium text-primary">
                      PostHog
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Product analytics and session recording
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Page views, clicks, feature usage
                    </td>
                    <td className="pl-4 py-3">
                      <a
                        href="https://posthog.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        PostHog Privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-3 font-medium text-primary">
                      Plausible
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Privacy-first page view analytics
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      Anonymous page views only
                    </td>
                    <td className="pl-4 py-3">
                      <a
                        href="https://plausible.io/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        Plausible Privacy
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-tertiary">
                Plausible Analytics does not use cookies and does not collect
                personal data. It is only loaded after you accept analytics
                cookies via our consent banner and stops when consent is
                withdrawn.
              </p>
            </Sub>
          </Section>

          <Section title="3. Managing Your Preferences">
            <p>You can manage your cookie preferences at any time:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Click the cookie consent banner to choose between &ldquo;Accept
                all&rdquo; or &ldquo;Essential only&rdquo; on your first visit.
              </li>
              <li>
                Clear your browser&rsquo;s localStorage for polyforge.app to
                reset your consent choice and see the banner again.
              </li>
              <li>
                Most web browsers allow you to control cookies through their
                settings preferences. See your browser&rsquo;s help section for
                instructions.
              </li>
              <li>
                To opt out of PostHog tracking specifically, you can also visit{" "}
                <a
                  href="https://posthog.com/opt-out"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  PostHog&rsquo;s opt-out page
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="4. Your Rights Under GDPR">
            <p>
              If you are located in the European Economic Area (EEA), you have
              the following rights under the General Data Protection Regulation
              (GDPR):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Right to withdraw consent</strong> — You may withdraw
                your consent for analytics cookies at any time by clearing
                localStorage for polyforge.app.
              </li>
              <li>
                <strong>Right to access</strong> — You may request information
                about any personal data we hold about you.
              </li>
              <li>
                <strong>Right to erasure</strong> — You may request deletion of
                your personal data, subject to legal obligations.
              </li>
              <li>
                <strong>Right to object</strong> — You may object to processing
                of your personal data based on legitimate interest.
              </li>
              <li>
                <strong>Right to data portability</strong> — You may request a
                copy of your personal data in a structured format.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:privacy@polyforge.app" className={linkClass}>
                privacy@polyforge.app
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="5. Changes to This Policy">
            <p>
              We may update this Cookie Policy from time to time to reflect
              changes in our practices or for operational, legal, or regulatory
              reasons. The date at the top of this page indicates when it was
              last revised.
            </p>
          </Section>

          <Section title="6. Contact">
            <p>
              If you have questions about our use of cookies or this Cookie
              Policy, please contact us at:
            </p>
            <p className="mt-2 space-y-1">
              <span className="block">
                Email:{" "}
                <a href="mailto:privacy@polyforge.app" className={linkClass}>
                  privacy@polyforge.app
                </a>
              </span>
            </p>
            <p>
              This Cookie Policy supplements our{" "}
              <a href="/privacy" className={linkClass}>
                Privacy Policy
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
