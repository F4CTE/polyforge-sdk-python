/* Polyforge — User Dashboard / Mission control
   Trader's home. Hero P&L → strategies grid → live activity →
   markets watchlist → whale signals → resolution timeline. */

const APP_KPI_TICKER = [
  { sym: 'ELEC28-DEM',     px: 0.42, chg: +2.4 },
  { sym: 'FED-CUT-JUL',    px: 0.73, chg: +4.2 },
  { sym: 'BTC-150K-DEC',   px: 0.31, chg: -1.1 },
  { sym: 'OSCARS-OPP',     px: 0.18, chg: +3.6 },
  { sym: 'SCOTUS-S2024',   px: 0.61, chg: -0.4 },
  { sym: 'NFL-SB-CHIEFS',  px: 0.34, chg: +1.8 },
  { sym: 'ETH-ETF-Q2',     path: 0,  px: 0.88, chg: +0.6 },
  { sym: 'CPI-MAR-COOL',   px: 0.58, chg: +1.2 },
];

const STRATEGIES = [
  {
    name: 'fed-rate-cut-tracker',
    blocks: 6,
    mode: 'live',
    venue: 'polymarket',
    pnl: '+$1,847',
    pnlKind: 'gain',
    delta: '+18.4%',
    today: '+$284',
    fills24: 14,
    capital: '$5,000',
    spark: [40, 42, 44, 46, 48, 52, 56, 58, 62, 66, 68, 70, 74, 78, 80, 82, 86, 90, 94, 98, 100, 104, 108, 112],
    sparkKind: 'gain',
    status: 'running',
  },
  {
    name: 'whale-mirror-politics',
    blocks: 4,
    mode: 'live',
    venue: 'polymarket',
    pnl: '+$612',
    pnlKind: 'gain',
    delta: '+8.1%',
    today: '+$94',
    fills24: 7,
    capital: '$2,500',
    spark: [60, 58, 62, 60, 64, 62, 66, 64, 68, 66, 70, 68, 72, 70, 74, 72, 76, 74, 78, 76, 80, 78, 82, 80],
    sparkKind: 'gain',
    status: 'running',
  },
  {
    name: 'cpi-cool-fade',
    blocks: 5,
    mode: 'paper',
    venue: 'kalshi',
    pnl: '+$208',
    pnlKind: 'gain',
    delta: '+2.4%',
    today: '+$12',
    fills24: 3,
    capital: '$1,000',
    spark: [50, 52, 51, 54, 53, 56, 55, 58, 57, 60, 58, 62, 60, 64, 62, 66, 64, 68, 66, 70, 68, 72, 70, 74],
    sparkKind: 'gain',
    status: 'running',
  },
  {
    name: 'oscars-favorite-hedge',
    blocks: 7,
    mode: 'paper',
    venue: 'polymarket',
    pnl: '−$48',
    pnlKind: 'loss',
    delta: '−1.2%',
    today: '−$18',
    fills24: 2,
    capital: '$500',
    spark: [70, 68, 72, 70, 66, 68, 64, 66, 62, 64, 60, 62, 58, 60, 56, 58, 54, 56, 52, 54, 50, 52, 48, 50],
    sparkKind: 'loss',
    status: 'paused',
  },
];

