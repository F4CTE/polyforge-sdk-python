/* Polyforge — Strategy Marketplace */

const FEATURED = [
  { id: 'whale-mirror-v3', name: 'Whale Mirror · Politics', author: 'panoramicquant', authorVerified: true, desc: 'Tails the top-decile politics traders. Auto-pause around major event windows.', sharpe: 1.84, ret1y: 47.2, dd: -8.1, users: 1242, price: 'free', tags: ['politics', 'whale', 'mirror'], chartKind: 'gain', curve: [100, 102, 101, 105, 108, 110, 113, 117, 122, 128, 135, 140, 147], badge: 'editor pick' },
  { id: 'cpi-fade-v4',     name: 'CPI Cool Fade',           author: 'macrofades',     authorVerified: true, desc: 'Fades cooling inflation expectations 12h before release; ladders out post-print.', sharpe: 1.62, ret1y: 38.1, dd: -6.4, users: 892, price: '$29/mo', tags: ['CPI', 'macro', 'event'], chartKind: 'gain', curve: [100, 99, 102, 105, 104, 109, 113, 119, 122, 127, 131, 136, 138], badge: 'top earner' },
  { id: 'cross-arb-v2',    name: 'Polymarket ↔ Kalshi Arb', author: 'spreaderlabs',    authorVerified: true, desc: 'Triggers when cross-venue spread > 3¢ with sufficient depth. Hedge ladder.', sharpe: 2.14, ret1y: 28.4, dd: -3.1, users: 2104, price: 'free', tags: ['arb', 'cross-venue'], chartKind: 'gain', curve: [100, 102, 104, 105, 107, 110, 112, 115, 117, 120, 124, 126, 128], badge: 'low-risk' },
];

const ALL = [
  { id: 'imbalance-v1',  name: 'Order-book Imbalance Taker',   author: 'mevwizard',   sharpe: 1.41, ret: 22.1, dd: -9.0, users: 412, price: 'free',    tags: ['scalp'] },
  { id: 'oscar-fav',     name: 'Oscars Favorite Hedge',        author: 'redcarpet',   sharpe: 0.94, ret: 12.4, dd: -4.2, users: 188, price: '$9/mo',  tags: ['entertainment', 'event'] },
  { id: 'sb-prop',       name: 'Super Bowl Prop Splitter',     author: 'gridironq',   sharpe: 1.18, ret: 18.6, dd: -7.1, users: 304, price: '$19/mo', tags: ['sports'] },
  { id: 'fed-rate-v6',   name: 'Fed Rate Cut Tracker',         author: 'fomckwhisp',  sharpe: 1.56, ret: 31.0, dd: -5.8, users: 711, price: '$29/mo', tags: ['rates', 'fed', 'macro'] },
  { id: 'tariff-shock',  name: 'Tariff Shock Hedger',          author: 'tradedeskie', sharpe: 1.22, ret: 19.8, dd: -6.5, users: 254, price: 'free',    tags: ['policy', 'macro'] },
  { id: 'btc-vol-fade',  name: 'BTC Vol Fade · 30d',           author: 'cryptopa',    sharpe: 1.71, ret: 35.4, dd: -8.7, users: 631, price: '$39/mo', tags: ['crypto', 'vol'] },
  { id: 'earn-orient',   name: 'Earnings Orientation',         author: 'edgarflow',   sharpe: 1.34, ret: 24.2, dd: -7.4, users: 297, price: '$19/mo', tags: ['earnings', 'event'] },
  { id: 'climate-bin',   name: 'Climate Resolution Binary',    author: 'ipccquant',   sharpe: 0.88, ret: 14.0, dd: -5.4, users: 142, price: 'free',    tags: ['climate'] },
  { id: 'mirror-fund',   name: 'Mirror · Cyclone Capital',     author: 'cycloneCap',  sharpe: 2.31, ret: 51.0, dd: -7.2, users: 88,  price: '$99/mo', tags: ['mirror', 'fund'] },
];

