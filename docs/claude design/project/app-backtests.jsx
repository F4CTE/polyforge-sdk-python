/* Polyforge — Backtests */

const BT_RUNS = [
  { id: 'bt_x4f2k', strat: 'fed-rate-cut-tracker', range: '2024-01 → 2025-04', ret: '+212.8%', sharpe: '2.42', dd: '−6.4%', trades: 248, status: 'complete', when: '2m ago', winRate: '71%' },
  { id: 'bt_p82nd', strat: 'whale-mirror-politics', range: '2023-06 → 2025-04', ret: '+184.2%', sharpe: '2.04', dd: '−8.8%', trades: 412, status: 'complete', when: '1h ago', winRate: '68%' },
  { id: 'bt_kb4l1', strat: 'orderbook-imbalance',  range: '2024-09 → 2025-04', ret: '+96.4%',  sharpe: '1.84', dd: '−4.2%', trades: 1240, status: 'complete', when: '3h ago', winRate: '64%' },
  { id: 'bt_vm2pc', strat: 'cpi-cool-fade',         range: '2022-01 → 2025-04', ret: '+42.8%',  sharpe: '1.42', dd: '−12.4%', trades: 92,  status: 'running',  when: '4m left · 78% done', winRate: '—' },
  { id: 'bt_ze8nm', strat: 'sports-favorites-fade', range: '2024-01 → 2025-04', ret: '+58.2%',  sharpe: '1.62', dd: '−6.8%', trades: 384, status: 'complete', when: '6h ago', winRate: '67%' },
  { id: 'bt_qwl42', strat: 'oscars-favorite-hedge', range: '2018-01 → 2024-12', ret: '−14.2%',  sharpe: '0.42', dd: '−18.4%', trades: 28,  status: 'complete', when: '1d ago', winRate: '49%' },
];

function App() {
  return (
    <UsrShell active="backtests" title="Backtests" actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="play" size={12} />Run new backtest</button>
    }>
      <AdmPageHead
        title="Backtests"
        subtitle="6 runs · 1 in progress · simulate strategies on 18 months of historical orderflow"
      />

      <div className="adm-grid-3" style={{ marginBottom: 20 }}>
        <AdmStat label="Total runs · 30d" value="42" delta="+12 vs prev" deltaKind="gain" />
        <AdmStat label="Avg simulated return" value="+86.4%" delta="across 6 strategies" deltaKind="neutral" />
        <AdmStat label="Avg Sharpe" value="1.78" delta="median 1.62" deltaKind="neutral" />
      </div>

      <div className="adm-table-wrap" style={{ marginBottom: 20 }}>
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            <button className="adm-filter is-active">All <span className="count">6</span></button>
            <button className="adm-filter">Complete <span className="count">5</span></button>
            <button className="adm-filter">Running <span className="count">1</span></button>
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Filter by strategy..." />
          </div>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Strategy</th>
              <th>Date range</th>
              <th>Return</th>
              <th>Sharpe</th>
              <th>Max DD</th>
              <th>Win</th>
              <th>Trades</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {BT_RUNS.map(r => (
              <tr key={r.id}>
                <td className="col-mono col-id">{r.id}</td>
                <td className="col-mono">{r.strat}</td>
                <td className="col-mono col-secondary">{r.range}</td>
                <td className="col-num" style={{ color: r.ret.startsWith('−') ? 'var(--loss-text)' : 'var(--gain-text)', fontWeight: 600 }}>{r.ret}</td>
                <td className="col-num">{r.sharpe}</td>
                <td className="col-num" style={{ color: 'var(--loss-text)' }}>{r.dd}</td>
                <td className="col-num">{r.winRate}</td>
                <td className="col-num">{r.trades}</td>
                <td>
                  {r.status === 'running'
                    ? <span className="adm-pill is-warn has-dot is-pulse" style={{ height: 18, fontSize: 10 }}>{r.when}</span>
                    : <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.when}</span>}
                </td>
                <td><button className="row-action"><AdmIcon name="arrow-up-right" size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Featured run detail card */}
      <AdmSectionHead title="Latest run · bt_x4f2k" />
      <div className="adm-grid-2">
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Equity curve · backtest vs live</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>fed-rate-cut-tracker</span>
          </div>
          <UsrEquityCurve
            points={Array.from({ length: 90 }, (_, i) => 5000 + i * 24 + Math.sin(i * 0.3) * 80)}
            kind="gain"
            height={200}
            label="+212%"
          />
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
            <span style={{ color: 'var(--gain-text)' }}>● Backtest +212.8%</span>
            <span style={{ color: 'var(--accent-text)' }}>● Live +36.9%</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>tracking +3.1% vs expected</span>
          </div>
        </div>

        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Trade distribution</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {[
              { label: 'Total trades',    val: '248' },
              { label: 'Winners',         val: '177', tint: 'var(--gain-text)' },
              { label: 'Losers',          val: '71',  tint: 'var(--loss-text)' },
              { label: 'Avg winner',      val: '+$184', tint: 'var(--gain-text)' },
              { label: 'Avg loser',       val: '−$54',  tint: 'var(--loss-text)' },
              { label: 'Profit factor',   val: '3.42' },
              { label: 'Avg hold time',   val: '4h 12m' },
              { label: 'Best month',      val: '+34.8%', tint: 'var(--gain-text)' },
              { label: 'Worst month',     val: '−2.1%',  tint: 'var(--loss-text)' },
              { label: 'Sortino',         val: '4.18' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11.5 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{s.label}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', color: s.tint || 'var(--text-primary)', fontWeight: 600 }}>{s.val}</span>
              </div>
            ))}
          </div>
          <button className="adm-btn adm-btn-secondary" style={{ width: '100%', marginTop: 14 }}>
            <AdmIcon name="download" size={12} />Export trade-by-trade CSV
          </button>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
