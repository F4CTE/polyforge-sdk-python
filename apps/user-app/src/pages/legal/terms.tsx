import { Link } from 'react-router';
import { ArrowLeft, Zap } from 'lucide-react';

const LAST_UPDATED = 'January 15, 2025';

export function Component() {
  return (
    <div className="min-h-screen bg-pf-base">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-sm text-pf-text-muted hover:text-pf-text transition-colors">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-pf-text">
            <Zap className="size-4 text-pf-cyan-400" />
            <span className="font-semibold">Polyforge</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-pf-text mb-2">Terms of Service</h1>
        <p className="text-sm text-pf-text-muted mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm text-pf-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Polyforge ("the Platform", "we", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">2. Description of Service</h2>
            <p>Polyforge is an algorithmic trading platform that allows users to build, backtest, and deploy automated trading strategies on prediction markets. The Platform provides data, tooling, and execution infrastructure. It does not provide financial advice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">3. Eligibility</h2>
            <p>You must be at least 18 years old and legally permitted to participate in prediction markets in your jurisdiction to use the Platform. By creating an account you represent and warrant that you meet these requirements.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">4. Accounts and Security</h2>
            <p>You are responsible for maintaining the confidentiality of your credentials. You agree to notify us immediately of any unauthorized use of your account. Polyforge is not liable for losses arising from unauthorized account access where you have not reported the issue promptly.</p>
            <p className="mt-2">During the early-access period, accounts may only be created with a valid invite code. Invite codes are non-transferable and may not be sold.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">5. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-pf-text-secondary">
              <li>Use the Platform for any unlawful purpose or in violation of any regulations;</li>
              <li>Attempt to circumvent rate limits, access controls, or security measures;</li>
              <li>Scrape, reverse-engineer, or reproduce any part of the Platform without written consent;</li>
              <li>Submit strategies designed to manipulate markets or harm other users;</li>
              <li>Share your account credentials with third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">6. Trading Risks</h2>
            <p>Prediction market trading involves substantial risk of loss. Past strategy performance is not indicative of future results. The Platform provides no guarantee of profit, and you may lose some or all of the funds you deploy. You trade at your own risk.</p>
            <p className="mt-2">Automated strategies may continue to place orders without your active supervision. You are solely responsible for monitoring your strategies and the positions they create.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">7. Intellectual Property</h2>
            <p>You retain ownership of the strategies you create. By publishing a strategy as public or community-visible, you grant Polyforge and other users a non-exclusive license to view, fork, and learn from your strategy under the terms of the Platform's community sharing features.</p>
            <p className="mt-2">All Platform software, design, trademarks, and content are owned by Polyforge and may not be used without explicit permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">8. Fees and Payments</h2>
            <p>Current Platform access is provided free of charge during the early-access beta. Fee structures, if introduced, will be communicated with at least 30 days' notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">9. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, without prior notice. You may delete your account at any time from the Settings page.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">10. Disclaimers</h2>
            <p className="uppercase text-xs tracking-wide">THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. POLYFORGE MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">11. Limitation of Liability</h2>
            <p className="uppercase text-xs tracking-wide">TO THE MAXIMUM EXTENT PERMITTED BY LAW, POLYFORGE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE PLATFORM.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">12. Governing Law</h2>
            <p>These terms shall be governed by the laws of the jurisdiction in which Polyforge is incorporated, without regard to conflict-of-law principles.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">13. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Platform after changes are posted constitutes acceptance of the revised terms. We will notify registered users of material changes by email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-pf-text mb-3">14. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@polyforge.app" className="text-pf-cyan-400 hover:underline">legal@polyforge.app</a>.</p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-12 pt-6 border-t border-pf-border-subtle text-sm text-pf-text-muted">
          <Link to="/privacy" className="hover:text-pf-text transition-colors">Privacy Policy</Link>
          <span>&middot;</span>
          <Link to="/login" className="hover:text-pf-text transition-colors">Sign in</Link>
          <span>&middot;</span>
          <Link to="/register" className="hover:text-pf-text transition-colors">Register</Link>
        </div>
      </div>
    </div>
  );
}