function MiniCurve({ pts, kind = 'gain' }) {
  const w = 240, h = 60;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const step = w / (pts.length - 1);
  const ys = pts.map(p => h - 4 - ((p - min) / range) * (h - 8));
  const linePath = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`;
  const color = kind === 'loss' ? 'var(--loss-text)' : 'var(--gain-text)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }}>
      <defs>
        <linearGradient id="mc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#mc-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function App() {
  const [tag, setTag] = React.useState('all');
  const tags = ['all', 'free', 'macro', 'event', 'mirror', 'arb', 'sports', 'crypto', 'policy'];
  const filtered = tag === 'all' ? ALL : tag === 'free' ? ALL.filter(s => s.price === 'free') : ALL.filter(s => s.tags.includes(tag));
  return (
    <UsrShell active="marketplace" title="Marketplace" actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="upload" size={12} />Publish strategy</button>
    }>
      <AdmPageHead title="Strategy marketplace" subtitle="86 published strategies · clone, fork, or subscribe with verified live performance." />

      {/* Featured row */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 12 }}>Featured this week</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {FEATURED.map(s => (
            <div key={s.id} className="adm-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                    <span className="adm-pill is-accent" style={{ height: 16, fontSize: 9 }}>{s.badge}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-app)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>{s.author[0].toUpperCase()}</span>
                    <span>{s.author}</span>
                    {s.authorVerified && <span title="Verified author" style={{ color: 'var(--accent-text)', display: 'inline-flex' }}><AdmIcon name="shield-check" size={11} /></span>}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, fontFamily: 'Geist Mono, monospace', color: s.price === 'free' ? 'var(--gain-text)' : 'var(--text-primary)', fontWeight: 600 }}>{s.price}</div>
              </div>
              <div style={{ padding: '0 16px' }}>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{s.desc}</p>
              </div>
              <MiniCurve pts={s.curve} kind={s.chartKind} />
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                <div><div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sharpe</div><div style={{ fontSize: 13, fontFamily: 'Geist Mono, monospace', fontWeight: 600 }}>{s.sharpe}</div></div>
                <div><div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1y return</div><div style={{ fontSize: 13, fontFamily: 'Geist Mono, monospace', fontWeight: 600, color: 'var(--gain-text)' }}>+{s.ret1y}%</div></div>
                <div><div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max DD</div><div style={{ fontSize: 13, fontFamily: 'Geist Mono, monospace', fontWeight: 600, color: 'var(--loss-text)' }}>{s.dd}%</div></div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <button className="adm-btn adm-btn-primary" style={{ flex: 1 }}>{s.price === 'free' ? 'Clone to paper' : 'Subscribe'}</button>
                <button className="adm-btn adm-btn-ghost"><AdmIcon name="info" size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All strategies */}
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            {tags.map(t => (
              <button key={t} className={`adm-filter${tag === t ? ' is-active' : ''}`} onClick={() => setTag(t)}>{t}</button>
            ))}
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 260 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Search strategies, authors, tags..." />
          </div>
          <select className="adm-input" style={{ width: 160 }} defaultValue="sharpe">
            <option value="sharpe">Sort · Sharpe</option>
            <option value="return">Sort · 1y return</option>
            <option value="users">Sort · Subscribers</option>
            <option value="recent">Sort · Recently added</option>
          </select>
        </div>
        <table className="adm-table">
          <thead><tr><th>Strategy</th><th>Author</th><th>Tags</th><th className="col-num">Sharpe</th><th className="col-num">1y</th><th className="col-num">Max DD</th><th className="col-num">Subs</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td><div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</div></td>
                <td className="col-mono col-tertiary">{s.author}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.tags.map(t => <code key={t} style={{ fontSize: 9.5, padding: '2px 5px', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>{t}</code>)}
                  </div>
                </td>
                <td className="col-mono col-num" style={{ fontWeight: 600 }}>{s.sharpe}</td>
                <td className="col-mono col-num" style={{ color: 'var(--gain-text)' }}>+{s.ret}%</td>
                <td className="col-mono col-num" style={{ color: 'var(--loss-text)' }}>{s.dd}%</td>
                <td className="col-mono col-num col-tertiary">{s.users}</td>
                <td><span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: s.price === 'free' ? 'var(--gain-text)' : 'var(--text-primary)' }}>{s.price}</span></td>
                <td><button className="adm-btn adm-btn-ghost" style={{ height: 24, fontSize: 11 }}>Clone</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">{filtered.length} strategies · ranked by Sharpe across verified live performance</div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
