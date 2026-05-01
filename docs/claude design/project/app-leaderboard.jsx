/* Polyforge — Leaderboard
   Public ranking of traders by P&L, win rate, edge score. */

const LB_TRADERS = [
  { rank: 1,  user: 'unholyfist.eth',  display: 'Unholy Fist',     avatar: 'UF', pnl: 48210,  pnlPct: 142.4, winRate: 78, trades: 142, sharpe: 2.4, edge: 92, copiers: 1284, change: 0 },
  { rank: 2,  user: '0xtidemark',      display: '0xTidemark',      avatar: 'TM', pnl: 32840,  pnlPct: 98.2,  winRate: 74, trades: 96,  sharpe: 2.1, edge: 88, copiers: 842,  change: 1 },
  { rank: 3,  user: 'cassandra.x',     display: 'Cassandra',       avatar: 'CX', pnl: 28400,  pnlPct: 84.6,  winRate: 71, trades: 186, sharpe: 1.9, edge: 84, copiers: 2104, change: -1 },
  { rank: 4,  user: 'plinkochamp.eth', display: 'Plinko Champ',    avatar: 'PC', pnl: 18920,  pnlPct: 67.4,  winRate: 69, trades: 84,  sharpe: 1.8, edge: 78, copiers: 612,  change: 2 },
  { rank: 5,  user: 'parlaymoney',     display: 'Parlay Money',    avatar: 'PM', pnl: 12640,  pnlPct: 42.0,  winRate: 64, trades: 320, sharpe: 1.4, edge: 72, copiers: 384,  change: 0 },
  { rank: 6,  user: 'bigbrain.poly',   display: 'Bigbrain',        avatar: 'BB', pnl: 9420,   pnlPct: 38.4,  winRate: 62, trades: 248, sharpe: 1.2, edge: 68, copiers: 218,  change: 3 },
  { rank: 7,  user: 'oracleseer',      display: 'Oracle Seer',     avatar: 'OS', pnl: 6280,   pnlPct: 28.4,  winRate: 58, trades: 84,  sharpe: 1.1, edge: 64, copiers: 162,  change: -2 },
  { rank: 8,  user: 'futuresfeline',   display: 'Futures Feline',  avatar: 'FF', pnl: 4120,   pnlPct: 22.0,  winRate: 56, trades: 142, sharpe: 0.9, edge: 61, copiers: 98,   change: 0 },
  { rank: 9,  user: 'tickerwhisp',     display: 'TickerWhisp',     avatar: 'TW', pnl: 2840,   pnlPct: 18.4,  winRate: 54, trades: 76,  sharpe: 0.8, edge: 58, copiers: 64,   change: 4 },
  { rank: 10, user: 'edgeluminary',    display: 'EdgeLuminary',    avatar: 'EL', pnl: 1840,   pnlPct: 14.2,  winRate: 53, trades: 124, sharpe: 0.7, edge: 56, copiers: 48,   change: -1 },
];

const LB_PERIODS = ['24h', '7d', '30d', '90d', 'All time'];
const LB_METRICS = [
  { id: 'pnl', label: 'P&L' },
  { id: 'pnlPct', label: 'P&L %' },
  { id: 'winRate', label: 'Win rate' },
  { id: 'edge', label: 'Edge score' },
  { id: 'sharpe', label: 'Sharpe' },
];

function LbChange({ change }) {
  if (change === 0) return <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>—</span>;
  const up = change > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11,
      color: up ? 'var(--gain-text)' : 'var(--loss-text)',
      fontFamily: 'Geist Mono, monospace', fontWeight: 600,
    }}>
      {up ? '▲' : '▼'} {Math.abs(change)}
    </span>
  );
}