const TODAY_FILLS = [
  { t: '14:24:08', mk: 'FED-CUT-JUL',  side: 'YES', sz: '420 sh @ ¢73', val: '+$306', kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'polymarket' },
  { t: '14:18:22', mk: 'ELEC28-DEM',   side: 'NO',  sz: '180 sh @ ¢58', val: '+$104', kind: 'gain', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { t: '14:11:04', mk: 'CPI-MAR-COOL', side: 'YES', sz: '140 sh @ ¢56', val: '+$78',  kind: 'gain', strat: 'cpi-cool-fade', venue: 'kalshi' },
  { t: '13:54:51', mk: 'OSCARS-OPP',   side: 'YES', sz: '60 sh @ ¢19',  val: '−$11',  kind: 'loss', strat: 'oscars-favorite-hedge', venue: 'polymarket' },
  { t: '13:47:18', mk: 'FED-CUT-JUL',  side: 'YES', sz: '200 sh @ ¢72', val: '+$142', kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'polymarket' },
  { t: '13:33:09', mk: 'BTC-150K-DEC', side: 'NO',  sz: '90 sh @ ¢69',  val: '−$24',  kind: 'loss', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { t: '13:22:42', mk: 'NFL-SB-CHIEFS',side: 'YES', sz: '300 sh @ ¢34', val: '+$58',  kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
];

const WATCHLIST = [
  { sym: 'ELEC28-DEM',     name: 'Democrats win 2028 Presidential election',  yes: 42, chg: +2.4, vol: '$1.2M', venue: 'polymarket', resolves: 'Nov 2028', whale: 4 },
  { sym: 'BTC-150K-DEC',   name: 'BTC > $150k by Dec 31, 2025',                yes: 31, chg: -1.1, vol: '$840K', venue: 'polymarket', resolves: 'Dec 31', whale: 7 },
  { sym: 'FED-CUT-JUL',    name: 'Fed cuts rates at July 2025 FOMC',           yes: 73, chg: +4.2, vol: '$620K', venue: 'kalshi',     resolves: 'Jul 30', whale: 2 },
  { sym: 'ETH-ETF-Q2',     name: 'ETH spot ETF approved by end of Q2',         yes: 88, chg: +0.6, vol: '$2.1M', venue: 'polymarket', resolves: 'Jun 30', whale: 0 },
  { sym: 'NVDA-EARN-Q1',   name: 'NVDA beats Q1 EPS consensus',                yes: 81, chg: +1.2, vol: '$1.4M', venue: 'kalshi',     resolves: 'May 22', whale: 3 },
  { sym: 'SCOTUS-S2024',   name: 'SCOTUS grants cert in case 23-1234',         yes: 61, chg: -0.4, vol: '$280K', venue: 'polymarket', resolves: 'Jun 30', whale: 1 },
];

const WHALES = [
  { who: 'unholyfist.eth',    avatar: 'UF', mins: 4,  side: 'BUY',  market: 'FED-CUT-JUL', dir: 'YES',  size: '$48,200', edge: '+12.4%', fresh: true },
  { who: 'plinkochamp.eth',   avatar: 'PC', mins: 11, side: 'SELL', market: 'ELEC28-DEM',  dir: 'YES',  size: '$22,000', edge: '+8.6%',  fresh: true },
  { who: 'cassandra.x',       avatar: 'CX', mins: 24, side: 'BUY',  market: 'OSCARS-OPP',  dir: 'NO',   size: '$14,500', edge: '+18.2%', fresh: false },
  { who: '0xtidemark',        avatar: 'TM', mins: 38, side: 'BUY',  market: 'BTC-150K-DEC',dir: 'NO',   size: '$31,200', edge: '+22.1%', fresh: false },
  { who: 'parlaymoney',       avatar: 'PM', mins: 52, side: 'SELL', market: 'NFL-SB-CHIEFS',dir: 'YES', size: '$8,400',  edge: '+4.4%',  fresh: false },
];

const RESOLVING_SOON = [
  { sym: 'CPI-MAR-COOL',  name: 'March CPI < 3.0%',          when: '14h 22m', state: 'pending', position: '$1,420', side: 'YES',  yes: 58 },
  { sym: 'OSCARS-OPP',    name: 'Oppenheimer wins Best Pic',  when: '2d 04h',  state: 'pending', position: '$280',   side: 'NO',   yes: 18 },
  { sym: 'FED-CUT-JUL',   name: 'Fed cut at July FOMC',       when: '6d 18h',  state: 'pending', position: '$3,120', side: 'YES',  yes: 73 },
];

const ONBOARDING = [
  { n: 1, label: 'Account verified',        sub: 'Email + 2FA enabled · KYC complete', done: true },
  { n: 2, label: 'Wallet connected',        sub: 'Polymarket · 0x4f7…b2 · $5,420 USDC', done: true },
  { n: 3, label: 'First strategy deployed', sub: 'fed-rate-cut-tracker running paper for 9 days', done: true },
  { n: 4, label: 'Backtest reviewed',       sub: 'Compare paper P&L to projected', done: true },
  { n: 5, label: 'Risk limits set',         sub: 'Daily loss cap, max position, kill switch', active: true },
  { n: 6, label: 'Go live',                 sub: 'Move at least one strategy from paper to real money' },
];

function StrategyCard({ s }) {
  return (
    <a href="App-Strategy-Detail.html" className="adm-card" style={{ textDecoration: 'none', display: 'block', position: 'relative', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className={`adm-pill has-dot is-pulse ${s.status === 'running' ? 'is-gain' : ''}`} style={{ height: 18, fontSize: 9.5 }}>
          {s.status === 'running' ? 'RUNNING' : 'PAUSED'}
        </span>
        <UsrVenueBadge venue={s.venue} />
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.mode}</span>
      </div>
      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{s.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: s.pnlKind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)' }}>{s.pnl}</span>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: s.pnlKind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)' }}>{s.delta}</span>
      </div>
      <AdmSpark points={s.spark} kind={s.sparkKind} height={32} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, fontSize: 10.5, fontFamily: 'Geist Mono, monospace' }}>
        <div><div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>TODAY</div><div style={{ color: s.today.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{s.today}</div></div>
        <div><div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>FILLS 24h</div><div style={{ color: 'var(--text-primary)' }}>{s.fills24}</div></div>
        <div><div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>CAPITAL</div><div style={{ color: 'var(--text-primary)' }}>{s.capital}</div></div>
      </div>
    </a>
  );
}

function MicroBookViz({ yes }) {
  const no = 100 - yes;
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-elevated)', minWidth: 60 }}>
      <span style={{ width: `${yes}%`, background: 'var(--gain)', opacity: 0.7 }} />
      <span style={{ width: `${no}%`,  background: 'var(--loss)', opacity: 0.45 }} />
    </div>
  );
}

