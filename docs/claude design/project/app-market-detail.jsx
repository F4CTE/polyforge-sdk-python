/* Polyforge — Market detail
   Header · price chart · order book · order ticket · whale activity · resolution */

function App() {
  const price = [];
  let v = 60;
  for (let i = 0; i < 120; i++) {
    v += (Math.sin(i * 0.21) * 1.2) + (i > 80 ? 0.16 : 0.06);
    v = Math.max(40, Math.min(80, v));
    price.push(v);
  }

  const bids = [
    { px: 73, sz: '4,820', ttl: '$3,518', w: 100 },
    { px: 72, sz: '8,140', ttl: '$5,861', w: 80 },
    { px: 71, sz: '12,200', ttl: '$8,662', w: 65 },
    { px: 70, sz: '18,400', ttl: '$12,880', w: 50 },
    { px: 69, sz: '22,800', ttl: '$15,732', w: 35 },
    { px: 68, sz: '34,200', ttl: '$23,256', w: 20 },
  ];
  const asks = [
    { px: 74, sz: '3,420', ttl: '$2,531', w: 100 },
    { px: 75, sz: '6,800', ttl: '$5,100', w: 80 },
    { px: 76, sz: '9,420', ttl: '$7,159', w: 60 },
    { px: 77, sz: '14,200', ttl: '$10,934', w: 45 },
    { px: 78, sz: '18,800', ttl: '$14,664', w: 30 },
    { px: 79, sz: '24,400', ttl: '$19,276', w: 18 },
  ];

  const [side, setSide] = React.useState('YES');

  return (
    <UsrShell active="market" title="FED-CUT-JUL" crumbs={[{ label: 'Markets', href: 'App-Markets.html' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Set alert</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bookmark" size={12} />Watch</button>
      </>
    }>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <UsrVenueBadge venue="kalshi" />
            <span className="adm-pill" style={{ height: 18, fontSize: 10 }}>MACRO</span>
            <span className="adm-pill is-warn has-dot is-pulse" style={{ height: 18, fontSize: 10 }}>HOT</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>FED-CUT-JUL</h1>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>Will the Federal Reserve cut interest rates at the July 2025 FOMC meeting?</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>Resolves Jul 30, 2025 · 14:00 ET</span><span>·</span>
            <span>Source: FOMC press release</span><span>·</span>
            <span>Created Jan 14 · 4mo ago</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 36, fontWeight: 600, color: 'var(--gain-text)' }}>¢73</span>
          <div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--gain-text)', fontWeight: 600 }}>+4.2%</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)' }}>24h</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Vol · 24h"   value="$620K"  delta="+82% vs avg"  deltaKind="gain" />
        <AdmStat label="Open interest" value="$1.84M" delta="+$120K · 24h" deltaKind="gain" />
        <AdmStat label="Whale buys · 7d" value="2"   delta="$96K notional" deltaKind="neutral" />
        <AdmStat label="Resolves" value="6d 18h"  delta="Jul 30 · 14:00 ET" deltaKind="neutral" />
      </div>

      {/* Resolution timeline */}
      <div className="adm-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <AdmIcon name="clock" size={14} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Resolution timeline</h3>
        </div>
        <div className="usr-timeline" style={{ marginBottom: 0 }}>
          <div className="usr-timeline-step is-done">
            <div className="usr-timeline-dot" />
            <div className="usr-timeline-label">Created</div>
            <div className="usr-timeline-time">Jan 14</div>
          </div>
          <div className="usr-timeline-step is-done">
            <div className="usr-timeline-dot" />
            <div className="usr-timeline-label">Trading open</div>
            <div className="usr-timeline-time">Jan 14</div>
          </div>
          <div className="usr-timeline-step is-active">
            <div className="usr-timeline-dot" />
            <div className="usr-timeline-label">Active</div>
            <div className="usr-timeline-time">Now</div>
          </div>
          <div className="usr-timeline-step">
            <div className="usr-timeline-dot" />
            <div className="usr-timeline-label">FOMC announces</div>
            <div className="usr-timeline-time">Jul 30, 14:00 ET</div>
          </div>
          <div className="usr-timeline-step">
            <div className="usr-timeline-dot" />
            <div className="usr-timeline-label">Resolves</div>
            <div className="usr-timeline-time">Jul 30, 14:30 ET</div>
          </div>
        </div>
      </div>

      {/* Main grid: chart + book + ticket */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.4fr) minmax(280px, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Left: chart + book */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="adm-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>YES price</h3>
              <span className="usr-rec" style={{ marginLeft: 8 }}>LIVE</span>
              <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
                <button className="adm-filter">1h</button>
                <button className="adm-filter">24h</button>
                <button className="adm-filter is-active">7d</button>
                <button className="adm-filter">30d</button>
                <button className="adm-filter">all</button>
              </div>
            </div>
            <UsrEquityCurve points={price} kind="gain" height={220} label="¢73" />
          </div>

          <div className="adm-grid-2">
            <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Order book</h3>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>updated 0.8s ago</span>
              </div>
              <div className="usr-book">
                <div className="usr-book-side is-bid">
                  <div style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span>Bid</span><span style={{ textAlign: 'right' }}>Size</span><span style={{ textAlign: 'right' }}>Total</span>
                  </div>
                  {bids.map(b => (
                    <div key={b.px} className="usr-book-row" style={{ '--w': `${b.w}%` }}>
                      <span className="px">¢{b.px}</span>
                      <span className="sz">{b.sz}</span>
                      <span className="ttl">{b.ttl}</span>
                    </div>
                  ))}
                </div>
                <div className="usr-book-side is-ask">
                  <div style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span>Ask</span><span style={{ textAlign: 'right' }}>Size</span><span style={{ textAlign: 'right' }}>Total</span>
                  </div>
                  {asks.map(a => (
                    <div key={a.px} className="usr-book-row" style={{ '--w': `${a.w}%` }}>
                      <span className="px">¢{a.px}</span>
                      <span className="sz">{a.sz}</span>
                      <span className="ttl">{a.ttl}</span>
                    </div>
                  ))}
                </div>
                <div className="usr-book-mid">
                  <span className="spread">spread 1¢</span>
                  <span>last <span className="last">¢73</span> · 420 sh</span>
                  <span className="spread">mid ¢73.5</span>
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Tape</h3>
                <span className="usr-rec" style={{ marginLeft: 'auto' }}>STREAMING</span>
              </div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11.5, padding: '4px 0' }}>
                {[
                  { t: '14:24:08', side: 'YES', sz: 420, px: 73 },
                  { t: '14:23:54', side: 'YES', sz: 180, px: 73 },
                  { t: '14:23:21', side: 'NO',  sz: 80,  px: 27 },
                  { t: '14:23:08', side: 'YES', sz: 220, px: 72 },
                  { t: '14:22:48', side: 'YES', sz: 320, px: 72 },
                  { t: '14:22:14', side: 'YES', sz: 140, px: 72 },
                  { t: '14:21:52', side: 'NO',  sz: 200, px: 28 },
                  { t: '14:21:18', side: 'YES', sz: 480, px: 71 },
                  { t: '14:20:42', side: 'YES', sz: 240, px: 71 },
                  { t: '14:20:12', side: 'YES', sz: 60,  px: 71 },
                ].map((t, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 50px 1fr 60px', padding: '5px 16px', alignItems: 'center', borderBottom: i < 9 ? '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' : 'none' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{t.t}</span>
                    <span className={`adm-pill ${t.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5, padding: '0 5px' }}>{t.side}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.sz} sh</span>
                    <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>¢{t.px}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Whale activity on this market */}
          <div className="adm-card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <AdmIcon name="trending" size={14} />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Whale activity · 7d</h3>
              <span className="adm-pill is-accent" style={{ marginLeft: 4 }}>2 RECENT</span>
              <a href="App-Whales.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All whales →</a>
            </div>
            <div>
              {[
                { who: 'unholyfist.eth',  hours: 4,   side: 'BUY',  dir: 'YES', size: '$48,200', edge: '+12.4%' },
                { who: '0xtidemark',      hours: 18,  side: 'BUY',  dir: 'YES', size: '$31,200', edge: '+22.1%' },
                { who: 'cassandra.x',     hours: 56,  side: 'SELL', dir: 'YES', size: '$14,500', edge: '+18.2%' },
              ].map((w, i) => (
                <div key={i} className="usr-whale-card">
                  <div className="usr-whale-avatar">{w.who.slice(0,2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{w.who}</span>
                      <span className={`adm-pill ${w.side === 'BUY' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{w.side} {w.dir}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{w.hours}h ago</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{w.size} · 30d edge <span style={{ color: 'var(--gain-text)' }}>{w.edge}</span></div>
                  </div>
                  <button className="adm-btn adm-btn-sm adm-btn-secondary">Mirror</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail: order ticket */}
        <div>
          <div className="usr-ticket">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Place order</h3>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gain-text)', fontFamily: 'Geist Mono, monospace' }}>● PAPER</span>
            </div>
            <div className="usr-ticket-side">
              <button className={`is-yes${side === 'YES' ? ' is-active' : ''}`} onClick={() => setSide('YES')}>
                Buy YES · ¢73
              </button>
              <button className={`is-no${side === 'NO' ? ' is-active' : ''}`} onClick={() => setSide('NO')}>
                Buy NO · ¢27
              </button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Order type</label>
              <div className="adm-filter-group" style={{ width: '100%' }}>
                <button className="adm-filter is-active" style={{ flex: 1 }}>Limit</button>
                <button className="adm-filter" style={{ flex: 1 }}>Market</button>
                <button className="adm-filter" style={{ flex: 1 }}>TWAP</button>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Limit price</label>
              <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-app)', overflow: 'hidden' }}>
                <span style={{ padding: '0 10px', display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', fontSize: 12, borderRight: '1px solid var(--border-subtle)' }}>¢</span>
                <input defaultValue="73" style={{ flex: 1, padding: '0 10px', border: 0, background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'Geist Mono, monospace', outline: 'none' }} />
                <button style={{ padding: '0 10px', border: 0, borderLeft: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>−</button>
                <button style={{ padding: '0 10px', border: 0, borderLeft: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Size · shares</label>
              <input defaultValue="420" style={{ width: '100%', height: 32, padding: '0 10px', background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'Geist Mono, monospace', outline: 'none', boxSizing: 'border-box' }} />
              <div className="adm-filter-group" style={{ marginTop: 6 }}>
                <button className="adm-filter" style={{ flex: 1 }}>25%</button>
                <button className="adm-filter is-active" style={{ flex: 1 }}>50%</button>
                <button className="adm-filter" style={{ flex: 1 }}>75%</button>
                <button className="adm-filter" style={{ flex: 1 }}>MAX</button>
              </div>
            </div>

            <div style={{ padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', margin: '8px 0' }}>
              <div className="usr-ticket-row" style={{ borderBottom: 0, padding: '4px 0' }}><span className="usr-ticket-label">Cost</span><span className="usr-ticket-val">$306.60</span></div>
              <div className="usr-ticket-row" style={{ borderBottom: 0, padding: '4px 0' }}><span className="usr-ticket-label">Fees · 0.5%</span><span className="usr-ticket-val">$1.53</span></div>
              <div className="usr-ticket-row" style={{ borderBottom: 0, padding: '4px 0' }}><span className="usr-ticket-label">Max payout</span><span className="usr-ticket-val" style={{ color: 'var(--gain-text)' }}>$420.00</span></div>
              <div className="usr-ticket-row" style={{ borderBottom: 0, padding: '4px 0' }}><span className="usr-ticket-label">Max profit</span><span className="usr-ticket-val" style={{ color: 'var(--gain-text)' }}>+$111.87</span></div>
              <div className="usr-ticket-row" style={{ borderBottom: 0, padding: '4px 0' }}><span className="usr-ticket-label">Implied prob</span><span className="usr-ticket-val">73%</span></div>
            </div>

            <button className="adm-btn adm-btn-primary" style={{ width: '100%', height: 38, fontSize: 13 }}>
              Place order · YES ¢73 · 420 sh
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 8, justifyContent: 'center', fontFamily: 'Geist Mono, monospace' }}>
              <AdmIcon name="info" size={11} />
              Will route via fed-rate-cut-tracker
            </div>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
