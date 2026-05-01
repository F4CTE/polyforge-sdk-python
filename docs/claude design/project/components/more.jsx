/* ========= New sections: Trust strip, Smart Execution, Feature matrix ========= */

/* --- 03 Trust strip --- */
function TrustStrip() {
  const items = [
    { num: '01', title: 'Self-custodial',  desc: 'Your Polymarket credentials — imported, never generated. You keep full control.' },
    { num: '02', title: 'AES-256 encryption', desc: 'Envelope encryption with keys in AWS Secrets Manager. Quarterly rotation.' },
    { num: '03', title: 'Isolated signer',  desc: 'Zero public exposure. Every trade signed in a locked-down service.' },
    { num: '04', title: 'Open APIs',        desc: 'OpenAPI 3.1 spec, HMAC webhooks, TOTP 2FA, JWT auth. No cookies.' },
  ];
  return (
    <section className="trust-strip">
      <div className="container">
        <div className="trust-grid">
          {items.map(it => (
            <div key={it.title} className="trust-item">
              <span className="trust-num mono">{it.num}</span>
              <div className="trust-title">{it.title}</div>
              <div className="trust-desc">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- Smart Execution alternating row --- */
function SmartExecutionSection() {
  return (
    <section className="pf-section" id="execution">
      <div className="container">
        <div className="showcase-row">
          <div className="showcase-text">
            <div className="eyebrow">07 · Smart execution</div>
            <h2 className="h2">Institutional-grade orders. One click.</h2>
            <p className="section-body">Bracket orders, TWAP tranches, DCA schedules, OCO pairs, trailing stops, scale-in / scale-out. The primitives you'd build in-house at a prop shop — available in the builder and via API.</p>
            <ul className="bullets">
              <li><Icon name="check" size={14}/> Bracket · entry + TP + SL as one linked bundle</li>
              <li><Icon name="check" size={14}/> TWAP · time-weighted tranches on any interval</li>
              <li><Icon name="check" size={14}/> DCA · dollar-cost averaging on a schedule</li>
              <li><Icon name="check" size={14}/> OCO · one-cancels-other linked orders</li>
              <li><Icon name="check" size={14}/> Trailing stops, scale-in, scale-out, bulk cancel</li>
            </ul>
          </div>
          <div className="showcase-visual" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bracket order</span>
              <span className="chip accent">active</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>BTC&gt;150K · YES · 0.31</span>
            </div>
            <div style={{ padding: 20 }}>
              {[
                ['Entry',      'BUY 1,500 @ 0.31', 'filled',     'var(--gain-text)'],
                ['Take-profit','SELL 1,500 @ 0.42', 'working',    'var(--accent-text)'],
                ['Stop-loss',  'SELL 1,500 @ 0.27', 'working',    'var(--warning)'],
              ].map(([l, v, st, c]) => (
                <div key={l} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: c }}/>
                    <span className="t-label">{l}</span>
                  </div>
                  <span className="mono tabnum" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</span>
                  <span className="mono" style={{ fontSize: 11, color: c, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>{st}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[['Max gain','+$165','var(--gain-text)'],['Max loss','-$60','var(--loss-text)'],['R:R','2.75','var(--accent-text)']].map(([l,v,c]) => (
                  <div key={l} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                    <div className="t-caption text-tertiary">{l}</div>
                    <div className="mono tabnum" style={{ fontSize: 14, fontWeight: 600, color: c, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- Feature matrix: the rest, compact --- */
function FeatureMatrix() {
  const cells = [
    { icon: 'users',   title: 'Copy trading',       desc: 'Mirror any trader with fixed, proportional, or Kelly sizing. Own-wallet, own-keys.' },
    { icon: 'split',   title: 'Merge arbitrage',    desc: 'Scanner finds YES + NO < $1. One click buys both sides and merges.' },
    { icon: 'store',   title: 'Strategy marketplace', desc: 'Rent or sell strategies with on-chain verified P&L. 0–20% performance fee.' },
    { icon: 'cpu',     title: 'AI & MCP',           desc: 'News→signal pipeline. Natural-language queries. 33 MCP tools for Claude Desktop.' },
    { icon: 'bell',    title: 'Notifications',      desc: 'Email, in-app, Telegram, Discord, WhatsApp — per-event, per-channel, digests.' },
    { icon: 'chart-bar', title: 'Analytics',        desc: 'Edge score, P&L attribution, correlation heatmap, calibration curves, tax CSV.' },
    { icon: 'layout-grid', title: 'Market browser', desc: 'Every market, filtered. OHLCV charts, order book depth, price alerts.' },
    { icon: 'coins',   title: 'Market making',      desc: 'One-click LP on any market. Set capital + spread, we quote both sides.' },
    { icon: 'rocket',  title: 'Onboarding',         desc: 'Browse → verify → connect. Guided import wizard. 5 strategy templates.' },
  ];
  return (
    <section className="pf-section" id="everything">
      <div className="container">
        <SectionHead
          eyebrow="08 · Everything else"
          title="A full stack for serious prediction-market traders."
          body="Beyond the builder, the whale feed, and the backtest — these are the pieces that turn the terminal into a workflow."
        />
        <div style={{
          display: 'grid',
          gap: 1,
          background: 'var(--border-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          overflow: 'hidden',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}>
          {cells.map(c => (
            <div key={c.title} style={{ background: 'var(--bg-surface)', padding: '24px 24px 28px', transition: 'background 120ms ease', cursor: 'default' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            >
              <span style={{ color: 'var(--accent-text)', display: 'inline-flex', marginBottom: 14 }}><Icon name={c.icon} size={18}/></span>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 6 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-tertiary)' }} className="mono">
          <span>100+ API endpoints</span><span>·</span>
          <span>33 MCP tools</span><span>·</span>
          <span>15 achievement badges</span><span>·</span>
          <span>13 backend services</span><span>·</span>
          <span>3 SDKs</span>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { TrustStrip, SmartExecutionSection, FeatureMatrix, EthosBand });

/* --- Editorial pull-quote band: full-bleed, breaks vertical rhythm --- */
function EthosBand() {
  return (
    <section className="ethos-band" aria-label="Operating principles">
      <div className="container">
        <div className="ethos-eyebrow">
          <span className="ethos-mark" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="5" cy="5" r="1.6" fill="currentColor"/>
            </svg>
          </span>
          <span>Operating principle · 01</span>
        </div>
        <p className="ethos-quote">
          A market edge that you can&apos;t <em>describe</em>, <em>backtest</em>, and <em>automate</em> isn&apos;t an edge — it&apos;s a feeling.
        </p>
        <div className="ethos-meta">
          <div className="ethos-meta-cell">
            <div className="ethos-meta-k">Describe</div>
            <div className="ethos-meta-v">36 visual blocks. No code.</div>
          </div>
          <div className="ethos-meta-cell">
            <div className="ethos-meta-k">Backtest</div>
            <div className="ethos-meta-v">2 yrs of book-level data.</div>
          </div>
          <div className="ethos-meta-cell">
            <div className="ethos-meta-k">Automate</div>
            <div className="ethos-meta-v">Paper → live, one toggle.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
