/* Polyforge — Collections
   Curated bundles of markets/strategies. Save groups, share with team. */

const CO_KPIS = [
  { label: 'Your collections', value: '12',  delta: '4 shared',     kind: 'neutral' },
  { label: 'Items saved',      value: '184', delta: '↑ 32 this mo', kind: 'gain' },
  { label: 'Followers',        value: '428', delta: '↑ 12 today',   kind: 'gain' },
  { label: 'Featured',         value: '2',   delta: 'editor picks', kind: 'gain' },
];

const CO_MINE = [
  { id: 'c-fed', name: 'Fed Watch 2025', items: 18, kind: 'Markets', updated: '2h ago', color: '#0066ff', shared: true,
    desc: 'Every active rate-cut, dot-plot, and FOMC-meeting market.', followers: 184 },
  { id: 'c-elec', name: 'Election Cycle', items: 24, kind: 'Markets', updated: '6h ago', color: '#ef4444', shared: true,
    desc: 'Senate, House, presidential, and state-level prediction markets through Nov.', followers: 142 },
  { id: 'c-mac',  name: 'Macro Calendar', items: 12, kind: 'Strategies', updated: 'yesterday', color: '#10b981', shared: false,
    desc: 'Strategies that trade CPI, NFP, and FOMC announcement windows.', followers: 0 },
  { id: 'c-cry',  name: 'Crypto ETF Watch', items: 14, kind: 'Markets', updated: '3 days ago', color: '#a78bfa', shared: true,
    desc: 'BTC/ETH/SOL spot-ETF approval markets and price-target conditionals.', followers: 96 },
  { id: 'c-wha',  name: 'Smart-money plays', items: 22, kind: 'Mixed', updated: '1 week ago', color: '#f59e0b', shared: false,
    desc: 'Markets with high whale concentration ratios — what the big wallets are doing.', followers: 0 },
  { id: 'c-spo',  name: 'NFL Playoffs', items: 32, kind: 'Markets', updated: '2 weeks ago', color: '#14b8a6', shared: false,
    desc: 'Conference, division, and Super Bowl markets.', followers: 0 },
];

const CO_FEATURED = [
  { id: 'f1', name: 'The Polymarket 100', author: 'editorial', items: 100, followers: '14.2k', desc: 'Highest-volume markets across all categories.' },
  { id: 'f2', name: 'Trending this week',   author: 'editorial', items: 24,  followers: '8.4k',  desc: 'Markets with surging volume and notable price moves.' },
  { id: 'f3', name: 'Resolves in 7 days',   author: 'editorial', items: 38,  followers: '3.2k',  desc: 'Short-dated markets near settlement — high liquidity, sharp moves.' },
];

function App() {
  return (
    <UsrShell active="collections" title="Collections" crumbs={[{ label: 'Collections' }]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New collection</button>
    }>
      <AdmPageHead
        title="Collections"
        sub="Save groups of markets and strategies · share with your team or publish to followers"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {CO_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.kind} />)}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Your collections</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {CO_MINE.map(c => (
          <a key={c.id} href="App-Collection-Detail.html" className="adm-card" style={{ padding: 16, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            {/* Color stripe */}
            <div style={{ height: 3, background: c.color, borderRadius: 2, marginBottom: 4, opacity: 0.85 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
              {c.shared && <span className="adm-pill is-info" style={{ fontSize: 9.5 }}>SHARED</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>{c.items}</span> {c.kind.toLowerCase()} · updated {c.updated}
              </div>
              {c.shared && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AdmIcon name="users" size={11} /> {c.followers}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        Featured <span className="adm-pill is-info" style={{ fontSize: 9.5 }}>EDITORIAL</span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {CO_FEATURED.map(c => (
          <a key={c.id} href="App-Collection-Detail.html" className="adm-card" style={{ padding: 16, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-elevated)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{c.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span><span className="mono" style={{ color: 'var(--text-secondary)' }}>{c.items}</span> markets</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><AdmIcon name="users" size={11} /> {c.followers}</span>
            </div>
          </a>
        ))}
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);