function DailyPnLChart() {
  // 30 days
  const data = [
    100, 102, 101, 104, 103, 108, 110, 109, 112, 116,
    114, 118, 122, 120, 124, 128, 126, 132, 130, 134,
    138, 136, 140, 142, 146, 144, 148, 152, 150, 158,
  ];
  const w = 600, h = 120;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const ys = data.map(p => h - 10 - ((p - min) / range) * (h - 20));
  const linePath = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`;
  const last = ys[ys.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 120 }}>
      <defs>
        <linearGradient id="dpnl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="var(--border-subtle)" strokeWidth="0.5">
        <line x1="0" y1="30" x2={w} y2="30" />
        <line x1="0" y1="60" x2={w} y2="60" />
        <line x1="0" y1="90" x2={w} y2="90" />
      </g>
      <path d={areaPath} fill="url(#dpnl-grad)" />
      <path d={linePath} fill="none" stroke="var(--accent-default)" strokeWidth="1.6" />
      <circle cx={w} cy={last} r="3.5" fill="var(--accent-default)" />
      <circle cx={w} cy={last} r="7" fill="var(--accent-default)" opacity="0.25">
        <animate attributeName="r" from="6" to="11" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function App() {
  return (
    <UsrShell active="dashboard" title="Mission control" actions={
      <>
        <a className="adm-btn adm-btn-secondary" href="App-Builder.html"><AdmIcon name="hammer" size={12} />Builder</a>
        <a className="adm-btn adm-btn-primary" href="App-Strategies.html"><AdmIcon name="plus" size={12} />New strategy</a>
      </>
    }>

      {/* Live ticker */}
      <UsrTickerStrip items={APP_KPI_TICKER} />

      {/* Hero P&L */}
      <div className="usr-hero">
        <div className="usr-hero-left">
          <div className="usr-hero-eyebrow">
            <span style={{ color: 'var(--accent-text)' }}>●</span>
            EQUITY · ALL STRATEGIES · 30D
            <span className="usr-rec" style={{ marginLeft: 'auto' }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div className="usr-hero-equity">$12,847.32</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: 'var(--gain-text)', fontWeight: 600 }}>+$2,847.32</span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--gain-text)' }}>+28.5% · 30d</span>
            </div>
          </div>
          <DailyPnLChart />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>30d ago · $10,000</span>
            <span>15d ago · $11,180</span>
            <span>now · $12,847</span>
          </div>
        </div>
        <div className="usr-hero-right">
          <div className="usr-hero-stat">
            <div className="usr-hero-stat-label">Today's P&L</div>
            <div className="usr-hero-stat-value" style={{ color: 'var(--gain-text)' }}>+$372.18</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>+2.98% · 26 fills</div>
          </div>
          <div className="usr-hero-stat">
            <div className="usr-hero-stat-label">Win rate · 30d</div>
            <div className="usr-hero-stat-value">67.2%</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>142 of 212</div>
          </div>
          <div className="usr-hero-stat">
            <div className="usr-hero-stat-label">Open positions</div>
            <div className="usr-hero-stat-value">11</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>$8,420 · 65.5% deployed</div>
          </div>
          <div className="usr-hero-stat">
            <div className="usr-hero-stat-label">Sharpe · 30d</div>
            <div className="usr-hero-stat-value">2.41</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>max DD −4.8%</div>
          </div>
        </div>
      </div>

      {/* Strategies grid */}
      <AdmSectionHead title="Your strategies" action={<a href="App-Strategies.html" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>View all 12 →</a>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        {STRATEGIES.map(s => <StrategyCard key={s.name} s={s} />)}
      </div>

      {/* Today's fills + Whale signals */}
      <div className="adm-grid-2">
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <span className="adm-rec" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="adm-dot is-gain" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today's fills</span>
              <span className="adm-pill is-gain" style={{ marginLeft: 4 }}>26</span>
            </span>
            <a href="App-Orders.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All orders →</a>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Market</th>
                <th>Side</th>
                <th>Size</th>
                <th className="col-num">P&L</th>
              </tr>
            </thead>
            <tbody>
              {TODAY_FILLS.map((f, i) => (
                <tr key={i}>
                  <td className="col-mono col-tertiary">{f.t}</td>
                  <td>
                    <div className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{f.mk}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'Geist Mono, monospace' }}>{f.strat}</div>
                  </td>
                  <td><span className={`adm-pill ${f.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 18, fontSize: 10 }}>{f.side}</span></td>
                  <td className="col-mono">{f.sz}</td>
                  <td className="col-num" style={{ color: f.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>{f.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="adm-table-foot">
            <span>showing 7 of 26 today</span>
            <span>net <span style={{ color: 'var(--gain-text)' }}>+$653</span> · gross <span style={{ color: 'var(--text-primary)' }}>$12,420</span></span>
          </div>
        </div>

        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AdmIcon name="trending" size={14} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Whale signals</span>
              <span className="adm-pill is-accent has-dot is-pulse" style={{ marginLeft: 4 }}>2 NEW</span>
            </div>
            <a href="App-Whales.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All whales →</a>
          </div>
          <div>
            {WHALES.map((w, i) => (
              <div key={i} className={`usr-whale-card${w.fresh ? ' is-fresh' : ''}`}>
                <div className="usr-whale-avatar">{w.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{w.who}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{w.mins}m ago</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`adm-pill ${w.side === 'BUY' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{w.side}</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{w.market}</span>
                    <span className={`adm-pill ${w.dir === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{w.dir}</span>
                    <span className="mono" style={{ color: 'var(--text-tertiary)' }}>{w.size}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>
                    <span>30d edge <span style={{ color: 'var(--gain-text)' }}>{w.edge}</span></span>
                    <span style={{ marginLeft: 'auto' }}>
                      <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{ height: 22, padding: '0 8px', fontSize: 10.5 }}>Mirror</button>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Watchlist + Resolving soon + Onboarding */}
      <AdmSectionHead title="Markets you're watching" action={<a href="App-Markets.html" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Browse all →</a>} />
      <div className="adm-grid-2" style={{ marginBottom: 28 }}>
        <div className="adm-table-wrap" style={{ gridColumn: 'span 1' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Yes</th>
                <th>Δ 24h</th>
                <th>Vol</th>
                <th>Resolves</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map(m => (
                <tr key={m.sym}>
                  <td>
                    <a href="App-Market-Detail.html" style={{ display: 'block', textDecoration: 'none' }}>
                      <div className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{m.sym}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <UsrVenueBadge venue={m.venue} />
                        {m.whale > 0 && <span className="adm-pill is-accent" style={{ height: 16, fontSize: 9.5 }}>{m.whale} whales</span>}
                      </div>
                    </a>
                  </td>
                  <td style={{ minWidth: 90 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="mono tabnum" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>¢{m.yes}</span>
                      <MicroBookViz yes={m.yes} />
                    </div>
                  </td>
                  <td className="col-num" style={{ color: m.chg >= 0 ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.chg >= 0 ? '+' : ''}{m.chg.toFixed(1)}%</td>
                  <td className="col-mono col-secondary">{m.vol}</td>
                  <td className="col-mono col-tertiary">{m.resolves}</td>
                  <td style={{ width: 32 }}><a href="App-Market-Detail.html" className="row-action"><AdmIcon name="arrow-up-right" size={13} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-card-head" style={{ padding: '14px 18px 0', marginBottom: 8 }}>
            <div className="adm-card-icon"><AdmIcon name="clock" size={14} /></div>
            <h3 className="adm-card-title">Resolving soon</h3>
            <span className="adm-pill" style={{ marginLeft: 8 }}>3 OPEN</span>
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            {RESOLVING_SOON.map((m, i) => (
              <div key={m.sym} style={{ padding: '10px 0', borderBottom: i < RESOLVING_SOON.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{m.sym}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--accent-text)' }}>{m.when}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>{m.name}</div>
                <div className="usr-timeline">
                  <div className="usr-timeline-step is-done">
                    <div className="usr-timeline-dot" /><div className="usr-timeline-label">Open</div>
                  </div>
                  <div className="usr-timeline-step is-done">
                    <div className="usr-timeline-dot" /><div className="usr-timeline-label">Trading</div>
                  </div>
                  <div className="usr-timeline-step is-active">
                    <div className="usr-timeline-dot" /><div className="usr-timeline-label">Pending</div>
                  </div>
                  <div className="usr-timeline-step">
                    <div className="usr-timeline-dot" /><div className="usr-timeline-label">Resolved</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)', marginTop: 6 }}>
                  <span>your position</span>
                  <span className={`adm-pill ${m.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{m.side}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{m.position}</span>
                  <span style={{ marginLeft: 'auto' }}>yes ¢{m.yes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding — show when not all done */}
      <div className="adm-card" style={{ marginBottom: 24 }}>
        <div className="adm-card-head">
          <div className="adm-card-icon"><AdmIcon name="circle-check" size={14} /></div>
          <h3 className="adm-card-title">Get to live · 4 of 6 done</h3>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>Most users go live in 9 days</span>
          <a href="App-Onboarding.html" className="adm-card-action" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Open checklist →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {ONBOARDING.map(o => (
            <div key={o.n} className={`usr-checklist-item${o.done ? ' is-done' : ''}${o.active ? ' is-active' : ''}`} style={{ padding: '10px 12px' }}>
              <div className="usr-checklist-num">{o.done ? <AdmIcon name="check" size={11} /> : o.n}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textDecoration: o.done ? 'line-through' : 'none' }}>{o.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'Geist Mono, monospace' }}>{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
