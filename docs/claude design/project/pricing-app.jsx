/* Pricing page — tiers, comparison table, volume calculator, FAQ, enterprise CTA */
const { useState, useMemo, useRef, useEffect } = React;

// ----- Data -----
const TIERS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    bps: 5,
    volumeIncluded: '$10k / mo',
    desc: 'Enough to run a full strategy against your own account. No trial clock.',
    cta: 'start free',
    ctaStyle: 'secondary',
    features: [
      { t: 'Unlimited strategies', strong: true },
      { t: 'Paper + live trading' },
      { t: '1 connected exchange' },
      { t: 'Polyforge SDK (TS, Python, Rust)' },
      { t: 'Community support (Discord)' },
      { t: '$10k/mo execution volume', mono: true },
      { t: '5 bps fee on executed volume', mono: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceAnnual: 39,
    bps: 3,
    volumeIncluded: '$250k / mo',
    desc: 'For serious quants running multiple strategies with live capital.',
    cta: 'start pro trial',
    ctaStyle: 'primary',
    featured: true,
    features: [
      { t: 'Everything in Free', strong: true },
      { t: '5 connected exchanges' },
      { t: 'Whale feed (top 500 wallets)', strong: true },
      { t: 'Webhook + Discord + Telegram alerts' },
      { t: 'Custom block publishing' },
      { t: 'Priority email support (< 24h)' },
      { t: '$250k/mo execution volume', mono: true },
      { t: '3 bps fee on executed volume', mono: true },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthly: 199,
    priceAnnual: 159,
    bps: 1.5,
    volumeIncluded: '$2M / mo',
    desc: 'For funds and trading desks with multiple operators.',
    cta: 'start team trial',
    ctaStyle: 'secondary',
    features: [
      { t: 'Everything in Pro', strong: true },
      { t: '10 seats included ($12/seat after)' },
      { t: 'SSO (Google, Okta, Azure AD)' },
      { t: 'Role-based access (operator, auditor, admin)', strong: true },
      { t: 'SOC 2 audit logs + SIEM export' },
      { t: 'Shared block libraries' },
      { t: '$2M/mo execution volume', mono: true },
      { t: '1.5 bps fee on executed volume', mono: true },
      { t: 'Slack + 4h support SLA' },
    ],
  },
];

const COMPARE = [
  { group: 'Strategies & execution' },
  { row: 'Live strategies', free: 'Unlimited', pro: 'Unlimited', team: 'Unlimited' },
  { row: 'Connected exchanges', free: '1', pro: '5', team: 'Unlimited' },
  { row: 'Included monthly volume', free: '$10k', pro: '$250k', team: '$2M' },
  { row: 'Fee on executed volume', free: '5 bps', pro: '3 bps', team: '1.5 bps' },
  { row: 'Paper trading', free: true, pro: true, team: true },
  { row: 'Backtest engine', free: true, pro: true, team: true },
  { row: 'Monte Carlo sweeps', free: false, pro: true, team: true },
  { row: 'Copy trading', free: false, pro: true, team: true },

  { group: 'Data & signals' },
  { row: 'Market data feed', free: true, pro: true, team: true },
  { row: 'Whale wallet feed', free: '5 wallets', pro: 'Top 500', team: 'Custom cohort' },
  { row: 'Historical backfill', free: '90 days', pro: '2 years', team: '7 years' },
  { row: 'Custom indicator blocks', free: false, pro: true, team: true },
  { row: 'Block publishing (public)', free: false, pro: true, team: true },

  { group: 'Integrations' },
  { row: 'SDKs (TS / Python / Rust)', free: true, pro: true, team: true },
  { row: 'CLI', free: true, pro: true, team: true },
  { row: 'MCP server', free: true, pro: true, team: true },
  { row: 'Webhook + Discord + TG alerts', free: 'Discord only', pro: true, team: true },
  { row: 'Slack alerts', free: false, pro: false, team: true },

  { group: 'Team & security' },
  { row: 'Seats', free: '1', pro: '1', team: '10 included' },
  { row: 'SSO', free: false, pro: false, team: true },
  { row: 'Role-based access', free: false, pro: false, team: true },
  { row: 'SOC 2 audit logs', free: false, pro: false, team: true },
  { row: 'SIEM / Splunk export', free: false, pro: false, team: true },

  { group: 'Support' },
  { row: 'Channel', free: 'Community Discord', pro: 'Priority email', team: 'Slack + email' },
  { row: 'Response SLA', free: 'Best effort', pro: '< 24h', team: '< 4h' },
  { row: 'Dedicated CSM', free: false, pro: false, team: 'Enterprise only' },
];

const FAQ = [
  { q: 'What is a "bp" and why do you charge one?',
    a: '1 bp (basis point) = 0.01%. If you execute $100k of volume at 3 bps, that\'s $30. We charge on volume so the cost scales with how useful Polyforge actually is — not flat seats you aren\'t using. Exchange fees are separate and go to the exchange.' },
  { q: 'What counts as "executed volume"?',
    a: 'Notional USD value of trades your strategies send to a live venue. Paper trades, cancels, and unfilled limit orders don\'t count. Transfers between your own wallets don\'t count.' },
  { q: 'What happens if I blow past my included volume?',
    a: 'Nothing breaks. You keep executing and we bill the overage at your tier\'s bps at the end of the month. We email you at 80% and 100% of included volume so there are no surprises.' },
  { q: 'Can I switch between monthly and annual?',
    a: 'Yes, anytime. Switching to annual pro-rates a credit for the unused portion of your current month. Switching off annual takes effect at the end of your current billing period — no refunds for mid-cycle downgrades.' },
  { q: 'Do you offer a trial for Pro or Team?',
    a: '14 days, full feature access, no credit card. You can also just use Free indefinitely if the $10k/mo cap covers your volume.' },
  { q: 'What payment methods do you accept?',
    a: 'Stripe for cards (Visa / Mastercard / Amex) and ACH on annual plans. Wire transfer and invoicing available on Team and Enterprise. USDC on Polygon for Enterprise on request.' },
  { q: 'Is there a self-hosted / on-prem option?',
    a: 'Yes — Enterprise only. You run the Polyforge stack in your own VPC; we provide a signed Helm chart and a support contract. Talk to sales for pricing.' },
  { q: 'Can I get a refund?',
    a: 'Prorated refund within 30 days of initial signup, no questions asked. After that: credit toward future months. Volume-based fees are non-refundable once the trade is executed on-venue.' },
  { q: 'What\'s your uptime SLA?',
    a: 'Pro: 99.5% monthly. Team: 99.9% monthly. Enterprise: custom. If we miss it, you get service credits — see the MSA. Live status at status.polyforge.app.' },
  { q: 'Do you custody my funds?',
    a: 'No, ever. Polyforge never touches your private keys or exchange API withdrawal permissions. Strategies route orders through your own keys with trade-only scopes. We physically cannot move your funds.' },
];

// ----- Components -----

function BillingToggle({ annual, setAnnual }) {
  return (
    <div className="billing-toggle" role="group" aria-label="Billing period">
      <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
      <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
        Annual <span className="save-pill">save 20%</span>
      </button>
    </div>
  );
}

function TierCard({ tier, annual }) {
  const price = annual ? tier.priceAnnual : tier.priceMonthly;
  return (
    <div className={`tier-card${tier.featured ? ' featured' : ''}`}>
      {tier.featured && <span className="tier-featured-pill">Most popular</span>}
      <div className="tier-name">{tier.name}</div>
      <div className="tier-price">
        <span className="tier-price-amount">${price}</span>
        <span className="tier-price-unit">/ month</span>
      </div>
      <div className="tier-price-annual">
        {annual && tier.priceMonthly > 0 ? (
          <>billed annually · <s>${tier.priceMonthly}/mo</s></>
        ) : tier.priceMonthly === 0 ? (
          'no credit card required'
        ) : (
          'billed monthly'
        )}
      </div>
      <div className="tier-volume">
        <span className="tier-volume-label">Includes</span>
        <span className="tier-volume-value">{tier.volumeIncluded}</span>
      </div>
      <p className="tier-desc">{tier.desc}</p>
      <div className="tier-cta">
        <a href="#" className={`btn btn-${tier.ctaStyle}`}>
          {tier.cta}
          {tier.ctaStyle === 'primary' && <Icon name="arrow-right" size={14} />}
        </a>
      </div>
      <ul className="tier-features">
        {tier.features.map((f, i) => (
          <li key={i}>
            <Icon name="check" size={14} />
            <span>{f.strong ? <strong>{f.t}</strong> : f.mono ? <code style={{fontFamily: "'Geist Mono', monospace", fontSize: 12.5}}>{f.t}</code> : f.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareCell({ v, featured }) {
  const cls = featured ? 'col-featured' : '';
  if (v === true) return <td className={cls}><Icon name="check" size={16} className="compare-check" /></td>;
  if (v === false) return <td className={cls}><span className="compare-dash">—</span></td>;
  return <td className={cls}>{v}</td>;
}

function ComparisonTable() {
  return (
    <div className="compare-wrap">
      <div style={{marginBottom: 24}}>
        <div className="eyebrow" style={{color: 'var(--text-tertiary)'}}>Compare</div>
        <h2 style={{fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em', margin: '6px 0 0', color: 'var(--text-primary)'}}>Every feature, side by side</h2>
      </div>
      <table className="compare-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Free<span className="compare-price">$0/mo · 5 bps</span></th>
            <th className="featured">Pro<span className="compare-price">$49/mo · 3 bps</span></th>
            <th>Team<span className="compare-price">$199/mo · 1.5 bps</span></th>
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((row, i) => {
            if (row.group) return (
              <tr key={i} className="compare-group">
                <td colSpan={4}>{row.group}</td>
              </tr>
            );
            return (
              <tr key={i}>
                <td>{row.row}</td>
                <CompareCell v={row.free} />
                <CompareCell v={row.pro} featured />
                <CompareCell v={row.team} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Logarithmic-ish volume scale for the slider
const VOL_STEPS = [
  1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000,
];
function fmtUsd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `$${v}`;
}
function fmtUsdPrecise(v) {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function Calculator() {
  const [idx, setIdx] = useState(7); // default $250k
  const volume = VOL_STEPS[idx];
  const breakdown = useMemo(() => {
    return TIERS.map(tier => {
      const bpsCost = volume * (tier.bps / 10000);
      const monthlyCost = tier.priceMonthly + bpsCost;
      return { tier, bpsCost, monthlyCost };
    });
  }, [volume]);
  const cheapestIdx = useMemo(() => {
    let min = Infinity, mi = 0;
    breakdown.forEach((b, i) => { if (b.monthlyCost < min) { min = b.monthlyCost; mi = i; } });
    return mi;
  }, [breakdown]);

  return (
    <div className="calc-card">
      <div className="calc-head">
        <div>
          <h3 className="calc-title">Cost calculator</h3>
          <p className="calc-sub">Drag to your expected monthly execution volume. We'll show which tier is cheapest.</p>
        </div>
      </div>
      <div className="calc-slider-row">
        <div>
          <div className="calc-slider-label">
            <span>Monthly execution volume</span>
            <span className="calc-slider-value">{fmtUsd(volume)}</span>
          </div>
          <input
            type="range"
            className="calc-slider"
            min="0"
            max={VOL_STEPS.length - 1}
            step="1"
            value={idx}
            onChange={(e) => setIdx(parseInt(e.target.value))}
          />
          <div className="calc-ticks">
            <span>$1k</span><span>$10k</span><span>$100k</span><span>$1M</span><span>$25M</span>
          </div>
        </div>
        <div className="calc-breakdown">
          {breakdown.map((b, i) => (
            <div key={b.tier.id} className={`calc-row${i === cheapestIdx ? ' recommended' : ''}`}>
              <span className="calc-row-tier">{b.tier.name}</span>
              <span className="calc-row-break">
                ${b.tier.priceMonthly} + {b.tier.bps} bps
              </span>
              <span className="calc-row-total">{fmtUsdPrecise(b.monthlyCost)}/mo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ item, open, onToggle }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      el.style.maxHeight = el.scrollHeight + 'px';
    } else {
      el.style.maxHeight = '0px';
    }
  }, [open]);
  return (
    <div className="faq-item">
      <button className="faq-q" aria-expanded={open} onClick={onToggle}>
        <span>{item.q}</span>
        <span className="faq-chev"><Icon name="chevron-down" size={16} /></span>
      </button>
      <div className="faq-a" ref={bodyRef}>
        <div className="faq-a-inner">{item.a}</div>
      </div>
    </div>
  );
}

function FAQ_Section() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="faq-section">
      <div style={{marginBottom: 28}}>
        <div className="eyebrow" style={{color: 'var(--text-tertiary)'}}>Questions</div>
        <h2 style={{fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em', margin: '6px 0 0', color: 'var(--text-primary)'}}>Frequently asked</h2>
      </div>
      {FAQ.map((item, i) => (
        <FAQItem key={i} item={item} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
      ))}
    </div>
  );
}

function Enterprise() {
  return (
    <div className="enterprise-card">
      <div>
        <div className="enterprise-eyebrow">Enterprise</div>
        <h3 className="enterprise-title">Running a fund? Let's talk.</h3>
        <p className="enterprise-body">
          Custom volume commits, dedicated support, self-hosted deployment, SOC 2 / ISO 27001 paperwork, and the hand-holding you'd expect from a partner that understands the regulatory environment you're in.
        </p>
        <a href="mailto:sales@polyforge.app" className="btn btn-primary">
          talk to sales <Icon name="arrow-right" size={14} />
        </a>
      </div>
      <div className="enterprise-features">
        <div><Icon name="check" size={14} /><span>Self-hosted in your VPC</span></div>
        <div><Icon name="check" size={14} /><span>Unlimited seats</span></div>
        <div><Icon name="check" size={14} /><span>99.99% uptime SLA</span></div>
        <div><Icon name="check" size={14} /><span>Dedicated CSM</span></div>
        <div><Icon name="check" size={14} /><span>Custom MSA / DPA</span></div>
        <div><Icon name="check" size={14} /><span>SOC 2 Type II report</span></div>
        <div><Icon name="check" size={14} /><span>Custom integrations</span></div>
        <div><Icon name="check" size={14} /><span>Paid pilot program</span></div>
      </div>
    </div>
  );
}

// ----- Main -----
function PricingPage() {
  const [annual, setAnnual] = useState(true);
  return (
    <main className="pricing-main">
      <div className="pricing-container">
        <header className="pricing-header">
          <span className="eyebrow">
            <span className="dot" style={{background: 'var(--accent-default)'}}></span>
            PRICING
          </span>
          <h1>Priced like a tool, not a fund.</h1>
          <p className="lede">
            Start free. Pay monthly for the features you need, plus a small basis-point fee on volume you actually execute. No per-seat tax. No calls with a rep to see a price.
          </p>
          <BillingToggle annual={annual} setAnnual={setAnnual} />
        </header>

        <div className="tier-grid">
          {TIERS.map(t => <TierCard key={t.id} tier={t} annual={annual} />)}
        </div>

        <Calculator />
        <ComparisonTable />
        <FAQ_Section />
        <Enterprise />
      </div>
    </main>
  );
}

function App() {
  return (
    <>
      <Nav active="pricing" />
      <PricingPage />
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
