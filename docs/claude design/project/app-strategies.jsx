/* Polyforge — Strategies list (My strategies) */

const STRAT_ROWS = [
  { name: 'fed-rate-cut-tracker',    blocks: 6, mode: 'live',  venue: 'polymarket', status: 'running', pnl30: '+1,847.20', delta: '+18.4%', kind: 'gain', winRate: '74%', fills: 184, capital: '$5,000', updated: '2m ago', author: 'you' },
  { name: 'whale-mirror-politics',   blocks: 4, mode: 'live',  venue: 'polymarket', status: 'running', pnl30: '+612.40',   delta: '+8.1%',  kind: 'gain', winRate: '68%', fills: 86,  capital: '$2,500', updated: '11m ago', author: 'you' },
  { name: 'cpi-cool-fade',           blocks: 5, mode: 'paper', venue: 'kalshi',     status: 'running', pnl30: '+208.10',   delta: '+2.4%',  kind: 'gain', winRate: '62%', fills: 42,  capital: '$1,000', updated: '24m ago', author: 'you' },
  { name: 'oscars-favorite-hedge',   blocks: 7, mode: 'paper', venue: 'polymarket', status: 'paused',  pnl30: '−48.20',    delta: '−1.2%',  kind: 'loss', winRate: '49%', fills: 18,  capital: '$500',   updated: '4h ago', author: 'you' },
  { name: 'sports-favorites-fade',   blocks: 8, mode: 'paper', venue: 'polymarket', status: 'running', pnl30: '+312.80',   delta: '+5.6%',  kind: 'gain', winRate: '71%', fills: 64,  capital: '$1,500', updated: '38m ago', author: 'you' },
  { name: 'orderbook-imbalance',     blocks: 9, mode: 'live',  venue: 'kalshi',     status: 'running', pnl30: '+894.10',   delta: '+12.4%', kind: 'gain', winRate: '69%', fills: 142, capital: '$3,000', updated: '6m ago', author: 'you' },
  { name: 'oracle-disagreement',     blocks: 6, mode: 'paper', venue: 'polymarket', status: 'running', pnl30: '+126.40',   delta: '+3.1%',  kind: 'gain', winRate: '64%', fills: 28,  capital: '$1,000', updated: '52m ago', author: 'you' },
  { name: 'late-day-momentum',       blocks: 5, mode: 'paper', venue: 'polymarket', status: 'paused',  pnl30: '−112.40',   delta: '−4.8%',  kind: 'loss', winRate: '46%', fills: 32,  capital: '$1,000', updated: '1d ago', author: 'you' },
  { name: 'tariff-shock-hedger',     blocks: 7, mode: 'paper', venue: 'kalshi',     status: 'running', pnl30: '+184.60',   delta: '+4.4%',  kind: 'gain', winRate: '67%', fills: 24,  capital: '$1,000', updated: '3h ago', author: 'you' },
  { name: 'ema-cross-bitcoin',       blocks: 4, mode: 'paper', venue: 'polymarket', status: 'draft',   pnl30: '—',         delta: '—',      kind: 'gain', winRate: '—',   fills: 0,   capital: '—',      updated: '8m ago', author: 'you' },
  { name: 'mirror @unholyfist.eth',  blocks: 3, mode: 'live',  venue: 'polymarket', status: 'running', pnl30: '+428.20',   delta: '+10.2%', kind: 'gain', winRate: '72%', fills: 38,  capital: '$2,000', updated: '14m ago', author: 'forked' },
  { name: 'theta-decay-resolver',    blocks: 8, mode: 'paper', venue: 'polymarket', status: 'running', pnl30: '+96.80',    delta: '+2.0%',  kind: 'gain', winRate: '58%', fills: 48,  capital: '$1,000', updated: '46m ago', author: 'you' },
];

