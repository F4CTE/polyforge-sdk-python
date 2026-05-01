/* Polyforge — News feed
   Curated news with market-impact tags, sentiment, related markets per article. */

const NW_ARTICLES = [
  { id: 'n1', source: 'Reuters',     time: '12 min ago', cat: 'Politics', sent: 'pos', impact: 'high', headline: 'Senate panel advances rate-cut framework as inflation eases below target', summary: 'A bipartisan committee voted 14–8 to advance language requiring the Fed to publish a quarterly path-rate decision matrix, tying voting transparency to forward guidance.', markets: [{ name: 'Will Fed cut rates in June 2026?', side: 'YES', delta: '+4¢' }, { name: 'CPI under 3.0% in May', side: 'YES', delta: '+2¢' }] },
  { id: 'n2', source: 'Bloomberg',   time: '34 min ago', cat: 'Crypto',   sent: 'pos', impact: 'high', headline: 'Ethereum ETF spot approval said to clear final SEC hurdle', summary: 'Three sources familiar with the matter say staff recommendation has moved to the Chair for sign-off, with a public announcement expected within ten business days.', markets: [{ name: 'Ethereum ETF approval Q3', side: 'YES', delta: '+11¢' }, { name: 'ETH above $4,000 by July', side: 'YES', delta: '+6¢' }] },
  { id: 'n3', source: 'Polymarket',  time: '1h ago',     cat: 'Markets',  sent: 'neu', impact: 'med',  headline: 'New market: Will SpaceX launch Starship orbital flight before July 31?', summary: 'A new market opened with $0 volume. Initial price set at 38¢ YES based on launch cadence and FAA filing data.', markets: [{ name: 'Starship orbital before July 31?', side: '—', delta: 'NEW' }] },
  { id: 'n4', source: 'Reuters',     time: '2h ago',     cat: 'Sports',   sent: 'neg', impact: 'med',  headline: 'Lakers ruled out two starters ahead of playoff bubble decision', summary: 'Both injuries are reported as week-to-week, materially affecting the team\'s playoff probability.', markets: [{ name: 'Lakers make NBA playoffs', side: 'NO', delta: '+8¢' }] },
  { id: 'n5', source: 'CoinDesk',    time: '3h ago',     cat: 'Crypto',   sent: 'pos', impact: 'low',  headline: 'On-chain whales accumulate $42M in long-tenor ETH options', summary: 'Block trades sized for institutional desks settled overnight, suggesting a coordinated hedge or directional bet against Q3 implied volatility.', markets: [{ name: 'ETH above $4,000 by July', side: 'YES', delta: '+2¢' }] },
  { id: 'n6', source: 'WSJ',         time: '4h ago',     cat: 'Tech',     sent: 'pos', impact: 'med',  headline: 'Apple WWDC keynote to feature on-device foundation model and developer tier', summary: 'Internal materials reviewed by the Journal show a paid developer tier providing low-latency edge inference, expected to launch alongside iOS 19.', markets: [{ name: 'Apple WWDC AI announcement', side: 'YES', delta: '+5¢' }] },
  { id: 'n7', source: 'AP',          time: '6h ago',     cat: 'Politics', sent: 'neg', impact: 'high', headline: 'Trump-Vance ticket faces ballot challenge in three states', summary: 'A coalition of state attorneys general filed simultaneous suits seeking declarative judgment on the 14th Amendment\'s scope.', markets: [{ name: 'Trump vs Vance — GOP nominee', side: 'NO', delta: '+3¢' }] },
  { id: 'n8', source: 'Reuters',     time: '8h ago',     cat: 'Markets',  sent: 'neu', impact: 'low',  headline: 'NVDA Q2 earnings consensus moves higher on AI capex revisions', summary: 'Analyst consensus moved to $0.84 EPS from $0.78, reflecting upward revisions to enterprise GPU forecasts.', markets: [{ name: 'NVDA Q2 earnings beat', side: 'YES', delta: '+3¢' }] },
  { id: 'n9', source: 'Bloomberg',   time: '12h ago',    cat: 'Finance',  sent: 'neg', impact: 'med',  headline: 'Tesla Q2 deliveries tracker shows softening in EU and APAC', summary: 'Composite of registration data across 14 European markets points to a 7% YoY decline; APAC similarly weak.', markets: [{ name: 'Tesla deliveries above 480k', side: 'NO', delta: '+6¢' }] },
];

