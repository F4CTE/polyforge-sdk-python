import { Link } from 'react-router';
import { ArrowLeft, Zap } from 'lucide-react';

const LAST_UPDATED = 'March 27, 2026';

export function Component() {
  return (
    <div className="min-h-screen bg-app text-primary">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-body-sm text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-primary">
            <Zap className="size-4 text-accent-text" />
            <span className="font-semibold">Polyforge</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-primary mb-2">Privacy Policy</h1>
        <p className="text-body-sm text-tertiary mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-body-sm text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">1. Overview</h2>
            <p>Polyforge ("we", "our") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information when you use our Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-medium text-primary mt-4 mb-2">2.1 Account Information</h3>
            <p>When you register, we collect your email address, username, and hashed password. You may optionally provide a display name and avatar.</p>
            <h3 className="text-base font-medium text-primary mt-4 mb-2">2.2 Usage Data</h3>
            <p>We automatically collect information about how you interact with the Platform, including pages visited, features used, API calls made, and error events. This data is collected via server-side logs and does not include third-party analytics trackers.</p>
            <h3 className="text-base font-medium text-primary mt-4 mb-2">2.3 Trading Activity</h3>
            <p>We store the orders, positions, strategy configurations, and backtest results associated with your account in order to provide the service.</p>
            <h3 className="text-base font-medium text-primary mt-4 mb-2">2.4 Wallet and Key Material</h3>
            <p>If you connect a Polymarket wallet, we store an encrypted copy of your signing key. Keys are encrypted using AES-256-GCM with envelope encryption (a data encryption key wrapped by a key-encryption key). Key material is handled exclusively by a dedicated signer service with memory-locked buffers and automatic zeroization. We never store plaintext private keys at rest.</p>
            <h3 className="text-base font-medium text-primary mt-4 mb-2">2.5 Communications</h3>
            <p>When you contact us by email or through support channels, we retain those communications to assist you and improve our service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To create and maintain your account;</li>
              <li>To execute and record trading activity on your behalf;</li>
              <li>To send transactional emails (email verification, password reset, trade confirmations);</li>
              <li>To detect and prevent fraud, abuse, and security incidents;</li>
              <li>To improve the Platform based on aggregated usage patterns;</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties. We do not use your data for targeted advertising.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">4. Legal Bases for Processing (GDPR)</h2>
            <p>For users in the European Economic Area, we process your data on the following legal bases: performance of a contract (providing the service you signed up for), legitimate interests (security and fraud prevention), compliance with legal obligations, and consent where explicitly requested.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">5. Data Retention</h2>
            <p>Account and trading data is retained for the lifetime of your account and for up to 7 years after account deletion to satisfy legal and audit obligations. Logs are retained for 90 days. You may request earlier deletion of personal data subject to legal constraints by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">6. Data Sharing</h2>
            <p className="mb-2">We share your data only with:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-primary">Infrastructure providers</strong> -- cloud hosting, database, and email delivery vendors operating under data processing agreements;</li>
              <li><strong className="text-primary">Legal authorities</strong> -- when required by law, court order, or to protect the rights and safety of users or the public.</li>
            </ul>
            <p className="mt-3">Publicly shared strategies display your username and display name. Strategy content is visible to all logged-in users when you set visibility to "public".</p>
            <p className="mt-2">If you enable copy trading, your strategy name, performance history, and win rate are displayed to other users. Copiers' individual allocations and trade activity are visible only to the copier and to administrators for fraud prevention purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">7. Security</h2>
            <p>We use industry-standard security measures including TLS encryption in transit, bcrypt password hashing, JWT-based authentication with short-lived tokens, role-based access controls, CSRF protection, and rate limiting on all endpoints. Wallet signing keys are encrypted with AES-256-GCM using hardware-grade envelope encryption with memory-locked key buffers. No security measure is perfect; please enable two-factor authentication on your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">8. Cookies and Local Storage</h2>
            <p>We use browser local storage to persist your authentication token and UI preferences. We do not use third-party tracking cookies. No data is shared with advertising networks.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">9. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Access the personal data we hold about you;</li>
              <li>Correct inaccurate data;</li>
              <li>Request deletion of your personal data ("right to be forgotten");</li>
              <li>Object to or restrict processing;</li>
              <li>Data portability (receive a machine-readable copy of your data);</li>
              <li>Withdraw consent at any time, without affecting lawfulness of prior processing.</li>
            </ul>
            <p className="mt-3">To exercise these rights, email <a href="mailto:privacy@polyforge.app" className="text-accent-text hover:underline">privacy@polyforge.app</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">10. Children's Privacy</h2>
            <p>The Platform is not directed to individuals under 18 years of age. We do not knowingly collect personal data from children. If you believe a child has created an account, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. Material changes will be communicated to registered users by email at least 14 days before taking effect. Continued use after that date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">12. Contact</h2>
            <p>For privacy-related questions or requests, contact: <a href="mailto:privacy@polyforge.app" className="text-accent-text hover:underline">privacy@polyforge.app</a>.</p>
          </section>
        </div>

        {/* Footer */}
        <nav aria-label="Legal pages" className="flex items-center gap-3 mt-12 pt-6 border-t border-subtle text-body-sm text-tertiary">
          <Link to="/terms" className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">Terms of Service</Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/login" className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">Sign in</Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/register" className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm">Register</Link>
        </nav>
      </main>
    </div>
  );
}
