/* Polyforge — Social feed
   Posts from traders you follow + trending: text, trade-shares, market-shares. */

const FD_POSTS = [
  { id: 'p1', user: 'unholyfist.eth', display: 'Unholy Fist', avatar: 'UF', time: '12m', verified: true,
    text: "Loaded YES on the Fed-cut market. Powell's Friday speech tone was a clear pivot — they're prepping rate-relief language for the June meeting.",
    trade: { market: 'Will Fed cut rates in June 2026?', side: 'YES', price: '64¢', size: '$24,800' },
    likes: 142, replies: 28, reposts: 18, copies: 8 },
  { id: 'p2', user: 'cassandra.x', display: 'Cassandra', avatar: 'CX', time: '38m', verified: true,
    text: 'Cleaning up after a brutal week. -7% on the portfolio but the playbook held — losses were small, gains were large. The hardest part of this game is letting winners run.',
    likes: 412, replies: 64, reposts: 38, copies: 0 },
  { id: 'p3', user: '0xtidemark', display: '0xTidemark', avatar: 'TM', time: '1h', verified: true,
    text: 'Market alert: Ethereum ETF approval probability moved from 60→71 in the last 24h. The Bloomberg report is the catalyst but on-chain accumulation has been telegraphing this for a week.',
    market: { name: 'Ethereum ETF approval Q3', price: '71¢ YES', delta: '+11¢ · 1h' },
    likes: 286, replies: 42, reposts: 124, copies: 0 },
  { id: 'p4', user: 'plinkochamp.eth', display: 'Plinko Champ', avatar: 'PC', time: '2h', verified: false,
    text: 'Sports edge of the day: Lakers playoff market mispriced. Two starters out, week-to-week, and the line moved less than 8¢. NO is the trade.',
    trade: { market: 'Lakers make NBA playoffs', side: 'NO', price: '32¢', size: '$8,400' },
    likes: 86, replies: 14, reposts: 6, copies: 4 },
  { id: 'p5', user: 'oracleseer', display: 'Oracle Seer', avatar: 'OS', time: '4h', verified: false,
    text: 'Updated my SCOTUS-decision strategy. The base-rate analysis I shared last week now has new data: argument-day-to-decision lead time is averaging 87 days this term, not 96. Thread incoming.',
    likes: 184, replies: 22, reposts: 28, copies: 0 },
  { id: 'p6', user: 'parlaymoney', display: 'Parlay Money', avatar: 'PM', time: '6h', verified: false,
    text: "Anyone else's copy-trading config getting hammered by the slippage on small markets right now? Considering tightening to ±1¢.",
    likes: 24, replies: 32, reposts: 2, copies: 0 },
];

function FdActionBtn({ icon, count, label, accent }) {
  return (
    <button className="adm-btn adm-btn-sm adm-btn-ghost" style={{
      padding: '4px 8px',
      color: accent ? 'var(--accent-text)' : 'var(--text-tertiary)',
      fontSize: 11.5,
    }}>
      <AdmIcon name={icon} size={12} />
      {count > 0 && <span>{count}</span>}
      <span style={{ display: 'none' }}>{label}</span>
    </button>
  );
}

function FdPost({ p }) {
  return (
    <article className="adm-card" style={{ padding: 16, display: 'flex', gap: 12 }}>
      <div className="usr-whale-avatar" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>{p.avatar}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.display}</span>
          {p.verified && <AdmIcon name="check" size={11} className="adm-icon-accent" />}
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{p.user}</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.time}</span>
          <button className="adm-icon-btn" style={{ marginLeft: 'auto' }} aria-label="More">
            <AdmIcon name="more" size={13} />
          </button>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-primary)', margin: '0 0 12px', textWrap: 'pretty' }}>{p.text}</p>

        {p.trade && (
          <a href="App-Market-Detail.html" style={{
            display: 'block', padding: 12, marginBottom: 12,
            background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <AdmIcon name="zap" size={11} className="adm-icon-accent" />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shared trade</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{p.trade.market}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11.5 }}>
              <span className={`adm-pill ${p.trade.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{p.trade.side}</span>
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.trade.price}</span>
              <span className="mono" style={{ color: 'var(--text-tertiary)' }}>{p.trade.size}</span>
            </div>
          </a>
        )}

        {p.market && (
          <a href="App-Market-Detail.html" style={{
            display: 'block', padding: 12, marginBottom: 12,
            background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, textDecoration: 'none',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{p.market.name}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.market.price}</span>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: p.market.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{p.market.delta}</span>
            </div>
          </a>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FdActionBtn icon="comment" count={p.replies} label="Reply" />
          <FdActionBtn icon="repeat" count={p.reposts} label="Repost" />
          <FdActionBtn icon="heart" count={p.likes} label="Like" />
          {p.copies > 0 && <FdActionBtn icon="copy" count={p.copies} label="Copy" accent />}
          <button className="adm-btn adm-btn-sm adm-btn-ghost adm-btn-icon" style={{ marginLeft: 'auto' }} aria-label="Bookmark">
            <AdmIcon name="bookmark" size={11} />
          </button>
        </div>
      </div>
    </article>
  );
}

function App() {
  const [tab, setTab] = React.useState('following');
  const [draft, setDraft] = React.useState('');
  return (
    <UsrShell active="feed" title="Feed" crumbs={[{ label: 'Feed' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Feed settings</button>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'flex-start', maxWidth: 1280, marginInline: 'auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-default)' }}>
            {[
              { id: 'following', label: 'Following' },
              { id: 'trending', label: 'Trending' },
              { id: 'mentions', label: 'Mentions' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`} style={{
                padding: '10px 16px',
                fontSize: 13,
                borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent',
                marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Composer */}
          <div className="adm-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10 }}>
            <div className="usr-whale-avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>YO</div>
            <div style={{ flex: 1 }}>
              <textarea
                value={draft} onChange={e => setDraft(e.target.value)}
                placeholder="Share a take, a trade, or a market…"
                style={{
                  width: '100%', minHeight: 60, resize: 'vertical', padding: 8,
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="zap" size={11} />Attach trade</button>
                <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="link" size={11} />Attach market</button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{draft.length} / 280</span>
                <button className="adm-btn adm-btn-sm adm-btn-primary" disabled={!draft.trim()}>Post</button>
              </div>
            </div>
          </div>

          {/* Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FD_POSTS.map(p => <FdPost key={p.id} p={p} />)}
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 55 }}>
          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Trending markets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { name: 'Will Fed cut rates in June 2026?', delta: '+4¢ · 1h', side: 'YES' },
                { name: 'Ethereum ETF approval Q3', delta: '+11¢ · 1h', side: 'YES' },
                { name: 'Trump vs Vance — GOP nominee', delta: '-3¢ · 1h', side: 'NO' },
                { name: 'NVDA Q2 earnings beat', delta: '+3¢ · 1h', side: 'YES' },
              ].map((m, i) => (
                <a key={i} href="App-Market-Detail.html" style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{m.name}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`adm-pill ${m.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 9.5, height: 16, minWidth: 32, justifyContent: 'center' }}>{m.side}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: m.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>{m.delta}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Who to follow</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Top traders ranked by 30d edge</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { display: 'Unholy Fist', user: 'unholyfist.eth', avatar: 'UF', edge: 92 },
                { display: '0xTidemark', user: '0xtidemark', avatar: 'TM', edge: 88 },
                { display: 'Cassandra', user: 'cassandra.x', avatar: 'CX', edge: 84 },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="usr-whale-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{u.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{u.display}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Edge {u.edge}</div>
                  </div>
                  <button className="adm-btn adm-btn-sm adm-btn-secondary">Follow</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);