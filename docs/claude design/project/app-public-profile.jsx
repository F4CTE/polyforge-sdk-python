/* Polyforge — Public Profile (someone else's view)
   What other traders see when they visit a profile. */

const PP = {
  username: 'cassandra.x',
  displayName: 'Cassandra',
  bio: 'Politics + culture markets · long-only · contrarian on consensus calls',
  avatar: 'CX',
  joined: 'Feb 2, 2026',
  followers: 2104,
  following: 42,
  followedByYou: false,
  badges: [
    { id: 'top1',  label: 'Top 1% · 30d', kind: 'gain' },
    { id: 'verif', label: 'Verified',     kind: '' },
  ],
  kpis: [
    { label: '30d return',  value: '+18.6%', delta: '+3.4 vs 60d', deltaKind: 'gain' },
    { label: 'Win rate',    value: '71%',    delta: '186 trades',  deltaKind: 'neutral' },
    { label: 'Active for',  value: '11 wks', delta: '',            deltaKind: 'neutral' },
  ],
};

// Equity curve — relative %, no dollar amounts (privacy-respecting)
const PP_CURVE = (() => {
  const out = [], n = 90;
  let v = 0;
  for (let i = 0; i <= n; i++) {
    v += (Math.sin(i / 8) * 0.4) + (Math.random() - 0.4) * 0.5 + 0.25;
    out.push(v);
  }
  return out;
})();

const PP_PUBLIC_STRATEGIES = [
  { name: 'Politics · Contrarian fade',     followers: 482, edge30: '+22.4%', win: '74%', kind: 'Long-only' },
  { name: 'Cultural markets · Sharp side',  followers: 318, edge30: '+18.6%', win: '69%', kind: 'Long-only' },
  { name: 'Election cycle · Phase 2',       followers: 264, edge30: '+12.4%', win: '64%', kind: 'Mixed' },
];

const PP_RECENT = [
  { date: '2h',  market: 'FED-CUT-JUL',    side: 'YES', size: 'Large',  result: 'Open' },
  { date: '6h',  market: 'OSCARS-OPP',     side: 'NO',  size: 'Medium', result: 'Open' },
  { date: '1d',  market: 'TARIFF-CHN-25',  side: 'YES', size: 'Large',  result: 'YES · win' },
  { date: '2d',  market: 'NVDA-EARN-Q1',   side: 'YES', size: 'Medium', result: 'YES · win' },
  { date: '3d',  market: 'NFL-SB-CHIEFS',  side: 'NO',  size: 'Small',  result: 'YES · loss' },
  { date: '5d',  market: 'SCOTUS-RULE-JUN',side: 'YES', size: 'Large',  result: 'YES · win' },
];

function PpCurve({ data }) {
  const w = 720, h = 200, pad = 12;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = path + ` L${pts[pts.length-1][0]},${h-pad} L${pad},${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }} aria-hidden="true">
      <defs>
        <linearGradient id="ppg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--gain)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ppg)" />
      <path d={path} fill="none" stroke="var(--gain)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const [following, setFollowing] = React.useState(PP.followedByYou);
  const [tab, setTab] = React.useState('strategies');

  return (
    <UsrShell active="discover" title={PP.displayName} crumbs={[{ label: 'Discover', href: 'App-Discover.html' }, { label: PP.displayName }]}>
      {/* Header */}
      <div className="adm-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div className="usr-whale-avatar" style={{ width: 72, height: 72, fontSize: 24, fontWeight: 600 }}>{PP.avatar}</div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{PP.displayName}</h2>
              <span className="mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>@{PP.username}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {PP.badges.map(b => (
                <span key={b.id} className={`adm-pill ${b.kind ? 'is-' + b.kind : ''}`} style={{ fontSize: 10 }}>{b.label}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5, maxWidth: 600 }}>{PP.bio}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{PP.followers.toLocaleString()}</strong> followers</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{PP.following}</strong> following</span>
              <span>Joined {PP.joined}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFollowing(!following)} className={`adm-btn ${following ? '' : 'adm-btn-primary'}`}>
              {following ? '✓ Following' : '+ Follow'}
            </button>
            <button className="adm-btn">Message</button>
            <button className="adm-btn" aria-label="More">⋯</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Main */}
        <div>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {PP.kpis.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.deltaKind} />)}
          </div>

          {/* Returns chart — % only */}
          <div className="adm-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Cumulative return · 90 days</h3>
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>(% only · dollar amounts hidden by user)</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600, color: 'var(--gain-text)' }}>+{PP_CURVE[PP_CURVE.length-1].toFixed(1)}%</span>
            </div>
            <PpCurve data={PP_CURVE} />
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 12, display: 'flex', gap: 0 }}>
            {[
              { id: 'strategies', label: 'Public strategies' },
              { id: 'recent',     label: 'Recent activity' },
              { id: 'about',      label: 'About' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`} style={{ borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'strategies' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <table className="adm-table">
                <thead><tr>
                  <th>Strategy</th><th>Kind</th>
                  <th style={{ textAlign: 'right' }}>Followers</th>
                  <th style={{ textAlign: 'right' }}>30d edge</th>
                  <th style={{ textAlign: 'right' }}>Win rate</th>
                  <th style={{ width: 100 }}></th>
                </tr></thead>
                <tbody>
                  {PP_PUBLIC_STRATEGIES.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</td>
                      <td><span className="adm-pill" style={{ fontSize: 10 }}>{s.kind}</span></td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{s.followers}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--gain-text)' }}>{s.edge30}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{s.win}</td>
                      <td><a href="App-Copy-Setup.html" className="adm-btn adm-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>Copy</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'recent' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <table className="adm-table">
                <thead><tr>
                  <th>When</th><th>Market</th><th>Side</th><th>Size</th><th>Outcome</th>
                </tr></thead>
                <tbody>
                  {PP_RECENT.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.date} ago</td>
                      <td className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{r.market}</td>
                      <td><span className={`adm-pill ${r.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{r.side}</span></td>
                      <td><span className="adm-pill" style={{ fontSize: 10 }}>{r.size}</span></td>
                      <td style={{ fontSize: 12, color: r.result.includes('win') ? 'var(--gain-text)' : r.result.includes('loss') ? 'var(--loss-text)' : 'var(--text-secondary)' }}>{r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'about' && (
            <div className="adm-card" style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
                {PP.bio} · Active across politics, cultural events, and macro markets.
                Discloses % returns publicly; dollar amounts and position sizes hidden by user preference.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card" style={{ padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { cat: 'Politics', pct: 48 },
                { cat: 'Markets',  pct: 24 },
                { cat: 'Sports',   pct: 16 },
                { cat: 'Crypto',   pct: 12 },
              ].map(c => (
                <div key={c.cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{c.cat}</span>
                    <span className="mono" style={{ color: 'var(--text-tertiary)' }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--accent-default)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-card" style={{ padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Mutual followers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {['unholyfist.eth', '0xtidemark', 'plinkochamp.eth'].map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="usr-whale-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{name.slice(0, 2).toUpperCase()}</div>
                  <span className="mono" style={{ fontSize: 11.5 }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);