/* Polyforge — Strategies · Templates
   Curated starting points for new strategies. Filter by category, difficulty, edge. */

const ST_CATEGORIES = [
  { id: 'all',     label: 'All' },
  { id: 'macro',   label: 'Macro' },
  { id: 'whale',   label: 'Whale-mirror' },
  { id: 'arb',     label: 'Arbitrage' },
  { id: 'event',   label: 'Event-driven' },
  { id: 'sport',   label: 'Sports' },
  { id: 'sentiment', label: 'Sentiment' },
];

const ST_TEMPLATES = [
  { id: 'fed-cycle',     name: 'Macro · Fed cycle',           cat: 'macro',     difficulty: 'Beginner',     edge: '+18%', uses: 1284, blocks: 6, sub: 'Long YES on rate-cut markets when Fed funds futures price ≥ 60% probability.', author: 'Polyforge', featured: true },
  { id: 'whale-poli',    name: 'Politics whale shadow',       cat: 'whale',     difficulty: 'Intermediate', edge: '+22%', uses: 842,  blocks: 8, sub: 'Mirror top-10 politics whales sized to 0.5× their entry; auto-stop on 30% drawdown.', author: 'Polyforge', featured: true },
  { id: 'cross-venue',   name: 'Cross-venue arb',             cat: 'arb',       difficulty: 'Advanced',     edge: '+12%', uses: 412,  blocks: 11, sub: 'Buy YES on Polymarket when same-question is ≥3¢ cheaper than Kalshi; offset on the other side.', author: 'Polyforge', featured: true },
  { id: 'fomc-fade',     name: 'FOMC press-conf fade',        cat: 'event',     difficulty: 'Intermediate', edge: '+14%', uses: 386,  blocks: 7, sub: 'Counter-trend the first 30-min reaction in macro markets after FOMC presser.', author: 'Polyforge' },
  { id: 'sport-sharp',   name: 'Sports · Sharp counter',      cat: 'sport',     difficulty: 'Intermediate', edge: '+8%',  uses: 268,  blocks: 5, sub: 'Buy when public money flips against sharp action ≥30 min before tip-off.', author: 'cassandra.x' },
  { id: 'cpi-cool',      name: 'CPI cool-down trade',         cat: 'event',     difficulty: 'Beginner',     edge: '+11%', uses: 248,  blocks: 4, sub: 'YES on CPI-COOL markets when prior 3-month avg ≤ 2.4%; flat into release.', author: '0xtidemark' },
  { id: 'eth-etf-flow',  name: 'ETH ETF flow tracker',        cat: 'macro',     difficulty: 'Advanced',     edge: '+24%', uses: 184,  blocks: 9, sub: 'Long approval markets when net inflows > $200M for 3 consecutive days.', author: 'unholyfist.eth' },
  { id: 'twit-pulse',    name: 'Sentiment pulse · X',         cat: 'sentiment', difficulty: 'Intermediate', edge: '+9%',  uses: 142,  blocks: 6, sub: 'Trade momentum when verified-account sentiment shifts ≥2σ from 7-day mean.', author: 'plinkochamp.eth' },
  { id: 'breakout-mom',  name: 'Breakout momentum',           cat: 'macro',     difficulty: 'Beginner',     edge: '+7%',  uses: 124,  blocks: 5, sub: 'Buy markets crossing above 7-day high with ≥1.5× avg volume.', author: 'Polyforge' },
  { id: 'cluster-arb',   name: 'Cluster arbitrage',           cat: 'arb',       difficulty: 'Advanced',     edge: '+16%', uses: 96,   blocks: 13, sub: 'Find related markets where YES probabilities sum > 1.0; size bet on convergence.', author: 'Polyforge' },
];

const ST_DIFF = { Beginner: '', Intermediate: 'is-warn', Advanced: 'is-loss' };

function App() {
  const [cat, setCat] = React.useState('all');
  const [diff, setDiff] = React.useState('all');
  const filtered = ST_TEMPLATES.filter(t =>
    (cat === 'all' || t.cat === cat) &&
    (diff === 'all' || t.difficulty === diff)
  );

  return (
    <UsrShell active="templates" title="Strategy templates" crumbs={[
      { label: 'Strategies', href: 'App-Strategies.html' },
      { label: 'Templates' },
    ]}>
      <AdmPageHead
        title="Templates"
        sub="Curated strategies you can fork and customize · 24 templates · backtested across 12 months"
      />

      <div className="adm-tabs" style={{ marginBottom: 20 }}>
        <a href="App-Strategies.html" className="adm-tab">My strategies</a>
        <a href="App-Strategies-Templates.html" className="adm-tab is-active">Templates</a>
        <a href="App-Strategies-Compare.html" className="adm-tab">Compare</a>
      </div>

      {/* Filters */}
      <div className="adm-card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>CATEGORY</span>
          <div className="adm-filter-group">
            {ST_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`adm-filter ${cat === c.id ? 'is-active' : ''}`}>{c.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>DIFFICULTY</span>
          <div className="adm-filter-group">
            {['all', 'Beginner', 'Intermediate', 'Advanced'].map(d => (
              <button key={d} onClick={() => setDiff(d)} className={`adm-filter ${diff === d ? 'is-active' : ''}`}>{d === 'all' ? 'Any' : d}</button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-secondary)' }}>{filtered.length} templates</div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {filtered.map(t => (
          <div key={t.id} className="adm-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
            {t.featured && <span className="adm-pill is-gain" style={{ fontSize: 9, position: 'absolute', top: 12, right: 12 }}>FEATURED</span>}
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.013em' }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>by {t.author}</div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{t.sub}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`adm-pill ${ST_DIFF[t.difficulty]}`} style={{ fontSize: 10 }}>{t.difficulty}</span>
              <span className="adm-pill" style={{ fontSize: 10 }}>{t.blocks} blocks</span>
              <span className="adm-pill is-gain" style={{ fontSize: 10 }}>{t.edge} · 12mo edge</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.uses.toLocaleString()} uses</span>
              <a href="App-Strategy-Detail.html" className="adm-btn" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>Preview</a>
              <a href="App-Builder.html" className="adm-btn adm-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>Use template</a>
            </div>
          </div>
        ))}
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);