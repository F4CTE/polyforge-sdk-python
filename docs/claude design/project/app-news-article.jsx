/* Polyforge — Single news article
   Read view: long-form article + market-impact panel + related stories. */

const NA_ART = {
  source: 'Bloomberg',
  cat: 'Crypto',
  time: '34 min ago',
  date: 'May 1, 2026 · 14:08 UTC',
  author: 'Sarah Lin',
  authorRole: 'Senior Markets Reporter',
  sent: 'pos',
  impact: 'high',
  headline: 'Ethereum ETF spot approval said to clear final SEC hurdle',
  deck: 'Three sources familiar with the matter say staff recommendation has moved to the Chair for sign-off, with a public announcement expected within ten business days.',
  body: [
    'The Securities and Exchange Commission staff has moved its formal recommendation on the spot Ethereum ETF to the Chair\'s office, according to three people familiar with the deliberations, marking the final procedural step before a public approval announcement.',
    'The recommendation arrived at the Chair on Wednesday, the people said, requesting anonymity to discuss non-public process. A vote and announcement is expected within ten business days, though timing remains subject to Commissioner schedules.',
    'The development would mark the most significant expansion of digital-asset access via traditional finance since the spot Bitcoin ETFs cleared the same path eighteen months ago. Cumulative inflows into spot crypto products would, by some estimates, double within twelve months of an Ethereum approval.',
    'A Commission spokesperson declined to comment. Representatives for the major proposed issuers — including BlackRock, Fidelity, and Grayscale — did not respond to requests for comment outside business hours.',
    'Market participants on Polymarket priced the probability of approval before September 30 at 71% earlier today, up from 60% a week ago. The market has seen $4.2M in volume over the trailing 7 days, with a notable cluster of $50K+ block trades on the YES side overnight.',
    'Internally, the staff recommendation reportedly addresses the surveillance-sharing arrangements with major spot ETH venues — historically the Commission\'s primary friction point — by leaning on the same CME-based reference framework used for the Bitcoin product. Whether the Chair concurs with the staff position is the open question.',
  ],
  markets: [
    { name: 'Ethereum ETF approval Q3', price: '71¢ YES', delta: '+11¢ · 1h', volume: '$4.2M · 7d', side: 'YES' },
    { name: 'ETH above $4,000 by July', price: '54¢ YES', delta: '+6¢ · 1h', volume: '$1.8M · 7d', side: 'YES' },
    { name: 'BTC dominance above 52% in Q3', price: '38¢ YES', delta: '-3¢ · 1h', volume: '$680K · 7d', side: 'NO' },
  ],
  related: [
    { source: 'CoinDesk', time: '3h ago', headline: 'On-chain whales accumulate $42M in long-tenor ETH options' },
    { source: 'WSJ', time: '1d ago', headline: 'Spot ETH ETF: who stands to win and by how much' },
    { source: 'Reuters', time: '2d ago', headline: 'SEC staff signals shift on staking-included crypto products' },
  ],
};

function NaImpactPill({ level }) {
  const m = { high: { tone: 'is-loss', label: 'High market impact' }, med: { tone: 'is-warn', label: 'Medium impact' }, low: { tone: '', label: 'Low' } };
  const v = m[level];
  return <span className={`adm-pill ${v.tone}`}>{v.label}</span>;
}

function App() {
  return (
    <UsrShell active="news-article" title={NA_ART.headline} crumbs={[
      { label: 'News', href: 'App-News.html' },
      { label: NA_ART.cat },
    ]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bookmark" size={12} />Save</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Alert me on follow-ups</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="share" size={12} />Share</button>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'flex-start' }}>
        {/* Article body */}
        <article>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
            <span className="adm-pill" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>{NA_ART.source}</span>
            <span className="adm-pill">{NA_ART.cat}</span>
            <NaImpactPill level={NA_ART.impact} />
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{NA_ART.date}</span>
          </div>

          <h1 style={{
            fontSize: 32, lineHeight: 1.15, fontWeight: 600,
            color: 'var(--text-primary)', margin: '0 0 16px',
            letterSpacing: '-0.025em', maxWidth: 720,
          }}>{NA_ART.headline}</h1>

          <p style={{
            fontSize: 17, lineHeight: 1.55, color: 'var(--text-secondary)',
            margin: '0 0 24px', maxWidth: 720, fontWeight: 400,
          }}>{NA_ART.deck}</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 99, background: 'var(--accent-subtle)',
              color: 'var(--accent-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
            }}>SL</div>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{NA_ART.author}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{NA_ART.authorRole} · {NA_ART.source}</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {NA_ART.body.map((p, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-primary)', margin: 0, textWrap: 'pretty' }}>{p}</p>
            ))}
          </div>

          {/* Related */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-subtle)', maxWidth: 720 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>More on this story</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NA_ART.related.map((r, i) => (
                <a key={i} href="App-News-Article.html" style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 0', borderBottom: i < NA_ART.related.length - 1 ? '1px solid var(--border-subtle)' : 'none', textDecoration: 'none' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, width: 70 }}>{r.time}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>{r.source}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{r.headline}</span>
                  <AdmIcon name="arrow-right" size={11} className="adm-icon-tertiary" />
                </a>
              ))}
            </div>
          </div>
        </article>

        {/* Side panel */}
        <aside style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AdmIcon name="zap" size={14} className="adm-icon-accent" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Markets moved by this story</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              Polyforge's signal engine attributes these market moves to this article based on price-action correlation and on-chain activity within 30 minutes of publication.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NA_ART.markets.map((m, i) => (
                <a key={i} href="App-Market-Detail.html" style={{
                  display: 'block', padding: 10, background: 'var(--bg-canvas)',
                  borderRadius: 8, textDecoration: 'none', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6, lineHeight: 1.3 }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`adm-pill ${m.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{m.side}</span>
                    <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.price}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: m.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.delta}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{m.volume}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Get this in your inbox</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              Daily morning brief: 3–5 high-impact stories with the markets they're moving.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="email" placeholder="you@email.com" className="adm-input" style={{ flex: 1 }} />
              <button className="adm-btn adm-btn-primary">Subscribe</button>
            </div>
          </div>
        </aside>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);