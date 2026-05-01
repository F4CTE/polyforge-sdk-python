/* Polyforge — Whales · Profile
   Deep dive on a single whale wallet. */

const WP = {
  who: 'unholyfist.eth',
  avatar: 'UF',
  addr: '0x82aF4d1c7e2b8F9a3C5d8E1B7c2A4f6D9e3b2d9c1',
  short: '0x82aF…d9c1',
  joined: 'Tracked since Jan 14, 2026',
  followers: 1284,
  followedByYou: true,
  mirroring: true,
};

const WP_KPIS = [
  { label: '30d edge',     value: '+24.2%', delta: '+3.4 vs 60d', deltaKind: 'gain' },
  { label: 'Win rate',     value: '78%',    delta: '142 trades',  deltaKind: 'neutral' },
  { label: 'Avg position', value: '$18.2K', delta: 'Largest $84K', deltaKind: 'neutral' },
  { label: '30d volume',   value: '$2.4M',  delta: '+18% vs 60d', deltaKind: 'gain' },
];

// 90-day cumulative P&L curve
const WP_CURVE = (() => {
  const out = [], n = 90;
  let v = 100000;
  for (let i = 0; i <= n; i++) {
    v += (Math.sin(i / 7) * 1800) + (Math.random() - 0.4) * 1200 + 800;
    out.push(Math.round(v));
  }
  return out;
})();

const WP_POSITIONS = [
  { market: 'FED-CUT-JUL',   side: 'YES', entry: '¢73', mark: '¢81', size: '$48,200', pnl: '+$5,280',  pnlPct: '+10.9%', held: '6d' },
  { market: 'BTC-150K-DEC',  side: 'NO',  entry: '¢68', mark: '¢62', size: '$31,200', pnl: '+$2,760',  pnlPct: '+8.8%',  held: '12d' },
  { market: 'ELEC28-DEM',    side: 'YES', entry: '¢42', mark: '¢48', size: '$22,000', pnl: '+$1,320',  pnlPct: '+6.0%',  held: '4d' },
  { market: 'CPI-MAR-COOL',  side: 'YES', entry: '¢56', mark: '¢62', size: '$12,800', pnl: '+$1,372',  pnlPct: '+10.7%', held: '9d' },
  { market: 'OSCARS-OPP',    side: 'NO',  entry: '¢81', mark: '¢74', size: '$14,500', pnl: '+$1,253',  pnlPct: '+8.6%',  held: '2d' },
];

const WP_HISTORY = [
  { date: 'Apr 22', market: 'NVDA-EARN-Q1',    side: 'YES', resolved: 'YES', pnl: '+$8,420', pnlPct: '+24.4%' },
  { date: 'Apr 18', market: 'TARIFF-CHN-25',   side: 'YES', resolved: 'YES', pnl: '+$3,180', pnlPct: '+18.2%' },
  { date: 'Apr 14', market: 'ETH-ETF-Q3',      side: 'YES', resolved: 'YES', pnl: '+$12,800', pnlPct: '+42.6%' },
  { date: 'Apr 09', market: 'NFL-SB-CHIEFS',   side: 'NO',  resolved: 'NO',  pnl: '-$2,400', pnlPct: '-12.0%' },
  { date: 'Apr 02', market: 'SCOTUS-RULE-JUN', side: 'YES', resolved: 'YES', pnl: '+$5,640', pnlPct: '+28.2%' },
];

const WP_CATEGORIES = [
  { cat: 'Politics', pct: 38, edge: '+28.4%' },
  { cat: 'Crypto',   pct: 28, edge: '+22.1%' },
  { cat: 'Markets',  pct: 18, edge: '+18.6%' },
  { cat: 'Sports',   pct: 10, edge: '+8.4%' },
  { cat: 'Tech',     pct: 6,  edge: '+14.2%' },
];