function App() {
  const [filter, setFilter] = React.useState('all');
  const counts = {
    all: STRAT_ROWS.length,
    running: STRAT_ROWS.filter(s => s.status === 'running').length,
    paused: STRAT_ROWS.filter(s => s.status === 'paused').length,
    draft: STRAT_ROWS.filter(s => s.status === 'draft').length,
    live: STRAT_ROWS.filter(s => s.mode === 'live').length,
    paper: STRAT_ROWS.filter(s => s.mode === 'paper').length,
  };
  const rows = filter === 'all' ? STRAT_ROWS
    : ['running','paused','draft'].includes(filter) ? STRAT_ROWS.filter(s => s.status === filter)
    : STRAT_ROWS.filter(s => s.mode === filter);

  return (
    <UsrShell active="strategies" title="Strategies" actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="upload" size={12} />Import</button>
        <a className="adm-btn adm-btn-primary" href="App-Builder.html"><AdmIcon name="plus" size={12} />New strategy</a>
      </>
    }>
      <AdmPageHead
        title="Strategies"
        subtitle="12 strategies · 7 running · 4 paper · combined 30d P&L +$4,651"
      />

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            <button className={`adm-filter${filter==='all'?' is-active':''}`} onClick={() => setFilter('all')}>All <span className="count">{counts.all}</span></button>
            <button className={`adm-filter${filter==='running'?' is-active':''}`} onClick={() => setFilter('running')}>Running <span className="count">{counts.running}</span></button>
            <button className={`adm-filter${filter==='paused'?' is-active':''}`} onClick={() => setFilter('paused')}>Paused <span className="count">{counts.paused}</span></button>
            <button className={`adm-filter${filter==='draft'?' is-active':''}`} onClick={() => setFilter('draft')}>Draft <span className="count">{counts.draft}</span></button>
            <span style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
            <button className={`adm-filter${filter==='live'?' is-active':''}`} onClick={() => setFilter('live')}>Live <span className="count">{counts.live}</span></button>
            <button className={`adm-filter${filter==='paper'?' is-active':''}`} onClick={() => setFilter('paper')}>Paper <span className="count">{counts.paper}</span></button>
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Filter by name..." />
          </div>
          <button className="adm-btn adm-btn-ghost adm-btn-sm"><AdmIcon name="filter" size={12} />Filters</button>
        </div>

        <table className="adm-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Status</th>
              <th>Mode</th>
              <th>30d P&L</th>
              <th>Win rate</th>
              <th>Fills</th>
              <th>Capital</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.name}>
                <td>
                  <a href="App-Strategy-Detail.html" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flexShrink: 0 }}>
                      <AdmIcon name="blocks" size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="col-mono" style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{s.blocks} blocks</span>
                        <span>·</span>
                        <UsrVenueBadge venue={s.venue} />
                        {s.author === 'forked' && <span className="adm-pill" style={{ height: 14, fontSize: 9 }}>FORKED</span>}
                      </div>
                    </div>
                  </a>
                </td>
                <td>
                  <span className={`adm-pill has-dot ${s.status === 'running' ? 'is-gain is-pulse' : s.status === 'paused' ? '' : 'is-warn'}`} style={{ height: 18, fontSize: 10 }}>
                    {s.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className={`adm-pill ${s.mode === 'live' ? 'is-gain' : ''}`} style={{ height: 18, fontSize: 10 }}>{s.mode.toUpperCase()}</span>
                </td>
                <td className="col-num" style={{ color: s.pnl30 === '—' ? 'var(--text-tertiary)' : (s.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)'), fontWeight: 600 }}>
                  {s.pnl30 === '—' ? '—' : (s.pnl30.startsWith('−') ? s.pnl30 : `+$${s.pnl30}`)}
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{s.delta}</div>
                </td>
                <td className="col-num">{s.winRate}</td>
                <td className="col-num">{s.fills}</td>
                <td className="col-mono col-secondary">{s.capital}</td>
                <td className="col-tertiary" style={{ fontSize: 11 }}>{s.updated}</td>
                <td><button className="row-action"><AdmIcon name="more" size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span>Showing {rows.length} of {STRAT_ROWS.length} · 30d net <span style={{ color: 'var(--gain-text)' }}>+$4,650.80</span></span>
          <div className="adm-pagination">
            <button disabled>‹</button>
            <button className="is-active">1</button>
            <button disabled>›</button>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
