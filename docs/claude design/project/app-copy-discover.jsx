/* Polyforge — Discover traders to copy
   Leaderboard view with category filter, win-rate filter, edge score, compare mode. */

const CD_TRADERS = [
  { id: 'u1', user: 'unholyfist.eth',  display: 'Unholy Fist',     avatar: 'UF', rank: 1,  edge: 92, pnl: '+$48,210', winRate: 78, trades: 142, copiers: 1284, fee: 8,  sharpe: 2.4, mdd: '-12.4%', cats: ['politics','crypto'], copying: false, spark: [40,46,50,54,58,62,66,70,72,76,80,84,86,90,94,96,100] },
  { id: 'u2', user: '0xtidemark',      display: '0xTidemark',      avatar: 'TM', rank: 2,  edge: 88, pnl: '+$32,840', winRate: 74, trades: 96,  copiers: 842,  fee: 10, sharpe: 2.1, mdd: '-9.8%',  cats: ['crypto','finance'], copying: true, spark: [50,52,54,58,60,62,64,68,70,72,74,76,80,82,84,86,90] },
  { id: 'u3', user: 'cassandra.x',     display: 'Cassandra',       avatar: 'CX', rank: 3,  edge: 84, pnl: '+$28,400', winRate: 71, trades: 186, copiers: 2104, fee: 12, sharpe: 1.9, mdd: '-14.2%', cats: ['entertainment','politics','sports'], copying: true, spark: [60,58,62,64,66,68,70,68,72,74,76,78,80,82,84,86,88] },
  { id: 'u4', user: 'plinkochamp.eth', display: 'Plinko Champ',    avatar: 'PC', rank: 4,  edge: 78, pnl: '+$18,920', winRate: 69, trades: 84,  copiers: 612,  fee: 7,  sharpe: 1.8, mdd: '-11.0%', cats: ['sports','finance'], copying: false, spark: [55,56,58,60,58,62,60,64,66,68,66,70,72,74,72,76,80] },
  { id: 'u5', user: 'parlaymoney',     display: 'Parlay Money',    avatar: 'PM', rank: 5,  edge: 72, pnl: '+$12,640', winRate: 64, trades: 320, copiers: 384,  fee: 5,  sharpe: 1.4, mdd: '-18.4%', cats: ['sports'], copying: false, spark: [60,58,62,60,64,62,66,64,68,66,70,68,72,70,74,72,78] },
  { id: 'u6', user: 'bigbrain.poly',   display: 'Bigbrain',        avatar: 'BB', rank: 6,  edge: 68, pnl: '+$9,420',  winRate: 62, trades: 248, copiers: 218,  fee: 6,  sharpe: 1.2, mdd: '-22.1%', cats: ['crypto','tech'], copying: false, spark: [58,60,62,64,62,66,64,68,66,70,68,72,70,74,72,76,80] },
  { id: 'u7', user: 'oracleseer',      display: 'Oracle Seer',     avatar: 'OS', rank: 7,  edge: 64, pnl: '+$6,280',  winRate: 58, trades: 84,  copiers: 162,  fee: 9,  sharpe: 1.1, mdd: '-15.8%', cats: ['politics','science'], copying: false, spark: [62,60,64,62,66,64,68,66,70,68,72,70,74,72,76,74,78] },
  { id: 'u8', user: 'futuresfeline',   display: 'Futures Feline',  avatar: 'FF', rank: 8,  edge: 61, pnl: '+$4,120',  winRate: 56, trades: 142, copiers: 98,   fee: 4,  sharpe: 0.9, mdd: '-19.2%', cats: ['crypto','finance'], copying: false, spark: [55,57,59,57,61,59,63,61,65,63,67,69,67,71,73,75,77] },
  { id: 'u9', user: 'tickerwhisp',     display: 'TickerWhisp',     avatar: 'TW', rank: 9,  edge: 58, pnl: '+$2,840',  winRate: 54, trades: 76,  copiers: 64,   fee: 8,  sharpe: 0.8, mdd: '-16.4%', cats: ['weather','sports'], copying: false, spark: [50,52,54,52,56,54,58,56,60,58,62,60,64,62,66,64,68] },
];

const CD_CATEGORIES = ['All', 'Politics', 'Sports', 'Crypto', 'Finance', 'Entertainment', 'Tech', 'Science', 'Weather'];

function CdEdgeScore({ score }) {
  const tone = score >= 80 ? 'gain' : score >= 60 ? 'accent' : 'warn';
  const color = tone === 'gain' ? 'var(--gain-text)' : tone === 'accent' ? 'var(--accent-text)' : 'var(--warning, #f59e0b)';
  return (
    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>{score}</span>
  );
}

function CdRankBadge({ rank }) {
  if (rank === 1) return <span className="adm-pill is-warn" style={{ fontWeight: 600 }}>🏆 #1</span>;
  if (rank <= 3) return <span className="adm-pill" style={{ fontWeight: 600 }}>#{rank}</span>;
  return <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)' }}>#{rank}</span>;
}