function WpCurve({ data }) {
  const w = 720, h = 220, pad = 16;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = path + ` L${pts[pts.length-1][0]},${h-pad} L${pad},${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }} aria-hidden="true">
      <defs>
        <linearGradient id="wpg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--gain)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wpg)" />
      <path d={path} fill="none" stroke="var(--gain)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const [tab, setTab] = React.useState('positions');
  const [following, setFollowing] = React.useState(WP.followedByYou);

  return (
    <UsrShell active="whales" title={`Whales · ${WP.who}`} crumbs={[
      { label: 'Whales', href: 'App-Whales.html' },
      { label: 'Following', href: 'App-Whales-Following.html' },
      { label: WP.who },
    ]}>
      {/* Profile header */}
      <div className="adm-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div className="usr-whale-avatar" style={{ width: 64, height: 64, fontSize: 22, fontWeight: 600 }}>{WP.avatar}</div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="mono" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{WP.who}</h2>
              <span className="adm-pill is-gain" style={{ fontSize: 10 }}>TOP 1% · 30D EDGE</span>
              {WP.mirroring && <span className="adm-pill" style={{ fontSize: 10 }}>AUTO-MIRRORING</span>}
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>{WP.addr}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{WP.joined} · {WP.followers.toLocaleString()} followers</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFollowing(!following)} className={`adm-btn ${following ? '' : 'adm-btn-primary'}`}>
              {following ? '✓ Following' : '+ Follow'}
            </button>
            <button className="adm-btn">Create mirror strategy</button>
            <button className="adm-btn" aria-label="More">⋯</button>
          </div>
        </div>

        <div className="adm-grid-4" style={{ marginTop: 20 }}>
          {WP_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.deltaKind} />)}
        </div>
      </div>

      <div className="adm-grid-2-13" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Equity curve */}
        <div className="adm-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>P&L · 90 days</h3>
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600, color: 'var(--gain-text)' }}>+$184,210</span>
          </div>
          <WpCurve data={WP_CURVE} />
        </div>

        {/* Categories */}
        <div className="adm-card" style={{ padding: 20 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Category mix · 30d</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {WP_CATEGORIES.map(c => (
              <div key={c.cat}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{c.cat}</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', marginRight: 10 }}>{c.pct}%</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--gain-text)', fontWeight: 600, width: 60, textAlign: 'right' }}>{c.edge}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--accent-default)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs: positions / history */}
      <div className="adm-card" style={{ padding: 0 }}>
        <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 0 }}>
          <button onClick={() => setTab('positions')} className={`adm-tab ${tab === 'positions' ? 'is-active' : ''}`}>Open positions ({WP_POSITIONS.length})</button>
          <button onClick={() => setTab('history')} className={`adm-tab ${tab === 'history' ? 'is-active' : ''}`}>Recent resolutions</button>
        </div>
        {tab === 'positions' ? (
          <table className="adm-table">
            <thead><tr>
              <th>Market</th><th>Side</th><th>Entry</th><th>Mark</th><th>Size</th>
              <th style={{ textAlign: 'right' }}>P&L</th><th style={{ textAlign: 'right' }}>%</th><th>Held</th>
            </tr></thead>
            <tbody>
              {WP_POSITIONS.map((p, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{p.market}</td>
                  <td><span className={`adm-pill ${p.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{p.side}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.entry}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.mark}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.size}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--gain-text)' }}>{p.pnl}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--gain-text)' }}>{p.pnlPct}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{p.held}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="adm-table">
            <thead><tr>
              <th>Date</th><th>Market</th><th>Side</th><th>Resolved</th>
              <th style={{ textAlign: 'right' }}>P&L</th><th style={{ textAlign: 'right' }}>%</th>
            </tr></thead>
            <tbody>
              {WP_HISTORY.map((h, i) => {
                const win = h.pnl.startsWith('+');
                return (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.date}</td>
                    <td className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{h.market}</td>
                    <td><span className={`adm-pill ${h.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{h.side}</span></td>
                    <td><span className={`adm-pill ${h.resolved === h.side ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{h.resolved}</span></td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{h.pnl}</td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{h.pnlPct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);