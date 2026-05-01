function SectionHead({ eyebrow, title, body, align = 'left' }) {
  return (
    <div className="section-head" style={align === 'center' ? { margin: '0 auto 48px', textAlign: 'center' } : {}}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="h2">{title}</h2>
      <p className="section-body">{body}</p>
    </div>
  );
}

/* -------- 01 · Strategy Builder (text left, canvas right) -------- */
function BuilderSection() {
  return (
    <section className="pf-section" id="product">
      <div className="container">
        <div className="showcase-row">
          <div className="showcase-text">
            <div className="eyebrow">01 · Strategy builder</div>
            <h2 className="h2">Drag. Wire. Deploy.</h2>
            <p className="section-body">36 typed primitives across triggers, conditions, actions, and safety. Wire them on a visual canvas. Reference values with <code className="mono">$syntax</code>. Branch with IF/THEN gates. Never touch a line of code.</p>
            <ul className="bullets">
              <li><Icon name="check" size={14}/> 13 event + tick triggers</li>
              <li><Icon name="check" size={14}/> 9 risk conditions &amp; guards</li>
              <li><Icon name="check" size={14}/> 8 order actions with GTC, FOK, scales</li>
              <li><Icon name="check" size={14}/> 6 safety circuit breakers</li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <a className="btn-link" href="#blocks">Explore the block library <Icon name="arrow-right" size={13}/></a>
            </div>
          </div>
          <div className="showcase-visual" style={{ padding: 0 }}>
            <BuilderCanvas compact/>
          </div>
        </div>

        {/* Category counts strip */}
        <div className="builder-cat-strip" style={{
          display: 'grid', gap: 1,
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'var(--border-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12, overflow: 'hidden',
          marginTop: 16,
        }}>
          {[
            ['Triggers', '13', 'event + tick'],
            ['Conditions', '9', 'liquidity · limits · windows'],
            ['Actions', '8', 'GTC · FOK · stops · scales'],
            ['Safety', '6', 'circuit breakers'],
          ].map(([label, n, sub]) => (
            <div key={label} style={{ background: 'var(--bg-surface)', padding: '20px 22px' }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>{label}</div>
              <div className="tabnum" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 6, color: 'var(--text-primary)' }}>{n}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- 02 · Whale Intelligence (visual left, text right) -------- */
function WhaleSection() {
  return (
    <section className="pf-section" id="whales">
      <div className="container">
        <div className="showcase-row reverse">
          <div className="showcase-text">
            <div className="eyebrow">02 · Whale intelligence</div>
            <h2 className="h2">Follow the smart money.</h2>
            <p className="section-body">Real-time wallet tracking on every Polymarket address. Mirror trades with <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Fixed</strong>, <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Proportional</strong>, or <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Kelly</strong> sizing. Alerts hit Telegram, Discord, or webhook before they hit X.</p>
            <ul className="bullets">
              <li><Icon name="check" size={14}/> Track any number of wallets</li>
              <li><Icon name="check" size={14}/> One-click copy with your own sizing</li>
              <li><Icon name="check" size={14}/> Full P&amp;L attribution per mirrored wallet</li>
            </ul>
          </div>
          <div className="showcase-visual" style={{ padding: 0 }}>
            <div className="feed">
              <div className="feed-status">
                <span className="status-dot-wrap">
                  <span className="status-dot status-dot-live" />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>streaming</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· 2,341 wallets tracked</span>
                <span className="mono tabnum" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>47 events / min</span>
              </div>
              <div className="feed-head">
                <span></span>
                <span>Wallet · Market</span>
                <span>Side</span>
                <span>Price</span>
                <span style={{ textAlign: 'right' }}>Size</span>
                <span style={{ textAlign: 'right' }}>t</span>
              </div>
              {WHALES.map(w => (
                <div key={w.wallet + w.t} className={`feed-row ${w.hl}`}>
                  <div className={`feed-avatar ${w.hl}`}>{w.init}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{w.wallet}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.market}</div>
                  </div>
                  <span className={`chip ${w.hl}`} style={{ width: 'fit-content' }}>{w.side}</span>
                  <span className="mono tabnum" style={{ fontSize: 12, color: 'var(--text-primary)' }}>¢{Math.round(parseFloat(w.px)*100)}</span>
                  <span className="mono tabnum" style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{w.size}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>{w.t} ago</span>
                </div>
              ))}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span className="mono" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}>copy mode</span>
                <span className="chip accent">kelly</span>
                <span className="chip">proportional</span>
                <span className="chip">fixed</span>
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>42 wallets · alerts on</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------- 03 · Backtest & Paper -------- */
function BacktestSection() {
  return (
    <section className="pf-section" id="backtest">
      <div className="container">
        <SectionHead
          eyebrow="03 · Backtest &amp; paper"
          title="Prove the edge before the capital."
          body="Run any strategy on full Polymarket history. Sharpe, max drawdown, per-category P&L. Compare four variants on a shared axis. Paper mode routes real prices to simulated fills — Kelly-sized and all."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card">
            <div className="t-caption mono text-tertiary" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Equity curve · 30d</div>
            <div className="tabnum mono text-gain" style={{ fontSize: 28, fontWeight: 600, marginTop: 4, letterSpacing: '-0.01em' }}>+34.2%</div>
            <svg width="100%" height="96" viewBox="0 0 400 96" preserveAspectRatio="none" style={{ marginTop: 10 }}>
              <defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gain)" stopOpacity="0.25"/><stop offset="100%" stopColor="var(--gain)" stopOpacity="0"/></linearGradient></defs>
              <path d="M0 76 L 40 68 L 80 72 L 120 56 L 160 46 L 200 52 L 240 36 L 280 30 L 320 18 L 400 8 L 400 96 L 0 96 Z" fill="url(#bg1)"/>
              <path d="M0 76 L 40 68 L 80 72 L 120 56 L 160 46 L 200 52 L 240 36 L 280 30 L 320 18 L 400 8" fill="none" stroke="var(--gain)" strokeWidth="1.5"/>
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              {[['Sharpe','1.84', 'var(--accent-text)'],['Max DD','-8.2%','var(--loss-text)'],['Win rate','67.2%','var(--gain-text)'],['Trades','212','var(--text-primary)']].map(([l,v,c]) => (
                <div key={l}>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                  <div className="mono tabnum" style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="t-caption mono text-tertiary" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Compare · 4 strategies</div>
            <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
              <g stroke="var(--border-subtle)" strokeWidth="0.5">
                <line x1="0" y1="30" x2="400" y2="30"/>
                <line x1="0" y1="70" x2="400" y2="70"/>
                <line x1="0" y1="110" x2="400" y2="110"/>
              </g>
              <path d="M0 120 L 80 105 L 160 95 L 240 82 L 320 60 L 400 30" stroke="var(--accent-default)" strokeWidth="1.5" fill="none"/>
              <path d="M0 120 L 80 115 L 160 100 L 240 100 L 320 75 L 400 50" stroke="var(--gain)" strokeWidth="1.5" fill="none"/>
              <path d="M0 120 L 80 110 L 160 120 L 240 115 L 320 105 L 400 92" stroke="var(--warning)" strokeWidth="1.5" fill="none"/>
              <path d="M0 120 L 80 122 L 160 118 L 240 125 L 320 130 L 400 128" stroke="var(--loss)" strokeWidth="1.5" fill="none" strokeDasharray="3 3"/>
            </svg>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 11 }} className="mono">
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:10,height:2,background:'var(--accent-default)'}}/> momentum α3</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:10,height:2,background:'var(--gain)'}}/> mean-reversion</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:10,height:2,background:'var(--warning)'}}/> news-reactive</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:10,height:2,background:'var(--loss)'}}/> control</span>
            </div>
          </div>

          <div className="card">
            <div className="t-caption mono text-tertiary" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Per-category P&amp;L</div>
            {[['Politics', 62, 'gain'],['Crypto', 38, 'gain'],['Sports', -14, 'loss'],['Macro', 22, 'gain'],['Culture', -6, 'loss']].map(([c, pct, tone]) => (
              <div key={c} style={{ display: 'grid', gridTemplateColumns: '76px 1fr 56px', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c}</span>
                <div style={{ background: 'var(--bg-subtle)', height: 6, borderRadius: 99, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: tone === 'loss' ? `${50 - Math.abs(pct)/2}%` : '50%', width: `${Math.abs(pct)/2}%`, top:0, bottom:0, background: `var(--${tone})`, opacity: 0.8 }}/>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-default)' }}/>
                </div>
                <span className={`mono tabnum text-${tone}`} style={{ fontSize: 12, textAlign: 'right' }}>{pct > 0 ? '+' : ''}{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------- 04 · Developer API -------- */
const DEV_SAMPLES = {
  'typescript sdk': {
    filename: 'strategy-watcher.ts',
    install: '$ npm install @polyforge/sdk',
    versionLabel: '✓ v1.4.2 · 18kb gzipped',
    lines: [
      [1, [['cm', '// TypeScript SDK']]],
      [2, [['kw', 'import'], ['tx', ' { PolyforgeClient } '], ['kw', 'from'], ['tx', ' '], ['str', "'@polyforge/sdk'"], ['tx', ';']]],
      [3, [['tx', '']]],
      [4, [['kw', 'const'], ['tx', ' client = '], ['kw', 'new'], ['tx', ' '], ['fn', 'PolyforgeClient'], ['tx', '({']]],
      [5, [['tx', '  apiKey: process.env.POLYFORGE_KEY,']]],
      [6, [['tx', '});']]],
      [7, [['tx', '']]],
      [8, [['kw', 'for await'], ['tx', ' ('], ['kw', 'const'], ['tx', ' event '], ['kw', 'of']]],
      [9, [['tx', '  client.'], ['fn', 'watchStrategy'], ['tx', '(strategyId)) {']]],
      [10,[['cm', '  // ORDER_FILLED · +$412 · sharpe 1.84']]],
      [11,[['tx', '  console.'], ['fn', 'log'], ['tx', '(event.type, event.payload);']]],
      [12,[['tx', '}']]],
    ],
  },
  'python sdk': {
    filename: 'strategy_watcher.py',
    install: '$ pip install polyforge',
    versionLabel: '✓ v1.4.2 · py ≥ 3.10',
    lines: [
      [1, [['cm', '# Python SDK']]],
      [2, [['kw', 'from'], ['tx', ' polyforge '], ['kw', 'import'], ['tx', ' '], ['fn', 'PolyforgeClient']]],
      [3, [['kw', 'import'], ['tx', ' os']]],
      [4, [['tx', '']]],
      [5, [['tx', 'client = '], ['fn', 'PolyforgeClient'], ['tx', '(api_key=os.environ['], ['str', "'POLYFORGE_KEY'"], ['tx', '])']]],
      [6, [['tx', '']]],
      [7, [['kw', 'async for'], ['tx', ' event '], ['kw', 'in'], ['tx', ' client.'], ['fn', 'watch_strategy'], ['tx', '(strategy_id):']]],
      [8, [['cm', '    # ORDER_FILLED · +$412 · sharpe 1.84']]],
      [9, [['fn', '    print'], ['tx', '(event.type, event.payload)']]],
    ],
  },
  'rust sdk': {
    filename: 'strategy_watcher.rs',
    install: '$ cargo add polyforge',
    versionLabel: '✓ v1.4.2 · tokio · rustls',
    lines: [
      [1, [['cm', '// Rust SDK']]],
      [2, [['kw', 'use'], ['tx', ' polyforge::{PolyforgeClient, Event};']]],
      [3, [['kw', 'use'], ['tx', ' futures::StreamExt;']]],
      [4, [['tx', '']]],
      [5, [['attr', '#[tokio::main]']]],
      [6, [['kw', 'async fn'], ['tx', ' '], ['fn', 'main'], ['tx', '() -> anyhow::Result<()> {']]],
      [7, [['kw', '  let'], ['tx', ' client = PolyforgeClient::'], ['fn', 'from_env'], ['tx', '()?;']]],
      [8, [['kw', '  let mut'], ['tx', ' stream = client.'], ['fn', 'watch_strategy'], ['tx', '(&id).'], ['fn', 'await'], ['tx', '?;']]],
      [9, [['kw', '  while let'], ['tx', ' Some(event) = stream.'], ['fn', 'next'], ['tx', '().'], ['fn', 'await'], ['tx', ' {']]],
      [10,[['cm', '    // ORDER_FILLED · +$412 · sharpe 1.84']]],
      [11,[['fn', '    println!'], ['tx', '('], ['str', '"{:?}"'], ['tx', ', event);']]],
      [12,[['tx', '  }']]],
      [13,[['kw', '  Ok'], ['tx', '(())']]],
      [14,[['tx', '}']]],
    ],
  },
  'mcp server': {
    filename: 'mcp-prompt.txt',
    install: '$ polyforge mcp serve --port 7421',
    versionLabel: '✓ MCP 1.2 · 11 tools',
    lines: [
      [1, [['cm', '# Natural-language prototyping via MCP']]],
      [2, [['tx', '']]],
      [3, [['kw', '> '], ['tx', 'Claude, build me a momentum strategy for']]],
      [4, [['tx', '  "Will BTC close above $80k this Friday?"']]],
      [5, [['tx', '  — 5-min EMA cross, 2% stop, 4% target.']]],
      [6, [['tx', '']]],
      [7, [['cm', '  → create_strategy(name="btc-ema-cross")']]],
      [8, [['cm', '  → add_block(type="ema_cross", fast=12, slow=26)']]],
      [9, [['cm', '  → add_stop_loss(pct=2.0)']]],
      [10,[['cm', '  → add_take_profit(pct=4.0)']]],
      [11,[['cm', '  → run_backtest(from="2025-10-01")']]],
      [12,[['tx', '']]],
      [13,[['str', '  ✓ sharpe 1.84 · 412 trades · +18.2%']]],
    ],
  },
  'openapi 3.1': {
    filename: 'openapi.yaml',
    install: '$ curl https://api.polyforge.app/openapi.yaml',
    versionLabel: '✓ OpenAPI 3.1.0 · 84 ops',
    lines: [
      [1, [['kw', 'openapi'], ['tx', ': '], ['str', '3.1.0']]],
      [2, [['kw', 'info'], ['tx', ':']]],
      [3, [['kw', '  title'], ['tx', ': '], ['str', 'PolyForge API']]],
      [4, [['kw', '  version'], ['tx', ': '], ['str', '1.4.2']]],
      [5, [['kw', 'servers'], ['tx', ':']]],
      [6, [['tx', '  - '], ['kw', 'url'], ['tx', ': '], ['str', 'https://api.polyforge.app/v1']]],
      [7, [['kw', 'paths'], ['tx', ':']]],
      [8, [['kw', '  /strategies'], ['tx', ':']]],
      [9, [['kw', '    get'], ['tx', ': '], ['cm', '{ summary: "List strategies" }']]],
      [10,[['kw', '    post'], ['tx', ': '], ['cm', '{ summary: "Create strategy" }']]],
      [11,[['kw', '  /strategies/{id}/backtest'], ['tx', ':']]],
      [12,[['kw', '    post'], ['tx', ': '], ['cm', '{ summary: "Run backtest" }']]],
    ],
  },
  'webhooks': {
    filename: 'order-filled.json',
    install: '$ # POST to your endpoint',
    versionLabel: '✓ HMAC-SHA256 signed',
    lines: [
      [1, [['cm', '// Webhook: ORDER_FILLED']]],
      [2, [['tx', '{']]],
      [3, [['kw', '  "event"'], ['tx', ': '], ['str', '"ORDER_FILLED"'], ['tx', ',']]],
      [4, [['kw', '  "delivery_id"'], ['tx', ': '], ['str', '"whk_01HRJ8..."'], ['tx', ',']]],
      [5, [['kw', '  "strategy_id"'], ['tx', ': '], ['str', '"str_b4c8a21"'], ['tx', ',']]],
      [6, [['kw', '  "payload"'], ['tx', ': {']]],
      [7, [['kw', '    "side"'], ['tx', ': '], ['str', '"BUY"'], ['tx', ',']]],
      [8, [['kw', '    "size"'], ['tx', ': '], ['str', '412'], ['tx', ',']]],
      [9, [['kw', '    "price"'], ['tx', ': '], ['str', '0.62'], ['tx', ',']]],
      [10,[['kw', '    "pnl"'], ['tx', ': '], ['str', '+412.00'], ['tx', '']]],
      [11,[['tx', '  },']]],
      [12,[['kw', '  "sig"'], ['tx', ': '], ['str', '"sha256=9f2a3b..."']]],
      [13,[['tx', '}']]],
    ],
  },
};

function DeveloperSection() {
  const [tab, setTab] = React.useState('typescript sdk');
  const sample = DEV_SAMPLES[tab];
  return (
    <section className="pf-section" id="developers" style={{ background: 'var(--bg-surface)' }}>
      <div className="container">
        <div className="showcase-row">
          <div className="showcase-text">
            <div className="eyebrow">04 · Developer API</div>
            <h2 className="h2">Built for the API-first trader.</h2>
            <p className="section-body">Everything in the product ships as REST, WebSocket, and MCP. TypeScript, Python, and Rust SDKs. Strategies are JSON you can version in git. Builder attribution baked into every order.</p>
            <div role="tablist" aria-label="API surface" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 20 }}>
              {Object.keys(DEV_SAMPLES).map(l => (
                <button
                  key={l}
                  role="tab"
                  aria-selected={tab === l}
                  className={'chip chip-toggle' + (tab === l ? ' chip-active' : '')}
                  onClick={() => setTab(l)}
                >
                  {l}
                </button>
              ))}
            </div>
            <ul className="bullets" style={{ marginTop: 24 }}>
              {[
                ['Event streams', 'ORDER_FILLED, STRATEGY_PAUSED, BACKTEST_PROGRESS over WS.'],
                ['Strategy import/export', 'Every strategy is a .polyforge JSON document.'],
                ['MCP server', 'Let an agent prototype and deploy via natural language.'],
                ['Builder attribution', 'HMAC-signed headers on every order.'],
              ].map(([t, d]) => (
                <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="check" size={14} className="text-accent" style={{ marginTop: 3, flex: '0 0 auto' }}/>
                  <span><strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t}.</strong> <span style={{ color: 'var(--text-secondary)' }}>{d}</span></span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 24 }}>
              <a className="btn-link" href="#docs">Read the API docs <Icon name="arrow-up-right" size={13}/></a>
            </div>
          </div>
          <div>
            <div className="code-frame">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                <div className="browser-dots"><span/><span/><span/></div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{sample.filename}</span>
                <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} aria-label="Copy code"><Icon name="copy" size={12}/></button>
              </div>
              <pre key={tab} className="code-fade">
                {sample.lines.map(([n, tokens]) => (
                  <div className="code-line" key={n}>
                    <span className="code-ln">{n}</span>
                    <span>{tokens.map((tok, i) => {
                      const [cls, txt] = tok;
                      if (cls === 'tx') return <React.Fragment key={i}>{txt || '\u00A0'}</React.Fragment>;
                      return <span key={i} className={`code-${cls}`}>{txt}</span>;
                    })}</span>
                  </div>
                ))}
              </pre>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'space-between', fontSize: 11 }} className="mono">
              <span style={{ color: 'var(--text-tertiary)' }}>{sample.install}</span>
              <span style={{ color: 'var(--gain-text)' }}>{sample.versionLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------- 05 · Testimonials -------- */
function Testimonials() {
  const [show] = useTweak('showTestimonials');
  if (!show) return null;
  return (
    <section className="pf-section">
      <div className="container">
        <SectionHead
          eyebrow="05 · Operators"
          title="Built with the people who trade it."
          body="Private beta. Public feedback."
        />
        <div className="t-grid">
          {TESTIMONIALS.map((t, i) => (
            <figure key={t.who} className="t-card">
              <div className="quote-mark">“</div>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <div className="t-avatar">{t.who.split(' ').map(s => s[0]).join('')}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.who}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- CTA -------- */
function CTA() {
  return (
    <section className="pf-section">
      <div className="container">
        <div className="cta-banner">
          <div className="dots"/>
          <div className="glow"/>
          <div className="eyebrow" style={{ marginBottom: 14 }}>09 · Get started</div>
          <h2 className="h2" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', maxWidth: 720, margin: '0 auto 14px' }}>Open the terminal. Forge an edge.</h2>
          <p className="section-body" style={{ margin: '0 auto 28px', textAlign: 'center', maxWidth: 540 }}>Paper-trade unlimited. Connect Polymarket whenever the strategy clears your bar.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="btn btn-primary btn-lg" href="Sign Up.html">start free <Icon name="arrow-right" size={14}/></a>
            <a className="btn btn-secondary btn-lg" href="Contact.html">book a walkthrough</a>
          </div>
          <div className="cta-fineprint">
            <span>No card required</span>
            <span className="cta-fineprint-sep"/>
            <span>SOC 2 in flight</span>
            <span className="cta-fineprint-sep"/>
            <span>EU&#8209;West&#8209;2 · 99.97% YTD</span>
            <span className="cta-fineprint-sep"/>
            <span>Cancel any time</span>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { SectionHead, BuilderSection, WhaleSection, BacktestSection, DeveloperSection, Testimonials, CTA });
