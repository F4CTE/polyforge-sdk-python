/* Guide — Account & Billing */
const TOC = [
  { id: 'plans', text: 'Plans, simply', level: 2 },
  { id: 'trial', text: 'The free trial', level: 2 },
  { id: 'upgrade', text: 'Upgrading your plan', level: 2 },
  { id: 'seats', text: 'Seats & team billing', level: 2 },
  { id: 'invoices', text: 'Invoices & receipts', level: 2 },
  { id: 'funding', text: 'Funding your trading wallet', level: 2 },
  { id: 'cancel', text: 'Cancelling or downgrading', level: 2 },
  { id: 'refunds', text: 'Refunds', level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="billing"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Your account' }, { label: 'Account & billing' }]}
      prev={{ title: 'Paper → Live', href: 'Guide-Going-Live.html' }}
      next={{ title: 'Security & 2FA', href: 'Guide-Security.html' }}
    >
      <h1>Account & billing</h1>
      <p className="docs-lede">Everything about the part of Polyforge that costs money. Plans, invoices, seats, wallet funding, and how to leave if you need to. No dark patterns — if you want to downgrade or cancel, it's two clicks.</p>

      <h2 id="plans">Plans, simply</h2>
      <ul>
        <li><strong>Free</strong> — unlimited paper trading, 1 live strategy, community support. Good forever.</li>
        <li><strong>Pro ($49/mo)</strong> — 10 live strategies, top-500 whale feed, backtest priority, email support.</li>
        <li><strong>Team ($199/mo)</strong> — unlimited strategies, custom whale cohorts, 5 seats included, Slack/Zoom support.</li>
        <li><strong>Enterprise</strong> — self-hosted execution, SOC 2, dedicated infra. <a href="Contact.html">Contact sales</a>.</li>
      </ul>
      <p>Full feature comparison on the <a href="Pricing.html">Pricing page</a>.</p>

      <h2 id="trial">The free trial</h2>
      <p>Pro and Team plans come with a 14-day free trial. No credit card required to start — we only ask when the trial ends. If you do nothing at the end of the trial, you get automatically moved to the Free plan. No surprise charges.</p>

      <h2 id="upgrade">Upgrading your plan</h2>
      <p>Settings → Billing → Change plan. Upgrades take effect immediately and are prorated — if you upgrade 10 days into the month, you only pay for the remaining 20 days at the higher tier.</p>

      <h2 id="seats">Seats & team billing</h2>
      <p>Team plans come with 5 seats. Add more at $29/seat/month. Each seat is a person — they get their own login, their own API keys, their own strategies. The team owner sees billing for everyone.</p>
      <Callout type="tip" title="Seats vs. strategies">Seats are about people. Strategies are per-account, not per-seat. A 5-seat team can have hundreds of strategies running — the cap is only on the number of humans.</Callout>

      <h2 id="invoices">Invoices & receipts</h2>
      <p>Every charge generates a PDF invoice, emailed the same day and permanently stored in Settings → Billing → Invoices. If you need a VAT-inclusive invoice or a company name on it, set that in Settings → Billing → Company details — future invoices will include it.</p>

      <h2 id="funding">Funding your trading wallet</h2>
      <p>This is the part new users find confusing: <strong>Polyforge doesn't hold your money.</strong> Your trading capital lives in your venue account — Polymarket, Kalshi, or both. We connect to each one, but we never custody a dollar.</p>
      <p>To fund:</p>
      <ol>
        <li>Deposit with your venue directly — <a href="https://polymarket.com">polymarket.com</a> (USDC on Polygon) or <a href="https://kalshi.com">kalshi.com</a> (ACH / wire / debit).</li>
        <li>Back in Polyforge, go to Settings → Venues. Each connected venue's balance should refresh automatically.</li>
        <li>Set your strategy's <strong>bankroll</strong> to at most the balance on the venue it's scoped to. You can allocate less if you want a safety buffer, or split bankroll across both.</li>
      </ol>
      <Callout type="tip" title="Per-venue bankroll">Strategies scoped to multiple venues get one bankroll figure, but we enforce it per-venue using the live balance on each side. A strategy can never spend money that isn't there.</Callout>

      <h2 id="cancel">Cancelling or downgrading</h2>
      <p>Settings → Billing → Cancel plan. You keep Pro/Team features until the end of your billing period, then drop to the Free tier. We don't do win-back flows or 3-page exit surveys. Click, confirm, done.</p>

      <h2 id="refunds">Refunds</h2>
      <p>If you're charged for a month you didn't use — for example, you cancelled but somehow got charged anyway — email <a href="mailto:billing@polyforge.app">billing@polyforge.app</a>. We refund these same-day, no argument.</p>
      <p>We don't refund for "I didn't trade much this month". Plans are flat-rate and you're welcome to downgrade whenever.</p>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