function CdSparkline({ data, w = 80, h = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={isUp ? 'var(--gain)' : 'var(--loss)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CdTraderCard({ t, selected, onToggle, compareMode }) {
  return (
    <div
      className={`adm-card${selected ? ' is-selected' : ''}`}
      style={{
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        cursor: compareMode ? 'pointer' : 'default',
        borderColor: selected ? 'var(--accent-border)' : undefined,
        background: selected ? 'var(--accent-subtle)' : undefined,
      }}
      onClick={compareMode ? () => onToggle(t.id) : undefined}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {compareMode && (
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: '1.5px solid',
            borderColor: selected ? 'var(--accent-default)' : 'var(--border-default)',
            background: selected ? 'var(--accent-default)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {selected && <AdmIcon name="check" size={11} className="" />}
          </div>
        )}
        <div className="usr-whale-avatar" style={{ width: 36, height: 36 }}>{t.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>{t.display}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>@{t.user}</div>
        </div>
        <CdRankBadge rank={t.rank} />
      </div>

      {/* Edge score row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edge score</div>
          <CdEdgeScore score={t.edge} />
        </div>
        <CdSparkline data={t.spark} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 11 }}>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>P&L</div>
          <div className="mono" style={{ color: 'var(--gain-text)', fontWeight: 500 }}>{t.pnl}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Win rate</div>
          <div className="mono" style={{ color: 'var(--text-primary)' }}>{t.winRate}%</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Trades</div>
          <div className="mono" style={{ color: 'var(--text-primary)' }}>{t.trades}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Sharpe</div>
          <div className="mono" style={{ color: 'var(--text-primary)' }}>{t.sharpe}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Max DD</div>
          <div className="mono" style={{ color: 'var(--loss-text)' }}>{t.mdd}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>Copiers</div>
          <div className="mono" style={{ color: 'var(--text-primary)' }}>{t.copiers.toLocaleString()}</div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {t.cats.slice(0, 3).map(c => (
          <span key={c} className="adm-pill" style={{ fontSize: 9.5, height: 18 }}>{c}</span>
        ))}
      </div>

      {/* Actions */}
      {!compareMode && (
        <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <a href="App-Public-Profile.html" className="adm-btn adm-btn-sm adm-btn-secondary" style={{ flex: 1 }}>View profile</a>
          {t.copying ? (
            <span className="adm-btn adm-btn-sm" style={{ flex: 1, justifyContent: 'center', background: 'var(--gain-subtle)', color: 'var(--gain-text)', border: '1px solid color-mix(in srgb, var(--gain) 30%, transparent)' }}>
              <AdmIcon name="check" size={11} />Copying
            </span>
          ) : (
            <a href="App-Copy-Setup.html" className="adm-btn adm-btn-sm adm-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <AdmIcon name="copy" size={11} />Copy
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [compareMode, setCompareMode] = React.useState(false);
  const [selected, setSelected] = React.useState([]);
  const [cat, setCat] = React.useState('All');

  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : (s.length >= 3 ? s : [...s, id]));
  }

  const visible = cat === 'All' ? CD_TRADERS : CD_TRADERS.filter(t => t.cats.includes(cat.toLowerCase()));

  return (
    <UsrShell active="copy-discover" title="Discover traders" crumbs={[{label: 'Copy trading', href: 'App-Copy.html'}, {label: 'Discover'}]} actions={
      compareMode ? (
        <>
          <button className="adm-btn adm-btn-secondary" onClick={() => { setCompareMode(false); setSelected([]); }}>
            <AdmIcon name="x" size={12} />Exit compare
          </button>
          <button className="adm-btn adm-btn-primary" disabled={selected.length < 2}>
            <AdmIcon name="compare" size={12} />Compare {selected.length}
          </button>
        </>
      ) : (
        <button className="adm-btn adm-btn-secondary" onClick={() => setCompareMode(true)}>
          <AdmIcon name="compare" size={12} />Compare traders
        </button>
      )
    }>
      <AdmPageHead
        title="Discover traders"
        sub="Top performers across all categories · ranked by 30d edge score · all stats verified on-chain"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Eligible traders" value="248" delta="+18 · 7d" deltaKind="gain" />
        <AdmStat label="Total being copied" value="$8.4M" delta="+$1.2M · 7d" deltaKind="gain" />
        <AdmStat label="Top edge · 30d" value="92" delta="@unholyfist.eth" deltaKind="gain" />
        <AdmStat label="Avg copy fee" value="7.6%" delta="of profit" deltaKind="neutral" />
      </div>

      {compareMode && selected.length > 0 && (
        <div className="adm-card" style={{ padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)' }}>
          <AdmIcon name="compare" size={14} className="adm-icon-accent" />
          <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
            {selected.length} of 3 selected
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
            {selected.length < 2 ? 'Pick at least 2 traders to compare side by side.' : 'Press Compare to see them side by side.'}
          </span>
          <button className="adm-btn adm-btn-sm adm-btn-secondary" onClick={() => setSelected([])} style={{ marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="adm-table-tools" style={{ marginBottom: 16 }}>
        <div className="adm-search" style={{ width: 280 }}>
          <AdmIcon name="search" size={12} />
          <input placeholder="Search by username or address" />
        </div>
        <div className="adm-filter-group">
          {CD_CATEGORIES.map(c => (
            <button key={c} className={`adm-filter${cat === c ? ' is-active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <select className="adm-select" defaultValue="60">
            <option value="any">Win rate · any</option>
            <option value="50">≥ 50%</option>
            <option value="60">≥ 60%</option>
            <option value="70">≥ 70%</option>
            <option value="80">≥ 80%</option>
          </select>
          <select className="adm-select" defaultValue="25">
            <option value="any">Min trades · any</option>
            <option value="10">≥ 10</option>
            <option value="25">≥ 25</option>
            <option value="50">≥ 50</option>
            <option value="100">≥ 100</option>
          </select>
        </div>
      </div>

      {/* Trader grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
        {visible.map(t => (
          <CdTraderCard
            key={t.id}
            t={t}
            selected={selected.includes(t.id)}
            onToggle={toggle}
            compareMode={compareMode}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
        Showing {visible.length} of {CD_TRADERS.length} traders · <a href="#" style={{ color: 'var(--accent-text)' }}>Load more</a>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);