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

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mt-6">
      <h3 className="text-body-md font-semibold text-primary">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-accent/30 pl-4 text-body-sm text-tertiary leading-relaxed">
      {children}
    </blockquote>
  );
}

function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase text-label tracking-wide font-semibold">
      {children}
    </p>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
      {...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </a>
  );
}

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-display-lg text-primary">Terms of Service</h1>
          <p className="text-label text-tertiary mt-2">
            Effective Date: April 15, 2026 &middot; Last Updated: April 18,
            2026
          </p>
          <p className="text-body-sm text-tertiary mt-1 mb-6">
            Operator: Shems Chelgoui, Entrepreneur Individuel (EI), trading as
            PolyForge &mdash; registered in France
          </p>

          <Callout>
            <p>
              <strong className="text-primary">
                IMPORTANT RISK NOTICE:
              </strong>{" "}
              Trading on prediction markets involves significant risk of loss.
              Past performance of any strategy &mdash; including backtested or
              simulated results &mdash; does not guarantee future results.
              PolyForge is a software automation tool, not a broker, exchange,
              financial adviser, or investment manager. You are solely
              responsible for your trading decisions and any losses that result
              from them.
            </p>
          </Callout>

          <div className="mt-10">
            {/* §1 */}
            <Section title="1. Agreement to Terms">
              <p>
                These Terms of Service (&ldquo;Terms&rdquo;) constitute a
                legally binding agreement between you (&ldquo;User,&rdquo;
                &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and{" "}
                <strong className="text-primary">
                  Shems Chelgoui, Entrepreneur Individuel (EI), trading as
                  PolyForge
                </strong>
                , a micro-entreprise registered in France under the
                auto-entrepreneur regime (&ldquo;PolyForge,&rdquo;
                &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
                governing your access to and use of the PolyForge platform,
                website, APIs, and all associated software tools and services
                (collectively, the &ldquo;Service&rdquo;).
              </p>
              <Disclaimer>
                By accessing or using the Service in any way, you affirm that:
              </Disclaimer>
              <ul className="list-disc list-inside space-y-2 pl-1">
                <li>
                  You have read, understood, and agree to be bound by these
                  Terms;
                </li>
                <li>
                  You meet all eligibility requirements set forth in Section 3;
                </li>
                <li>
                  You are not located in, and are not a resident of, any
                  Restricted Jurisdiction listed in Section 4;
                </li>
                <li>
                  You are acting for your own account and not on behalf of any
                  sanctioned person or entity; and
                </li>
                <li>
                  You have the legal capacity to enter into a binding contract
                  under applicable law.
                </li>
              </ul>
              <Disclaimer>
                If you do not agree to these Terms in their entirety, you must
                immediately cease all access to and use of the Service.
              </Disclaimer>
              <p>
                These Terms incorporate by reference our{" "}
                <A href="/privacy">Privacy Policy</A>. In the event of any
                conflict between these Terms and any other PolyForge policy,
                these Terms control.
              </p>
            </Section>

            {/* §2 */}
            <Section title="2. Service Description">
              <p>
                PolyForge is a{" "}
                <strong className="text-primary">
                  software-as-a-service (SaaS) strategy automation platform
                </strong>{" "}
                that enables users to design, backtest, and automate trading
                strategies for use on Polymarket, a third-party decentralized
                prediction market platform.
              </p>

              <Sub title="2.1 Core Service Features">
                <p>The Service provides:</p>
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    <strong className="text-primary">Strategy Builder:</strong>{" "}
                    A visual, block-based interface for constructing algorithmic
                    trading strategies.
                  </li>
                  <li>
                    <strong className="text-primary">Backtesting Engine:</strong>{" "}
                    Historical simulation against Polymarket market data.
                  </li>
                  <li>
                    <strong className="text-primary">Paper Trading:</strong>{" "}
                    Simulated live trading without real funds.
                  </li>
                  <li>
                    <strong className="text-primary">
                      Live Strategy Execution:
                    </strong>{" "}
                    Automated execution on Polymarket using your credentials.
                  </li>
                  <li>
                    <strong className="text-primary">Market Data Feeds:</strong>{" "}
                    Real-time and historical Polymarket data.
                  </li>
                  <li>
                    <strong className="text-primary">
                      Notification Services:
                    </strong>{" "}
                    Alerts via email, Telegram, Discord, or webhook.
                  </li>
                  <li>
                    <strong className="text-primary">
                      Analytics and Reporting:
                    </strong>{" "}
                    Performance dashboards for active and historical strategies.
                  </li>
                </ul>
              </Sub>

              <Sub title="2.2 What PolyForge Is Not">
                <p>
                  PolyForge is a{" "}
                  <strong className="text-primary">software tool only</strong>.
                  PolyForge:
                </p>
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Is not a broker-dealer, exchange, designated contract market
                    (DCM), swap execution facility (SEF), or money services
                    business.
                  </li>
                  <li>
                    Does not hold, custody, manage, or have access to user funds
                    or digital assets.
                  </li>
                  <li>
                    Does not provide financial, investment, legal, or tax advice.
                  </li>
                  <li>
                    Does not guarantee or represent the profitability of any
                    strategy.
                  </li>
                  <li>
                    Is not affiliated with, endorsed by, or operated by
                    Polymarket.
                  </li>
                </ul>
              </Sub>
            </Section>

            {/* §3 */}
            <Section title="3. User Eligibility">
              <p>
                To access or use the Service, you must meet{" "}
                <strong className="text-primary">all</strong> of the following
                requirements:
              </p>

              <Sub title="3.1 Age Requirement">
                <p>
                  You must be at least{" "}
                  <strong className="text-primary">18 years of age</strong>, or
                  the age of legal majority in your jurisdiction if higher.
                </p>
              </Sub>

              <Sub title="3.2 Legal Capacity">
                <p>
                  You must have full legal capacity to enter into a binding
                  contract. If you are using the Service on behalf of a legal
                  entity, you represent that you have authority to bind that
                  entity to these Terms.
                </p>
              </Sub>

              <Sub title="3.3 Legal Right to Access Prediction Markets">
                <p>You represent and warrant that:</p>
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Access to and trading on Polymarket is lawful in your
                    jurisdiction;
                  </li>
                  <li>
                    You are not subject to any law prohibiting use of prediction
                    market platforms or automated trading software;
                  </li>
                  <li>
                    Your use of the Service does not violate any applicable law
                    or regulation.
                  </li>
                </ul>
              </Sub>

              <Sub title="3.4 Not a Sanctioned Person">
                <p>
                  You are not: (a) identified on any prohibited or restricted
                  parties list maintained by OFAC, the UN Security Council, the
                  EU, or any other applicable authority; (b) located in any
                  Restricted Jurisdiction (see Section 4); or (c) more than 50%
                  owned or controlled by any such person.
                </p>
              </Sub>
            </Section>

            {/* §4 */}
            <Section title="4. Geographic and Jurisdictional Restrictions">
              <Disclaimer>
                Access to and use of the Service is strictly prohibited from the
                following jurisdictions (&ldquo;Restricted
                Jurisdictions&rdquo;).
              </Disclaimer>

              <Sub title="4.1 OFAC Sanctioned Countries (Access Completely Prohibited)">
                <p className="text-body-sm">
                  Cuba, Iran, North Korea, Russia, Syria, Venezuela, Belarus,
                  Myanmar (Burma), Sudan, South Sudan, Somalia, Libya, Yemen,
                  Central African Republic, Democratic Republic of the Congo,
                  Iraq, Lebanon, Zimbabwe, Ethiopia, Burundi, Nicaragua.
                </p>
              </Sub>

              <Sub title="4.2 Jurisdictions with Prediction Market Restrictions">
                <p className="text-body-sm">
                  United States (all states, DC, and territories), United
                  Kingdom, France*, Germany, Italy, Belgium, Australia,
                  Singapore, Taiwan, Thailand, Poland.
                </p>
                <Callout>
                  <p>
                    <strong className="text-primary">Note on France:</strong>{" "}
                    PolyForge is operated by an entrepreneur individuel
                    registered in France. However, this does not constitute an
                    offer of the Service to French residents. Polymarket is
                    geo-restricted in France by regulatory requirement.
                    PolyForge&rsquo;s French legal domicile is a registration
                    and tax matter only.
                  </p>
                </Callout>
              </Sub>

              <Sub title="4.3 Sub-National Restrictions">
                <p>
                  Ontario, Canada &mdash; residents are prohibited from using
                  live trading or deposit features.
                </p>
              </Sub>

              <Sub title="4.4 Responsibility for Compliance">
                <p>
                  You are solely responsible for determining whether your use of
                  the Service is lawful in your jurisdiction.
                </p>
                <Disclaimer>
                  Attempting to circumvent geographic restrictions &mdash;
                  including through VPNs, proxy servers, Tor, or other
                  obfuscation technologies &mdash; constitutes a material breach
                  and will result in immediate account termination.
                </Disclaimer>
              </Sub>

              <Sub title="4.5 Regulatory Changes">
                <p>
                  PolyForge may be required to add jurisdictions to the
                  Restricted list on short notice due to evolving regulations
                  (including CFTC proceedings). We will make commercially
                  reasonable efforts to notify affected users.
                </p>
              </Sub>
            </Section>

            {/* §5 */}
            <Section title="5. Account Registration and Security">
              <Sub title="5.1 Account Creation">
                <p>
                  You must create an account with accurate, current, and
                  complete information. You agree to maintain and promptly
                  update your account information.
                </p>
              </Sub>

              <Sub title="5.2 Account Security">
                <p>You are responsible for:</p>
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Maintaining the confidentiality of your login credentials,
                    API keys, and wallet credentials;
                  </li>
                  <li>
                    All activities under your account, whether or not authorized;
                  </li>
                  <li>
                    Immediately notifying us of any unauthorized use or security
                    breach.
                  </li>
                </ul>
              </Sub>

              <Sub title="5.3 One Account Per User">
                <p>
                  Each user may maintain only one account. Multiple accounts
                  created to circumvent restrictions will result in termination.
                </p>
              </Sub>

              <Sub title="5.4 Wallet Credentials">
                <p>
                  When you connect a Polymarket wallet, you acknowledge that
                  PolyForge uses credentials solely to execute strategies on your
                  behalf, does not store private keys in plain text (all key
                  material is processed through AES-256-GCM encryption), and you
                  remain the sole custodian of your funds.
                </p>
              </Sub>
            </Section>

            {/* §6 */}
            <Section title="6. Acceptable Use Policy">
              <p>
                You agree to use the Service only for lawful purposes. You must:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-1">
                <li>
                  Comply with all applicable laws and Polymarket&rsquo;s own
                  terms;
                </li>
                <li>
                  Use the Service in a fair and ethical manner that does not harm
                  other market participants;
                </li>
                <li>
                  Maintain account security and not share access with
                  unauthorized parties;
                </li>
                <li>
                  Promptly notify PolyForge of any suspected security
                  vulnerabilities.
                </li>
              </ul>
            </Section>

            {/* §7 */}
            <Section title="7. Prohibited Uses">
              <Sub title="7.1 Market Manipulation and Abuse">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Wash trading, spoofing, layering, or coordinated trading
                    schemes;
                  </li>
                  <li>
                    Trading on material non-public information;
                  </li>
                  <li>
                    Any scheme to defraud other market participants.
                  </li>
                </ul>
              </Sub>

              <Sub title="7.2 Legal and Regulatory Violations">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Accessing the Service from a Restricted Jurisdiction;
                  </li>
                  <li>Violating AML, CTF, or KYC requirements;</li>
                  <li>Processing proceeds of illegal activity;</li>
                  <li>Violating Polymarket&rsquo;s terms or policies.</li>
                </ul>
              </Sub>

              <Sub title="7.3 Technical Abuse">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>Circumventing geographic restrictions;</li>
                  <li>Reverse engineering or decompiling the Service;</li>
                  <li>
                    Unauthorized automated access beyond the documented API;
                  </li>
                  <li>Introducing malware or harmful code;</li>
                  <li>Attempting unauthorized access to infrastructure;</li>
                  <li>Denial-of-service attacks.</li>
                </ul>
              </Sub>

              <Sub title="7.4 Data Harvesting">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Scraping or data mining beyond what the API permits;
                  </li>
                  <li>
                    Commercially redistributing PolyForge data without
                    authorization.
                  </li>
                </ul>
              </Sub>

              <Sub title="7.5 Misrepresentation">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    Impersonating any person or entity;
                  </li>
                  <li>
                    Falsely representing simulated performance as live results;
                  </li>
                  <li>
                    Promoting the Service through false or misleading claims.
                  </li>
                </ul>
              </Sub>
            </Section>

            {/* §8 */}
            <Section title="8. Polymarket Integration and Third-Party Services">
              <Sub title="8.1 Independence from Polymarket">
                <p>
                  PolyForge is independent and is not affiliated with, sponsored
                  by, or endorsed by Polymarket. Your use of Polymarket is
                  subject to its own terms of service.
                </p>
              </Sub>

              <Sub title="8.2 Third-Party Service Disruptions">
                <p>
                  We do not guarantee uninterrupted access to Polymarket. We are
                  not responsible for losses arising from Polymarket API
                  outages, changes to their terms, market suspensions, or
                  infrastructure failures outside our control.
                </p>
              </Sub>

              <Sub title="8.3 API Keys and Credentials">
                <p>
                  By connecting third-party credentials, you grant PolyForge a
                  limited, revocable authorization to use them to execute
                  strategies on your behalf as configured. PolyForge will not
                  use your credentials for any other purpose.
                </p>
              </Sub>
            </Section>

            {/* §9 */}
            <Section title="9. Intellectual Property">
              <Sub title="9.1 PolyForge IP">
                <p>
                  All software, technology, algorithms, interfaces, designs,
                  trademarks, logos, and content (&ldquo;PolyForge IP&rdquo;)
                  are the exclusive property of Shems Chelgoui, EI, trading as
                  PolyForge, and its licensors. Subject to compliance with these
                  Terms, you receive a limited, non-exclusive, non-transferable,
                  revocable license to use the Service.
                </p>
              </Sub>

              <Sub title="9.2 Restrictions on PolyForge IP">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    You may not copy, modify, or create derivative works of the
                    Service;
                  </li>
                  <li>
                    You may not distribute, sell, or sublicense any rights;
                  </li>
                  <li>
                    You may not remove intellectual property notices;
                  </li>
                  <li>
                    You may not use PolyForge branding without written consent.
                  </li>
                </ul>
              </Sub>

              <Sub title="9.3 Feedback">
                <p>
                  If you provide feedback about the Service, you grant PolyForge
                  a worldwide, royalty-free, perpetual, irrevocable license to
                  use and incorporate it.
                </p>
              </Sub>
            </Section>

            {/* §10 */}
            <Section title="10. User Content and Strategy Data">
              <Sub title="10.1 Your Strategies">
                <p>
                  You retain ownership of your strategy configurations, rules,
                  and logic (&ldquo;User Strategies&rdquo;). PolyForge does not
                  claim ownership.
                </p>
              </Sub>

              <Sub title="10.2 License to PolyForge">
                <p>
                  You grant PolyForge a limited, worldwide, royalty-free license
                  to store, process, and execute your strategies; generate
                  analytics and trade logs; and use aggregated, anonymized data
                  to improve the Service. We will not disclose your individual
                  strategy configurations without consent, except as required by
                  law.
                </p>
              </Sub>

              <Sub title="10.3 Accuracy of Data">
                <p>
                  Market data and performance metrics are for informational
                  purposes. PolyForge makes no representation that such data is
                  accurate, complete, or current.
                </p>
              </Sub>
            </Section>

            {/* §11 */}
            <Section title="11. Financial Risk Disclaimer">
              <Disclaimer>
                Read this section carefully. It contains critical information
                about the risks of using the Service.
              </Disclaimer>

              <Sub title="11.1 Trading Risk">
                <p>
                  Prediction market trading involves the risk of loss of funds.
                  There is no guarantee that any strategy will be profitable.
                  You may lose some or all funds you commit. You should only
                  trade with funds you can afford to lose.
                </p>
              </Sub>

              <Sub title="11.2 Backtested and Simulated Performance">
                <Disclaimer>
                  Past performance does not guarantee future results.
                </Disclaimer>
                <p>
                  Backtested results are hypothetical, subject to hindsight
                  bias, ideal execution assumptions, non-recurring market
                  conditions, and unaccounted fees/slippage. All simulated
                  metrics are illustrative only.
                </p>
              </Sub>

              <Sub title="11.3 System and Technology Risk">
                <p>
                  Automated trading systems are subject to software bugs,
                  latency, connectivity failures, API disruptions, and exchange
                  outages. PolyForge is not liable for losses arising from
                  system failures.
                </p>
              </Sub>

              <Sub title="11.4 Regulatory Risk">
                <p>
                  The legal status of prediction markets is subject to change.
                  Regulatory actions could materially affect your ability to use
                  the Service. PolyForge is not responsible for losses from
                  regulatory changes.
                </p>
              </Sub>
            </Section>

            {/* §12 */}
            <Section title="12. No Financial Advice">
              <p>
                PolyForge does not provide investment advice, financial planning,
                or brokerage services. Nothing on the Service constitutes a
                recommendation to buy or sell any financial instrument. All
                information is for educational and informational purposes only.
                Consult a qualified professional before making trading decisions.
              </p>
            </Section>

            {/* §13 */}
            <Section title="13. Fees, Billing, and Payment">
              <Sub title="13.1 Free Tier">
                <p>
                  PolyForge offers a free tier with limited features. No
                  payment is required.
                </p>
              </Sub>

              <Sub title="13.2 Paid Subscriptions">
                <p>
                  Paid plans (&ldquo;Pro&rdquo; and &ldquo;Quant&rdquo;) are
                  available at published rates in U.S. dollars.
                </p>
              </Sub>

              <Sub title="13.3 Billing and Renewal">
                <p>
                  Subscriptions are billed in advance (monthly or annually),
                  auto-renew unless cancelled, and you authorize PolyForge to
                  charge your payment method for applicable fees.
                </p>
              </Sub>

              <Sub title="13.4 Cancellation and Refunds">
                <p>
                  You may cancel at any time; cancellation takes effect at the
                  end of the billing period.{" "}
                  <strong className="text-primary">
                    All fees are non-refundable
                  </strong>{" "}
                  except where required by law.
                </p>
              </Sub>

              <Sub title="13.5 Price Changes">
                <p>
                  Prices may change with at least 30 days&rsquo; notice.
                  Continued use constitutes acceptance.
                </p>
              </Sub>

              <Sub title="13.6 Taxes and VAT">
                <p>
                  You are responsible for all applicable taxes.
                </p>
                <Callout>
                  <p>
                    <strong className="text-primary">TVA (VAT) Notice:</strong>{" "}
                    PolyForge operates under the{" "}
                    <em>franchise en base de TVA</em> (VAT exemption) pursuant
                    to Article 293 B of the French{" "}
                    <em>Code g&eacute;n&eacute;ral des imp&ocirc;ts</em>. TVA
                    is not applicable to invoices issued by PolyForge
                    (&laquo;&nbsp;TVA non applicable, article 293 B du
                    CGI&nbsp;&raquo;). This exemption may be revoked if annual
                    revenue exceeds the applicable thresholds.
                  </p>
                </Callout>
              </Sub>
            </Section>

            {/* §14 */}
            <Section title="14. Disclaimer of Warranties">
              <Disclaimer>
                To the maximum extent permitted by applicable law, the Service
                is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo;
                without warranties of any kind, express or implied.
              </Disclaimer>
              <Disclaimer>PolyForge expressly disclaims all warranties, including:</Disclaimer>
              <ul className="list-disc list-inside space-y-2 pl-1 uppercase text-label tracking-wide font-semibold">
                <li>
                  Any implied warranty of merchantability, fitness for a
                  particular purpose, title, non-infringement, or accuracy;
                </li>
                <li>
                  Any warranty that the Service will be uninterrupted,
                  error-free, secure, or free from harmful components;
                </li>
                <li>
                  Any warranty that the Service will meet your requirements or
                  that errors will be corrected;
                </li>
                <li>
                  Any warranty regarding accuracy or timeliness of market data;
                </li>
                <li>
                  Any warranty regarding the profitability of any trading
                  strategy.
                </li>
              </ul>
              <p>
                Some jurisdictions do not allow the exclusion of implied
                warranties, so some exclusions may not apply to you.
              </p>
            </Section>

            {/* §15 */}
            <Section title="15. Limitation of Liability">
              <Sub title="15.1 Exclusion of Consequential Damages">
                <Disclaimer>
                  To the maximum extent permitted by applicable law, PolyForge
                  shall not be liable for any indirect, incidental, special,
                  consequential, punitive, or exemplary damages; loss of
                  profits, revenue, data, or goodwill; trading losses from
                  strategy performance, execution errors, or missed executions;
                  or losses from market data inaccuracies or third-party service
                  disruptions &mdash; even if advised of the possibility of such
                  damages.
                </Disclaimer>
              </Sub>

              <Sub title="15.2 Aggregate Cap on Liability">
                <Disclaimer>
                  PolyForge&rsquo;s total cumulative liability shall not exceed
                  the greater of: (a) fees paid by you in the twelve months
                  preceding the claim; or (b) one hundred U.S. dollars (USD
                  $100).
                </Disclaimer>
              </Sub>

              <Sub title="15.3 Essential Basis">
                <p>
                  You acknowledge these limitations reflect a reasonable
                  allocation of risk and are essential to the agreement.
                  PolyForge would not provide the Service without them.
                </p>
              </Sub>

              <Sub title="15.4 Exceptions">
                <p>
                  Nothing limits liability for: (a) death or personal injury
                  from gross negligence; (b) fraud; or (c) any liability that
                  cannot be excluded by law.
                </p>
              </Sub>
            </Section>

            {/* §16 */}
            <Section title="16. Indemnification">
              <p>
                You agree to indemnify, defend, and hold harmless PolyForge from
                claims arising from: your use of the Service in violation of
                these Terms; violation of any law or third-party rights; your
                trading activity; any User Strategy you operate; any
                misrepresentation regarding eligibility; or any unauthorized
                account access through your credentials.
              </p>
            </Section>

            {/* §17 */}
            <Section title="17. Termination and Suspension">
              <Sub title="17.1 Termination by You">
                <p>
                  You may terminate your account at any time via account
                  settings or by contacting support.
                </p>
              </Sub>

              <Sub title="17.2 Termination or Suspension by PolyForge">
                <p>
                  PolyForge may immediately suspend or terminate your account
                  if you breach these Terms, become a resident of a Restricted
                  Jurisdiction, engage in prohibited activity, attempt to
                  circumvent restrictions, or if regulatory requirements compel
                  us to restrict access.
                </p>
              </Sub>

              <Sub title="17.3 Effect of Termination">
                <p>
                  Upon termination: your license terminates immediately;
                  PolyForge ceases executing strategies; you remain responsible
                  for open positions and outstanding fees; survival clauses
                  (Sections 9, 11, 12, 14, 15, 16, 18, 19, 20) remain in
                  effect.
                </p>
              </Sub>

              <Sub title="17.4 Data Retention After Termination">
                <p>
                  PolyForge will delete or anonymize your personal data per the
                  Privacy Policy and applicable law, retaining transaction logs
                  and compliance records as required.
                </p>
              </Sub>
            </Section>

            {/* §18 */}
            <Section title="18. Dispute Resolution and Arbitration">
              <Disclaimer>
                Please read this section carefully. It affects your legal rights,
                including your right to file a lawsuit in court.
              </Disclaimer>

              <Sub title="18.1 Informal Resolution First">
                <p>
                  Before initiating formal proceedings, contact{" "}
                  <A href="mailto:legal@polyforge.app">legal@polyforge.app</A>.
                  PolyForge will attempt to resolve the dispute informally
                  within 30 days.
                </p>
              </Sub>

              <Sub title="18.2 Binding Arbitration">
                <p>
                  Except for limited exceptions (Sections 18.5 and 18.6),
                  disputes shall be resolved exclusively through binding
                  arbitration administered by the{" "}
                  <strong className="text-primary">
                    International Chamber of Commerce (ICC)
                  </strong>
                  , conducted in English, seated in Paris, France, before a
                  single arbitrator. The award is final and enforceable under the
                  New York Convention.
                </p>
              </Sub>

              <Sub title="18.3 Arbitration Costs">
                <p>
                  For claims of &euro;10,000 or less, PolyForge advances all ICC
                  fees. For claims between &euro;10,000 and &euro;75,000, fees
                  are split equally. The arbitrator may reallocate costs.
                </p>
              </Sub>

              <Sub title="18.4 Arbitration Opt-Out">
                <p>
                  You may opt out within{" "}
                  <strong className="text-primary">30 days</strong> of first
                  accepting these Terms by emailing{" "}
                  <A href="mailto:legal@polyforge.app">legal@polyforge.app</A>.
                </p>
              </Sub>

              <Sub title="18.5 Exceptions to Arbitration">
                <p>
                  Excluded from arbitration: disputes about the Class Action
                  Waiver&rsquo;s enforceability; claims for injunctive relief
                  regarding IP or security; emergency provisional relief.
                </p>
              </Sub>

              <Sub title="18.6 EU Consumer Exception">
                <Callout>
                  <p>
                    If you are an EU consumer where mandatory law prohibits
                    pre-dispute arbitration, Section 18.2 does not apply. You
                    may bring disputes before your local courts or the courts of
                    Paris, France.
                  </p>
                </Callout>
              </Sub>
            </Section>

            {/* §19 */}
            <Section title="19. Class Action Waiver">
              <Disclaimer>
                To the maximum extent permitted by applicable law, each party may
                only bring claims in an individual capacity, not as a plaintiff
                or class member in any class, collective, or representative
                action.
              </Disclaimer>
              <p>
                If you opt out of arbitration under Section 18.4, this waiver
                still applies.
              </p>
              <Callout>
                <p>
                  <strong className="text-primary">EU Consumer Note:</strong>{" "}
                  This waiver does not apply in EU Member States where collective
                  redress mechanisms (such as the <em>action de groupe</em> under
                  French law) are protected by mandatory law.
                </p>
              </Callout>
            </Section>

            {/* §20 */}
            <Section title="20. Governing Law and Jurisdiction">
              <p>
                These Terms are governed by the laws of{" "}
                <strong className="text-primary">France</strong>, without regard
                to conflict of law principles (other than mandatory ones).
              </p>

              <Sub title="20.1 Court Jurisdiction">
                <ul className="list-disc list-inside space-y-2 pl-1">
                  <li>
                    <strong className="text-primary">
                      Commercial disputes (B2B):
                    </strong>{" "}
                    Exclusive jurisdiction of the Tribunal de Commerce de Paris.
                  </li>
                  <li>
                    <strong className="text-primary">
                      Consumer disputes (B2C):
                    </strong>{" "}
                    Mandatory jurisdiction rules of the consumer&rsquo;s country
                    apply.
                  </li>
                </ul>
              </Sub>

              <Sub title="20.2 EU Consumers — Rome I Reservation">
                <p>
                  If you are an EU consumer, you retain protections of your
                  country&rsquo;s mandatory law under EU Regulation (EC) No
                  593/2008 (Rome I).
                </p>
              </Sub>

              <Sub title="20.3 Future Change of Domicile">
                <p>
                  If PolyForge re-domiciles or converts to a different legal
                  structure, we will provide at least 90 days&rsquo; notice.
                  Prior disputes remain subject to French law.
                </p>
              </Sub>
            </Section>

            {/* §21 */}
            <Section title="21. Modifications to Terms">
              <p>
                PolyForge may modify these Terms at any time. We will provide
                notice by posting updated Terms, updating the &ldquo;Last
                Updated&rdquo; date, and emailing registered users for material
                changes. Continued use constitutes acceptance. For material
                adverse changes, at least 30 days&rsquo; notice is provided; you
                may terminate without penalty during this period.
              </p>
            </Section>

            {/* §22 */}
            <Section title="22. Privacy and Data">
              <p>
                Your use of the Service is subject to our{" "}
                <A href="/privacy">Privacy Policy</A>, incorporated by
                reference. By using the Service, you consent to the collection
                and use of your information as described therein.
              </p>
            </Section>

            {/* §23 */}
            <Section title="23. Communications">
              <p>
                By creating an account, you agree to receive transactional
                communications (service updates, security notices, policy
                changes) and optional marketing communications (opt-out
                available). Notices to PolyForge must be sent to{" "}
                <A href="mailto:legal@polyforge.app">legal@polyforge.app</A>.
              </p>
            </Section>

            {/* §24 */}
            <Section title="24. General Provisions">
              <ul className="list-disc list-inside space-y-3 pl-1">
                <li>
                  <strong className="text-primary">Entire Agreement:</strong>{" "}
                  These Terms, with the Privacy Policy, constitute the entire
                  agreement.
                </li>
                <li>
                  <strong className="text-primary">Severability:</strong>{" "}
                  Invalid provisions are modified to the minimum extent
                  necessary; remaining provisions continue.
                </li>
                <li>
                  <strong className="text-primary">Waiver:</strong>{" "}
                  Failure to enforce a provision is not a waiver.
                </li>
                <li>
                  <strong className="text-primary">Assignment:</strong>{" "}
                  You may not assign your rights without consent. PolyForge may
                  freely assign these Terms.
                </li>
                <li>
                  <strong className="text-primary">Force Majeure:</strong>{" "}
                  PolyForge is not liable for failures caused by circumstances
                  beyond reasonable control.
                </li>
                <li>
                  <strong className="text-primary">
                    No Third-Party Beneficiaries.
                  </strong>
                </li>
                <li>
                  <strong className="text-primary">Language:</strong>{" "}
                  The English version governs in any conflict, except where
                  French or EU law mandates a local language version.
                </li>
              </ul>
            </Section>

            {/* §25 */}
            <Section title="25. Contact Information">
              <address className="not-italic space-y-4">
                <div>
                  <p className="font-semibold text-primary">
                    Shems Chelgoui, Entrepreneur Individuel (EI)
                  </p>
                  <p>
                    Micro-entreprise / Auto-entrepreneur &mdash; registered in
                    France
                  </p>
                </div>

                <div className="space-y-2">
                  <p>
                    Legal and compliance:{" "}
                    <A href="mailto:legal@polyforge.app">
                      legal@polyforge.app
                    </A>
                  </p>
                  <p>
                    General support:{" "}
                    <A href="mailto:support@polyforge.app">
                      support@polyforge.app
                    </A>
                  </p>
                  <p>
                    Security and vulnerability disclosure:{" "}
                    <A href="mailto:security@polyforge.app">
                      security@polyforge.app
                    </A>
                  </p>
                  <p>
                    Privacy and GDPR data subject requests:{" "}
                    <A href="mailto:privacy@polyforge.app">
                      privacy@polyforge.app
                    </A>
                  </p>
                </div>
              </address>

              <Callout>
                <p>
                  <strong className="text-primary">
                    Consumer Mediation (M&eacute;diation de la consommation):
                  </strong>{" "}
                  In accordance with Articles L.611-1 to L.616-3 of the French{" "}
                  <em>Code de la consommation</em>, you have the right to free
                  recourse to a consumer mediator. You may also use the{" "}
                  <A href="https://ec.europa.eu/consumers/odr">
                    European Online Dispute Resolution platform
                  </A>
                  .
                </p>
              </Callout>

              <Callout>
                <p>
                  <strong className="text-primary">CNIL:</strong> If you believe
                  your data protection rights have not been respected, you may
                  lodge a complaint with the{" "}
                  <A href="https://www.cnil.fr">
                    Commission Nationale de l&rsquo;Informatique et des
                    Libert&eacute;s (CNIL)
                  </A>
                  , or with the data protection authority of your EU Member
                  State.
                </p>
              </Callout>
            </Section>
          </div>

          <p className="text-body-sm text-tertiary mt-8 italic">
            PolyForge is a software service operated by Shems Chelgoui,
            Entrepreneur Individuel, registered in France, providing strategy
            automation tools for prediction markets. By using PolyForge, you
            acknowledge that you have read, understood, and agree to be bound by
            these Terms of Service.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
