/* Polyforge — Positions */

const POS = [
  { mk: 'FED-CUT-JUL',   side: 'YES', sz: 1820, avgPx: 71, mark: 73, val: '$1,328.60', pnl: '+$36.40', pnlPct: '+2.8%',  kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
  { mk: 'CPI-MAR-COOL',  side: 'YES', sz: 1420, avgPx: 54, mark: 58, val: '$823.60',   pnl: '+$56.80', pnlPct: '+7.4%',  kind: 'gain', strat: 'cpi-cool-fade', venue: 'kalshi' },
  { mk: 'ELEC28-DEM',    side: 'NO',  sz: 940,  avgPx: 60, mark: 58, val: '$545.20',   pnl: '+$18.80', pnlPct: '+3.5%',  kind: 'gain', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { mk: 'NFL-SB-CHIEFS', side: 'YES', sz: 600,  avgPx: 32, mark: 34, val: '$204.00',   pnl: '+$12.00', pnlPct: '+6.3%',  kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
  { mk: 'TARIFF-CHN-25', side: 'YES', sz: 480,  avgPx: 56, mark: 58, val: '$278.40',   pnl: '+$9.60',  pnlPct: '+3.6%',  kind: 'gain', strat: 'tariff-shock-hedger', venue: 'kalshi' },
  { mk: 'OSCARS-OPP',    side: 'NO',  sz: 280,  avgPx: 84, mark: 82, val: '$229.60',   pnl: '−$5.60',  pnlPct: '−2.4%',  kind: 'loss', strat: 'oscars-favorite-hedge', venue: 'polymarket' },
  { mk: 'BTC-150K-DEC',  side: 'NO',  sz: 540,  avgPx: 70, mark: 69, val: '$372.60',   pnl: '−$5.40',  pnlPct: '−1.4%',  kind: 'loss', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { mk: 'NVDA-EARN-Q1',  side: 'YES', sz: 320,  avgPx: 78, mark: 81, val: '$259.20',   pnl: '+$9.60',  pnlPct: '+3.8%',  kind: 'gain', strat: 'orderbook-imbalance', venue: 'kalshi' },
];

function App() {
  return (
    <UsrShell active="positions" title="Positions" actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
    }>
      <AdmPageHead
        title="Positions"
        subtitle="11 open positions · $4,041 deployed · unrealized +$132.20"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Open positions" value="11" delta="6 markets · 5 strategies" deltaKind="neutral" />
        <AdmStat label="Capital deployed" value="$4,041" delta="65.5% of $6,170" deltaKind="neutral" />
        <AdmStat label="Unrealized P&L" value="+$132.20" delta="+3.4%" deltaKind="gain" />
        <AdmStat label="Largest position" value="$1,329" delta="32.9% concentration" deltaKind="warn" />
      </div>

      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        {/* Allocation by strategy */}
        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Allocation by strategy</h3>
          {[
            { name: 'fed-rate-cut-tracker',     val: 1532.60, pct: 37.9, color: 'var(--accent-default)' },
            { name: 'cpi-cool-fade',            val: 823.60,  pct: 20.4, color: '#a78bfa' },
            { name: 'whale-mirror-politics',    val: 917.80,  pct: 22.7, color: 'var(--gain)' },
            { name: 'orderbook-imbalance',      val: 259.20,  pct: 6.4,  color: 'var(--warn)' },
            { name: 'tariff-shock-hedger',      val: 278.40,  pct: 6.9,  color: '#06b6d4' },
            { name: 'oscars-favorite-hedge',    val: 229.60,  pct: 5.7,  color: 'var(--loss)' },
          ].map(s => (
            <div key={s.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, fontSize: 11.5 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>{s.name}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)' }}>${s.val.toFixed(0)} · {s.pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-app)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, opacity: 0.85 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Allocation by venue / category */}
        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Distribution</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>By venue</div>
              {[
                { label: 'Polymarket', pct: 36.3, color: '#4F6EF7' },
                { label: 'Kalshi',     pct: 63.7, color: '#16A34A' },
              ].map(v => (
                <div key={v.label} style={{ marginBottom: 8, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'Geist Mono, monospace' }}>
                    <span>{v.label}</span><span>{v.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-app)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${v.pct}%`, height: '100%', background: v.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>By side</div>
              {[
                { label: 'YES exposure', pct: 73.6, color: 'var(--gain)' },
                { label: 'NO exposure',  pct: 26.4, color: 'var(--loss)' },
              ].map(v => (
                <div key={v.label} style={{ marginBottom: 8, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'Geist Mono, monospace' }}>
                    <span>{v.label}</span><span>{v.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-app)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${v.pct}%`, height: '100%', background: v.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--warn-text)' }}>
              <AdmIcon name="alert" size={13} />
              <span><strong>Concentration warning:</strong> 37.9% in one strategy. Consider diversifying.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Open positions</h3>
          <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
            <button className="adm-filter is-active">All <span className="count">11</span></button>
            <button className="adm-filter">Winners <span className="count">8</span></button>
            <button className="adm-filter">Losers <span className="count">3</span></button>
          </div>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Side</th>
              <th>Size</th>
              <th>Avg px</th>
              <th>Mark</th>
              <th>Value</th>
              <th>Unrealized</th>
              <th>Strategy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {POS.map((p, i) => (
              <tr key={i}>
                <td>
                  <div className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{p.mk}</div>
                  <UsrVenueBadge venue={p.venue} />
                </td>
                <td><span className={`adm-pill ${p.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 18, fontSize: 10 }}>{p.side}</span></td>
                <td className="col-num">{p.sz}</td>
                <td className="col-mono">¢{p.avgPx}</td>
                <td className="col-mono" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>¢{p.mark}</td>
                <td className="col-mono">{p.val}</td>
                <td className="col-num" style={{ color: p.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>
                  {p.pnl}<div style={{ fontSize: 10, fontWeight: 400 }}>{p.pnlPct}</div>
                </td>
                <td className="col-mono col-secondary">{p.strat}</td>
                <td>
                  <button className="row-action" title="Close"><AdmIcon name="x" size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