const NW_CATS = ['All', 'Politics', 'Markets', 'Crypto', 'Sports', 'Tech', 'Finance'];

function NwImpactPill({ level }) {
  const m = { high: { tone: 'is-loss', label: 'High impact' }, med: { tone: 'is-warn', label: 'Medium' }, low: { tone: '', label: 'Low' } };
  const v = m[level];
  return <span className={`adm-pill ${v.tone}`} style={{ fontSize: 10 }}>{v.label}</span>;
}

function NwSentDot({ sent }) {
  const map = { pos: { c: 'var(--gain)', label: 'Bullish sentiment' }, neg: { c: 'var(--loss)', label: 'Bearish sentiment' }, neu: { c: 'var(--text-tertiary)', label: 'Neutral sentiment' } };
  const v = map[sent];
  return <span title={v.label} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: v.c, flexShrink: 0 }} />;
}

function NwArticleCard({ a, featured }) {
  return (
    <article className="adm-card" style={{ padding: featured ? 24 : 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
        <NwSentDot sent={a.sent} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.source}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{a.time}</span>
        <span className="adm-pill" style={{ fontSize: 10, marginLeft: 'auto' }}>{a.cat}</span>
        <NwImpactPill level={a.impact} />
      </div>

      <a href="App-News-Article.html" style={{ textDecoration: 'none' }}>
        <h3 style={{
          fontSize: featured ? 22 : 15,
          lineHeight: 1.3,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: featured ? '-0.018em' : '-0.011em',
        }}>{a.headline}</h3>
      </a>
      <p style={{ fontSize: featured ? 14 : 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>{a.summary}</p>

      {/* Related markets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Related markets</div>
        {a.markets.map((m, i) => (
          <a key={i} href="App-Market-Detail.html" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            background: 'var(--bg-canvas)', borderRadius: 6, textDecoration: 'none',
            border: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            {m.side !== '—' && <span className={`adm-pill ${m.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{m.side}</span>}
            <span className="mono" style={{
              fontSize: 11, fontWeight: 600,
              color: m.delta === 'NEW' ? 'var(--accent-text)' : m.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)',
            }}>{m.delta}</span>
          </a>
        ))}
      </div>
    </article>
  );
}

function App() {
  const [cat, setCat] = React.useState('All');
  const visible = cat === 'All' ? NW_ARTICLES : NW_ARTICLES.filter(a => a.cat === cat);
  const [featured, ...rest] = visible;

  return (
    <UsrShell active="news" title="News" crumbs={[{ label: 'News' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Alerts</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="rss" size={12} />Subscribe</button>
      </>
    }>
      <AdmPageHead
        title="News"
        sub="Curated headlines with on-chain market impact · Polymarket data · sentiment scoring updates every 60s"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Articles · 24h" value="142" delta="+18 · vs avg" deltaKind="gain" />
        <AdmStat label="High-impact" value="12" delta="3 active markets" deltaKind="warn" />
        <AdmStat label="Avg sentiment" value="+0.18" delta="Bullish leaning" deltaKind="gain" />
        <AdmStat label="Markets moved" value="38" delta="≥3¢ in 1h" deltaKind="neutral" />
      </div>

      {/* Filters */}
      <div className="adm-table-tools" style={{ marginBottom: 16 }}>
        <div className="adm-search" style={{ width: 280 }}>
          <AdmIcon name="search" size={12} />
          <input placeholder="Search headlines, sources, markets" />
        </div>
        <div className="adm-filter-group">
          {NW_CATS.map(c => (
            <button key={c} className={`adm-filter${cat === c ? ' is-active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <select className="adm-select" defaultValue="any">
            <option value="any">All impact</option>
            <option value="high">High</option>
            <option value="med">Medium</option>
          </select>
          <select className="adm-select" defaultValue="recent">
            <option value="recent">Most recent</option>
            <option value="impact">By market impact</option>
            <option value="sentiment">By sentiment</option>
          </select>
        </div>
      </div>

      {/* Featured + grid */}
      {featured && (
        <div style={{ marginBottom: 16 }}>
          <NwArticleCard a={featured} featured />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
        {rest.map(a => <NwArticleCard key={a.id} a={a} />)}
      </div>

      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
        Showing {visible.length} of {NW_ARTICLES.length} · <a href="#" style={{ color: 'var(--accent-text)' }}>Load more</a>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);