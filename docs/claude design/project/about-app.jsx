/* eslint-disable */
/* About page — origin story, principles, timeline, by-the-numbers */

(() => {
  const { useState } = React;

  const PRINCIPLES = [
    {
      num: '01',
      title: 'Strategies are code.',
      body: 'Every block, condition, and parameter is explicit. No opaque "AI auto-tune." You see exactly why a trade fired — and can version it in git.',
    },
    {
      num: '02',
      title: 'Backtest or it didn’t happen.',
      body: 'Nothing ships to live without a backtest and paper-trading window. We don’t trust vibes, and we don’t expect you to.',
    },
    {
      num: '03',
      title: 'Your keys. Your funds.',
      body: 'We never custody. Trades execute through your own Polymarket or Kalshi account. Signers are isolated, encrypted at rest, and zero-knowledge to the platform.',
    },
    {
      num: '04',
      title: 'Latency matters, but clarity wins.',
      body: 'We shave milliseconds where they move PnL. We spend design bandwidth where they don’t. Users come for speed and stay for the mental model.',
    },
    {
      num: '05',
      title: 'Open by default.',
      body: 'OpenAPI 3.1, MCP server, webhooks, SDKs in three languages. If you want to build a thing on top of Polyforge, we want you to be able to.',
    },
    {
      num: '06',
      title: 'Prediction markets are real markets.',
      body: 'Meme-market sentiment belongs on Twitter. Risk controls, slippage math, and circuit breakers belong here. We treat this as infrastructure.',
    },
  ];

  const STATS = [
    { num: '$412M', label: 'Volume Routed' },
    { num: '2,847', label: 'Strategies Live' },
    { num: '11', label: 'Markets Supported' },
    { num: '99.98%', label: 'Execution Uptime' },
    { num: '180ms', label: 'p50 Order-to-Fill' },
    { num: '42', label: 'Builder Program Tier' },
  ];

  const MILESTONES = [
    {
      date: 'Oct 2024',
      title: 'First strategy survives a Fed week',
      body: 'A two-line EMA cross on "Will Powell cut 50 bps?" held through 4 hours of slippage-hell and came out +11.2%. The thesis became a product.',
    },
    {
      date: 'Jan 2025',
      title: 'Polyforge v0.1 — private alpha',
      body: 'Twelve traders, a visual block editor that crashed on Safari, and a backtest engine written in a weekend. We shipped it anyway.',
    },
    {
      date: 'Jun 2025',
      title: 'Builder program · tier 3',
      body: 'Accepted into Polymarket’s builder program. HMAC-signed attribution on every order. Rebates covered infra through the end of the year.',
    },
    {
      date: 'Nov 2025',
      title: 'Public beta · $50M routed',
      body: 'Open sign-ups. Rust signer landed. 99.98% uptime through the election cycle — the one quarter where uptime actually matters.',
    },
    {
      date: 'Mar 2026',
      title: 'v1.0 — MCP server, Rust SDK, whale intel',
      body: 'Agents can prototype strategies via natural language. Whale feed goes live. Paper-trading is now the default onboarding path.',
    },
  ];

  function App() {
    return (
      <CompanyPage active="about">
        <CompanyPageHeader
          eyebrow="About Polyforge"
          title="We got tired of screen-staring."
          lede="Polyforge is the trading layer we wanted to exist for prediction markets. Built by a team of four in a Shoreditch flat, now infrastructure for thousands of traders who’d rather be sleeping."
          meta={[
            { label: 'Founded', value: '2024' },
            { label: 'Team', value: '12 people · 5 countries' },
            { label: 'HQ', value: 'London · eu-west-2' },
          ]}
        />

        <CompanySection title="Why we built it">
          <div className="about-manifest">
            <p>
              In October 2024 one of us lost $8k on Polymarket because they fell asleep with a position open. The market moved eleven cents against them between 2am and 6am. There was no stop-loss UI. There was no take-profit UI. There was nothing but a spot-price chart and a mobile-web checkout flow built for people buying novelty bets at parties.
            </p>
            <p>
              <strong>Prediction markets had become real markets</strong>, but the tooling had not caught up. We spent a weekend writing a bot. Then another weekend. Then six weekends. The bot made the $8k back, and then some. We showed it to a friend. They wanted one. Then twelve friends wanted one.
            </p>
            <p>
              So we stopped writing our own and started writing <strong>everyone’s</strong>. Polyforge is the tool we wish had existed: a visual strategy builder that compiles to a headless executor, an honest backtest engine, whale intelligence baked in, and APIs for the traders who’d rather write code than click.
            </p>
            <p>
              We are not a hedge fund. We are not financial advisers. We don’t hold your funds, we don’t pick your strategies, and we don’t sell your order flow. We build infrastructure — and we charge for it honestly, because that’s the business model least likely to eventually screw you.
            </p>
          </div>
          <div className="about-signature">
            <span className="about-signature-name">— The Polyforge founders</span>
            <span style={{ color: 'var(--text-tertiary)' }}>· London, 2026</span>
          </div>
        </CompanySection>

        <CompanySection title="Principles" subtitle="Six commitments that drive every product decision. When we violate one, we owe you a postmortem.">
          <div className="about-principles">
            {PRINCIPLES.map((p) => (
              <div className="about-principle" key={p.num}>
                <div className="about-principle-num">PRINCIPLE · {p.num}</div>
                <div className="about-principle-title">{p.title}</div>
                <div className="about-principle-body">{p.body}</div>
              </div>
            ))}
          </div>
        </CompanySection>

        <CompanySection title="By the numbers" subtitle="Updated weekly. No cherry-picking. Incidents and downtime are public on our status page.">
          <div className="about-stats">
            {STATS.map((s) => (
              <div className="about-stat" key={s.label}>
                <div className="about-stat-num">{s.num}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </CompanySection>

        <CompanySection title="How we got here">
          <div className="about-timeline">
            {MILESTONES.map((m, i) => (
              <div className="about-timeline-entry" key={i}>
                <div className="about-timeline-date">{m.date}</div>
                <div className="about-timeline-title">{m.title}</div>
                <div className="about-timeline-body">{m.body}</div>
              </div>
            ))}
          </div>
        </CompanySection>

        <CompanySection>
          <div style={{
            padding: '32px', border: '1px solid var(--border-subtle)', borderRadius: 12,
            background: 'var(--bg-surface)', textAlign: 'center',
            backgroundImage: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--accent-default) 8%, transparent), transparent 70%)'
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Want to build the next thing with us?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>
              We’re a small team hiring a handful of engineers who like quant infrastructure, edge-latency systems, or making design decisions that cost money to get wrong.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="btn btn-primary btn-sm" href="mailto:jobs@polyforge.app">See open roles</a>
              <a className="btn btn-secondary btn-sm" href="Contact.html">Get in touch</a>
            </div>
          </div>
        </CompanySection>
      </CompanyPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
