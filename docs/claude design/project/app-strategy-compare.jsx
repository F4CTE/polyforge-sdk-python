/* Polyforge — Strategy Compare
   Side-by-side comparison of up to 4 strategies. Performance, risk, allocation. */

const SC_STRATEGIES = [
  {
    id: 'whale-shadow', name: 'Whale Shadow',     cat: 'Mirror',
    perf: { '7d': '+4.2%', '30d': '+18.4%', '90d': '+42.1%', '1y': '+128%' },
    metrics: { winRate: '64%', sharpe: '2.1', maxDD: '-8.4%', avgTrade: '$184', trades: '2,847', risk: 'Medium' },
    allocation: { 'FED-CUT': 28, 'NVDA-EARN': 18, 'BTC-150K': 15, 'ETH-ETF': 12, 'TARIFF-CHN': 10, 'Other': 17 },
    color: '#0066ff',
  },
  {
    id: 'fed-day', name: 'FOMC Drift Capture',    cat: 'Macro',
    perf: { '7d': '+2.8%', '30d': '+14.2%', '90d': '+34.6%', '1y': '+98.4%' },
    metrics: { winRate: '71%', sharpe: '2.4', maxDD: '-6.1%', avgTrade: '$220', trades: '184',   risk: 'Low' },
    allocation: { 'FED-CUT-JUL': 42, 'FED-CUT-SEP': 28, 'CPI-MAR': 14, 'JOBS-Q2': 10, 'Other': 6 },
    color: '#10b981',
  },
  {
    id: 'arb-bot', name: 'Cross-Venue Arb',       cat: 'Arbitrage',
    perf: { '7d': '+1.4%', '30d': '+9.6%',  '90d': '+24.8%', '1y': '+74.2%' },
    metrics: { winRate: '92%', sharpe: '3.8', maxDD: '-2.1%', avgTrade: '$48',  trades: '8,420', risk: 'Low' },
    allocation: { 'BTC-150K': 22, 'ETH-ETF': 18, 'NFL-SB': 14, 'OSCARS': 12, 'TRUMP-NOM': 10, 'Other': 24 },
    color: '#a78bfa',
  },
];

function App() {
  const [selected, setSelected] = React.useState(['whale-shadow', 'fed-day', 'arb-bot']);
  const strategies = selected.map(id => SC_STRATEGIES.find(s => s.id === id)).filter(Boolean);

  return (
    <UsrShell active="compare" title="Compare strategies" crumbs={[
      { label: 'Strategies', href: 'App-Strategies.html' },
      { label: 'Compare' },
    ]} actions={
      <button className="adm-btn"><AdmIcon name="plus" size={12} />Add strategy</button>
    }>
      <AdmPageHead
        title="Compare strategies"
        sub="Side-by-side · performance, risk, allocation overlap · pick up to 4"
      />

      {/* Strategy chips */}
      <div className="adm-card" style={{ padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4 }}>Comparing:</span>
        {strategies.map(s => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</span>
            <button onClick={() => setSelected(selected.filter(id => id !== s.id))} className="adm-btn-ghost" style={{ display: 'inline-grid', placeItems: 'center', width: 16, height: 16, padding: 0, marginLeft: 2, fontSize: 14, lineHeight: 1, borderRadius: 3 }} aria-label="Remove">×</button>
          </span>
        ))}
      </div>

      {/* Performance grid */}
      <div className="adm-card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Performance</h3>
        <table className="adm-table" style={{ marginTop: -4 }}>
          <thead>
            <tr>
              <th>Strategy</th>
              {['7d', '30d', '90d', '1y'].map(p => (<th key={p} style={{ textAlign: 'right' }}>{p}</th>))}
              <th style={{ textAlign: 'right' }}>Sharpe</th>
              <th style={{ textAlign: 'right' }}>Max DD</th>
              <th style={{ textAlign: 'right' }}>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{s.cat}</div>
                    </div>
                  </div>
                </td>
                {['7d', '30d', '90d', '1y'].map(p => (
                  <td key={p} className="mono" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: 'var(--gain-text)' }}>{s.perf[p]}</td>
                ))}
                <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{s.metrics.sharpe}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12, color: 'var(--loss-text)' }}>{s.metrics.maxDD}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{s.metrics.winRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Equity curve overlay (sparklines) */}
      <div className="adm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>90-day equity curves</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            {strategies.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Stacked SVG curves */}
        <svg viewBox="0 0 800 240" style={{ width: '100%', height: 240 }}>
          {/* gridlines */}
          {[0, 60, 120, 180, 240].map(y => (
            <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />
          ))}
          {strategies.map((s, idx) => {
            // Synthetic curve based on offsets
            const seed = idx * 13 + 7;
            const points = [];
            let v = 100;
            for (let i = 0; i <= 90; i++) {
              const x = (i / 90) * 800;
              const drift = parseFloat(s.perf['90d']) / 90;
              const noise = Math.sin((i + seed) * 0.4) * 4 + Math.cos((i + seed) * 0.13) * 2;
              v += drift + noise * 0.3;
              const y = 240 - ((v - 90) / 70) * 200;
              points.push(`${x},${Math.max(8, Math.min(232, y))}`);
            }
            return <polyline key={s.id} points={points.join(' ')} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </svg>
      </div>

      {/* Allocation overlap */}
      <div className="adm-card" style={{ padding: 18 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Allocation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${strategies.length}, 1fr)`, gap: 24 }}>
          {strategies.map(s => (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(s.allocation).map(([market, pct]) => (
                  <div key={market}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span className="mono" style={{ color: 'var(--text-secondary)' }}>{market}</span>
                      <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: s.color, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);