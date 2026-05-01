/* Polyforge — Strategy Templates
   Curated gallery of pre-built strategies. Clone, customize, deploy. */

const ST_TEMPLATES = [
  {
    id: 'whale-shadow', name: 'Whale Shadow',           cat: 'Mirror',
    desc: 'Mirror the top 12 whale wallets with a 3-min lag · auto-rebalance hourly',
    perf30: '+18.4%', winRate: '64%', sharpe: '2.1', risk: 'Med', users: '2,847',
    tags: ['mirror', 'momentum', 'top performers'], featured: true,
  },
  {
    id: 'fed-day',  name: 'FOMC Drift Capture',         cat: 'Macro',
    desc: 'Long YES on rate-cut markets when 5d analyst-revision delta tips dovish',
    perf30: '+14.2%', winRate: '71%', sharpe: '2.4', risk: 'Low', users: '1,920',
    tags: ['macro', 'event-driven'], featured: true,
  },
  {
    id: 'arb-bot', name: 'Cross-Venue Arbitrage',       cat: 'Arbitrage',
    desc: 'Auto-execute 2¢+ price gaps between Polyforge ↔ Polymarket ↔ Kalshi',
    perf30: '+9.6%',  winRate: '92%', sharpe: '3.8', risk: 'Low', users: '1,340',
    tags: ['arbitrage', 'low risk', 'high frequency'], featured: true,
  },
  {
    id: 'earnings-beat', name: 'Earnings Beat Playbook', cat: 'Equities',
    desc: 'Long YES when analyst-revision count tips +12 within 5d of report',
    perf30: '+22.8%', winRate: '58%', sharpe: '1.9', risk: 'High', users: '892',
    tags: ['earnings', 'directional'],
  },
  {
    id: 'mean-reversion', name: 'Resolution Mean-Reversion', cat: 'Stat-Arb',
    desc: 'Fade markets that move >8¢ on no fundamental news within 1h',
    perf30: '+7.2%', winRate: '68%', sharpe: '1.7', risk: 'Med', users: '1,108',
    tags: ['stat-arb', 'contrarian'],
  },
  {
    id: 'news-pulse', name: 'News Pulse Reactor',       cat: 'Event',
    desc: 'Trade within 90s of high-confidence news events from 14 source feeds',
    perf30: '+11.4%', winRate: '54%', sharpe: '1.5', risk: 'High', users: '634',
    tags: ['news', 'low latency'],
  },
  {
    id: 'sentiment-grid', name: 'Sentiment Grid',        cat: 'ML',
    desc: 'Composite sentiment score across X / Reddit / news · enter on extremes',
    perf30: '+13.8%', winRate: '61%', sharpe: '1.8', risk: 'Med', users: '758',
    tags: ['ml', 'sentiment'],
  },
  {
    id: 'whale-fade', name: 'Whale Fade',                cat: 'Mirror',
    desc: 'Counter-trade the bottom-5 whale wallets · profit when they capitulate',
    perf30: '+6.4%', winRate: '52%', sharpe: '1.2', risk: 'High', users: '412',
    tags: ['contrarian', 'mirror'],
  },
  {
    id: 'dca-broad', name: 'Broad Market DCA',           cat: 'Passive',
    desc: 'Equal-weight allocation across top 24 markets by volume · weekly rebalance',
    perf30: '+4.8%', winRate: 'n/a',  sharpe: '0.9', risk: 'Low', users: '3,210',
    tags: ['passive', 'beginner'],
  },
];

const ST_CATS = ['All', 'Mirror', 'Macro', 'Arbitrage', 'Equities', 'Stat-Arb', 'Event', 'ML', 'Passive'];

function App() {
  const [cat, setCat] = React.useState('All');
  const [search, setSearch] = React.useState('');

  const filtered = ST_TEMPLATES.filter(t =>
    (cat === 'All' || t.cat === cat) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()))
  );
  const featured = filtered.filter(t => t.featured);
  const rest     = filtered.filter(t => !t.featured);

  const Card = ({ t, big }) => (
    <div className="adm-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span className="adm-pill" style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.cat}</span>
            {t.featured && <span className="adm-pill is-gain" style={{ fontSize: 9.5 }}>★ Featured</span>}
          </div>
          <h3 style={{ margin: 0, fontSize: big ? 16 : 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.013em' }}>{t.name}</h3>
        </div>
        <div className="mono" style={{ fontSize: big ? 18 : 15, fontWeight: 600, color: 'var(--gain-text)' }}>{t.perf30}</div>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.desc}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { label: '30d return', value: t.perf30, color: 'var(--gain-text)' },
          { label: 'Win rate',    value: t.winRate },
          { label: 'Sharpe',      value: t.sharpe },
          { label: 'Risk',        value: t.risk },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: s.color || 'var(--text-primary)', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.users} active</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>Preview</button>
          <button className="adm-btn adm-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>Clone</button>
        </div>
      </div>
    </div>
  );

  return (
    <UsrShell active="templates" title="Strategy templates" crumbs={[
      { label: 'Strategies', href: 'App-Strategies.html' },
      { label: 'Templates' },
    ]} actions={
      <button className="adm-btn"><AdmIcon name="plus" size={12} />Build from scratch</button>
    }>
      <AdmPageHead
        title="Strategy templates"
        sub={`${ST_TEMPLATES.length} curated strategies · clone, customize, deploy in minutes`}
      />

      {/* Filters */}
      <div className="adm-card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="adm-filter-group">
          {ST_CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} className={`adm-filter ${cat === c ? 'is-active' : ''}`}>{c}</button>
          ))}
        </div>
        <input
          className="adm-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…"
          style={{ marginLeft: 'auto', width: 220, padding: '6px 10px', fontSize: 12 }}
        />
      </div>

      {/* Featured */}
      {featured.length > 0 && cat === 'All' && !search && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>★ Featured this week</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {featured.map(t => <Card key={t.id} t={t} big />)}
          </div>
        </>
      )}

      {/* Rest / All */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
        {cat === 'All' && !search ? 'More templates' : `${filtered.length} ${filtered.length === 1 ? 'template' : 'templates'}`}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {(cat === 'All' && !search ? rest : filtered).map(t => <Card key={t.id} t={t} />)}
      </div>

      {filtered.length === 0 && (
        <div className="adm-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No templates match your filters.
        </div>
      )}
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);