function LbPodium({ traders }) {
  const podium = [traders[1], traders[0], traders[2]];
  const heights = [120, 160, 96];
  const colors = ['#9ca3af', '#fbbf24', '#cd7f32'];
  return (
    <div className="adm-card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 20, paddingTop: 20 }}>
        {podium.map((t, i) => (
          <a key={t.user} href="App-Public-Profile.html" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textDecoration: 'none', flex: '0 0 180px' }}>
            <div className="usr-whale-avatar" style={{ width: 56, height: 56, fontSize: 16, border: `3px solid ${colors[i]}`, boxSizing: 'content-box' }}>{t.avatar}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t.display}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>@{t.user}</div>
            </div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--gain-text)' }}>+${t.pnl.toLocaleString()}</div>
            <div style={{
              width: '100%', height: heights[i], background: `linear-gradient(180deg, ${colors[i]}30 0%, ${colors[i]}08 100%)`,
              borderTop: `2px solid ${colors[i]}`, borderRadius: '6px 6px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, color: colors[i], fontFamily: 'Geist Mono, monospace',
            }}>{podium[i].rank}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [period, setPeriod] = React.useState('30d');
  const [metric, setMetric] = React.useState('pnl');
  return (
    <UsrShell active="leaderboard" title="Leaderboard" crumbs={[{ label: 'Leaderboard' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Watch top traders</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="share" size={12} />Share</button>
      </>
    }>
      <AdmPageHead
        title="Leaderboard"
        sub="Top performers ranked by edge score · all stats verified on-chain · updates every 60s"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Eligible traders" value="1,284" delta="+38 · 7d" deltaKind="gain" />
        <AdmStat label="Combined P&L · 30d" value="$8.4M" delta="+12.4% · vs prior" deltaKind="gain" />
        <AdmStat label="Top edge · 30d" value="92" delta="@unholyfist.eth" deltaKind="gain" />
        <AdmStat label="Median win rate" value="58%" delta="among top 100" deltaKind="neutral" />
      </div>

      <LbPodium traders={LB_TRADERS} />

      {/* Filters */}
      <div className="adm-table-tools" style={{ marginBottom: 16 }}>
        <div className="adm-filter-group">
          {LB_PERIODS.map(p => (
            <button key={p} className={`adm-filter${period === p ? ' is-active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <select className="adm-select" value={metric} onChange={e => setMetric(e.target.value)}>
            {LB_METRICS.map(m => <option key={m.id} value={m.id}>Sort by {m.label}</option>)}
          </select>
          <select className="adm-select" defaultValue="all">
            <option value="all">All categories</option>
            <option value="politics">Politics</option>
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
          </select>
        </div>
      </div>

      <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th style={{ width: 32 }}></th>
              <th>Trader</th>
              <th style={{ textAlign: 'right' }}>P&L · {period}</th>
              <th style={{ textAlign: 'right' }}>%</th>
              <th style={{ textAlign: 'right' }}>Win rate</th>
              <th style={{ textAlign: 'right' }}>Trades</th>
              <th style={{ textAlign: 'right' }}>Sharpe</th>
              <th style={{ textAlign: 'right' }}>Edge</th>
              <th style={{ textAlign: 'right' }}>Copiers</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {LB_TRADERS.map(t => (
              <tr key={t.user}>
                <td className="mono" style={{ fontWeight: 600, color: t.rank <= 3 ? 'var(--accent-text)' : 'var(--text-primary)' }}>{t.rank}</td>
                <td><LbChange change={t.change} /></td>
                <td>
                  <a href="App-Public-Profile.html" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <div className="usr-whale-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{t.avatar}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{t.display}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>@{t.user}</div>
                    </div>
                  </a>
                </td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--gain-text)', fontWeight: 600 }}>+${t.pnl.toLocaleString()}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--gain-text)' }}>+{t.pnlPct}%</td>
                <td className="mono" style={{ textAlign: 'right' }}>{t.winRate}%</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{t.trades}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{t.sharpe}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--accent-text)', fontWeight: 600 }}>{t.edge}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{t.copiers.toLocaleString()}</td>
                <td><a href="App-Copy-Setup.html" className="adm-btn adm-btn-sm adm-btn-secondary">Copy</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);