/* Polyforge — Discover hub
   Top-level discovery: trending markets, new markets, themes, recommended for you. */

const DC_TRENDING = [
  { name: 'Will Fed cut rates in June 2026?',     cat: 'Politics', price: 64, delta: '+4¢',  vol: '$4.8M',  trend: [50, 52, 55, 58, 60, 58, 62, 64] },
  { name: 'Ethereum ETF approval Q3',             cat: 'Crypto',   price: 71, delta: '+11¢', vol: '$4.2M',  trend: [40, 45, 50, 55, 60, 65, 68, 71] },
  { name: 'Trump vs Vance — GOP nominee',         cat: 'Politics', price: 72, delta: '+3¢',  vol: '$8.4M',  trend: [60, 62, 65, 68, 70, 71, 70, 72] },
  { name: 'BTC above $120k by July 1',            cat: 'Crypto',   price: 38, delta: '-2¢',  vol: '$2.4M',  trend: [50, 48, 46, 44, 42, 40, 39, 38] },
  { name: 'NVDA Q2 earnings beat',                cat: 'Markets',  price: 58, delta: '+3¢',  vol: '$1.2M',  trend: [50, 52, 54, 55, 56, 57, 56, 58] },
  { name: 'Apple WWDC AI announcement',           cat: 'Tech',     price: 78, delta: '+5¢',  vol: '$960K',  trend: [65, 68, 70, 72, 74, 75, 76, 78] },
];

const DC_THEMES = [
  { id: 'fed', icon: '🏦', title: 'Federal Reserve', sub: '12 markets · rate cuts, dot plot, FOMC schedule', vol: '$24.4M' },
  { id: 'eth', icon: '⚡', title: 'Ethereum ETF',     sub: '8 markets · approval timing, inflows, staking',   vol: '$18.2M' },
  { id: 'el',  icon: '🗳️', title: 'US Election 2028', sub: '24 markets · primary, general, electoral college', vol: '$48.4M' },
  { id: 'spo', icon: '🏆', title: 'NBA Playoffs',     sub: '32 markets · seeds, finals winner, MVP',           vol: '$12.8M' },
  { id: 'ai',  icon: '🤖', title: 'AI breakthroughs', sub: '18 markets · model releases, AGI, regulation',     vol: '$8.4M' },
  { id: 'sci', icon: '🔬', title: 'Science 2026',     sub: '14 markets · SpaceX, fusion, longevity',           vol: '$2.4M' },
];

const DC_NEW = [
  { name: 'Will SpaceX launch Starship orbital before July 31?', age: '2h ago', vol: '$0', initial: '38¢' },
  { name: 'BTC dominance above 52% in Q3',                       age: '4h ago', vol: '$680K', initial: '38¢' },
  { name: 'Argentina debt default by Q4',                        age: '8h ago', vol: '$240K', initial: '12¢' },
  { name: 'Microsoft AI revenue above $20B in 2026',             age: '1d ago', vol: '$1.4M', initial: '54¢' },
];

const DC_RECOMMENDED = [
  { name: 'Apple WWDC AI announcement',     reason: 'Based on your tech sector trades',         price: '78¢ YES', side: 'YES' },
  { name: 'Will SCOTUS rule by June 30?',   reason: 'You watch politics markets',                price: '68¢ YES', side: 'YES' },
  { name: 'Lakers make NBA playoffs',       reason: 'Trending in your network',                  price: '32¢ NO',  side: 'NO' },
];

function DcSparkline({ data, w = 80, h = 28 }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={isUp ? 'var(--gain)' : 'var(--loss)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  return (
    <UsrShell active="discover" title="Discover" crumbs={[{ label: 'Discover' }]}>
      <AdmPageHead
        title="Discover"
        sub="Trending markets, new launches, curated themes, and traders worth following · personalized to your activity"
      />

      {/* Trending markets */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.013em' }}>Trending now</h2>
          <a href="App-Markets.html" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none' }}>All markets →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {DC_TRENDING.map((m, i) => (
            <a key={i} href="App-Market-Detail.html" className="adm-card" style={{ padding: 14, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="adm-pill" style={{ fontSize: 9.5 }}>{m.cat}</span>
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)' }}>{m.vol}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>{m.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{m.price}¢</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: m.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.delta}</span>
                <DcSparkline data={m.trend} w={80} h={24} />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Themes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.013em' }}>Curated themes</h2>
          <a href="App-Collections.html" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none' }}>All collections →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {DC_THEMES.map(t => (
            <a key={t.id} href="App-Collection-Detail.html" className="adm-card" style={{
              padding: 16, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, var(--accent-subtle) 0%, var(--bg-surface) 60%)',
            }}>
              <div style={{ fontSize: 28 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{t.sub}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'auto', paddingTop: 8 }}>{t.vol} · 30d volume</div>
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* New markets */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.013em' }}>Newly launched</h2>
            <span className="adm-pill" style={{ marginLeft: 8, fontSize: 10 }}>last 24h</span>
          </div>
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {DC_NEW.map((m, i) => (
              <a key={i} href="App-Market-Detail.html" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < DC_NEW.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                textDecoration: 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.age} · vol {m.vol}</div>
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 600 }}>{m.initial}</div>
              </a>
            ))}
          </div>
        </div>

        {/* Recommended */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.013em' }}>For you</h2>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>· based on your activity</span>
          </div>
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {DC_RECOMMENDED.map((r, i) => (
              <a key={i} href="App-Market-Detail.html" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < DC_RECOMMENDED.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                textDecoration: 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.reason}</div>
                </div>
                <span className={`adm-pill ${r.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{r.price}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);