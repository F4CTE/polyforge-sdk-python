/* Polyforge — Strategies · Compare
   Side-by-side comparison of up to 4 strategies — equity curves, KPIs, exposure mix. */

const SC_AVAILABLE = [
  { id: 'fed',   name: 'Macro · Fed cycle',         color: 'var(--accent-default)', kpis: { ret: '+18.4%', win: 68, sharpe: '1.84', maxDd: '-8.2%', trades: 142, vol: '$284K' } },
  { id: 'whale', name: 'Politics whale mirror',     color: '#f59e0b',               kpis: { ret: '+12.8%', win: 71, sharpe: '1.42', maxDd: '-5.4%', trades: 96,  vol: '$184K' } },
  { id: 'arb',   name: 'Cross-venue arbitrage',     color: '#10b981',               kpis: { ret: '+9.2%',  win: 84, sharpe: '2.18', maxDd: '-2.1%', trades: 412, vol: '$640K' } },
  { id: 'sport', name: 'Sports · Sharp counter',    color: '#a78bfa',               kpis: { ret: '+8.4%',  win: 64, sharpe: '0.96', maxDd: '-12.4%', trades: 84,  vol: '$96K' } },
  { id: 'sent',  name: 'Sentiment pulse · X',       color: '#ec4899',               kpis: { ret: '+6.4%',  win: 58, sharpe: '0.72', maxDd: '-14.8%', trades: 184, vol: '$48K' } },
];

// Generate 90d equity curves for each
function gen(seed, vol = 0.6, drift = 1) {
  const out = []; let v = 0; let r = seed;
  for (let i = 0; i <= 90; i++) {
    r = (r * 9301 + 49297) % 233280;
    const noise = (r / 233280 - 0.5) * vol * 4;
    v += noise + drift * 0.18;
    out.push(v);
  }
  return out;
}
const CURVES = {
  fed:   gen(7, 0.45, 1.0),
  whale: gen(42, 0.35, 0.7),
  arb:   gen(99, 0.20, 0.5),
  sport: gen(13, 0.65, 0.45),
  sent:  gen(81, 0.85, 0.35),
};

function App() {
  const [selected, setSelected] = React.useState(['fed', 'whale', 'arb']);
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 4 ? [...s, id] : s);
  const items = SC_AVAILABLE.filter(s => selected.includes(s.id));

  // Compute combined min/max for shared y-axis
  const allVals = items.flatMap(s => CURVES[s.id]);
  const minY = Math.min(...allVals), maxY = Math.max(...allVals), rangeY = maxY - minY || 1;

  const w = 760, h = 280, pad = 24;
  const path = (data) => {
    return data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - minY) / rangeY) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };
  const yAt = (v) => pad + (1 - (v - minY) / rangeY) * (h - pad * 2);
  const zeroY = yAt(0);

  return (
    <UsrShell active="compare" title="Compare strategies" crumbs={[
      { label: 'Strategies', href: 'App-Strategies.html' },
      { label: 'Compare' },
    ]}>
      <AdmPageHead
        title="Compare strategies"
        sub="Pick up to 4 strategies to overlay performance, P&L curves, and risk metrics · 90-day backtest window"
      />

      <div className="adm-tabs" style={{ marginBottom: 20 }}>
        <a href="App-Strategies.html" className="adm-tab">My strategies</a>
        <a href="App-Strategies-Templates.html" className="adm-tab">Templates</a>
        <a href="App-Strategies-Compare.html" className="adm-tab is-active">Compare</a>
      </div>

      {/* Picker */}
      <div className="adm-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Select strategies ({selected.length}/4)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {SC_AVAILABLE.map(s => {
            const on = selected.includes(s.id);
            const disabled = !on && selected.length >= 4;
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={disabled}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: on ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0, boxShadow: on ? '0 0 0 2px rgba(255,255,255,0.1)' : 'none' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                {on && <AdmIcon name="check" size={12} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overlay chart */}
      <div className="adm-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cumulative return · 90 days</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {items.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 280, display: 'block' }}>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line key={i} x1={pad} x2={w - pad} y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)} stroke="var(--border-subtle)" strokeWidth="1" />
          ))}
          {/* Zero line */}
          {minY < 0 && maxY > 0 && (
            <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {/* Curves */}
          {items.map(s => (
            <path key={s.id} d={path(CURVES[s.id])} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* Y labels */}
          {[maxY, (maxY+minY)/2, minY].map((v, i) => (
            <text key={i} x={4} y={pad + (i / 2) * (h - pad * 2) + 4} fontSize="10" fill="var(--text-tertiary)" fontFamily="var(--font-mono)">{v >= 0 ? '+' : ''}{v.toFixed(1)}%</text>
          ))}
        </svg>
      </div>

      {/* KPI table */}
      <div className="adm-card" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead><tr>
            <th>Metric</th>
            {items.map(s => (
              <th key={s.id} style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{s.name}</span>
                </div>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { k: 'ret',    label: '90d return',  fmt: v => v, color: true },
              { k: 'win',    label: 'Win rate',    fmt: v => `${v}%` },
              { k: 'sharpe', label: 'Sharpe',      fmt: v => v },
              { k: 'maxDd',  label: 'Max drawdown',fmt: v => v, lossColor: true },
              { k: 'trades', label: 'Trades · 90d',fmt: v => v.toLocaleString() },
              { k: 'vol',    label: 'Volume',      fmt: v => v },
            ].map(row => (
              <tr key={row.k}>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</td>
                {items.map(s => {
                  const v = s.kpis[row.k];
                  const c = row.color && String(v).startsWith('+') ? 'var(--gain-text)' :
                            row.lossColor ? 'var(--loss-text)' :
                            'var(--text-primary)';
                  return (
                    <td key={s.id} className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: c }}>{row.fmt(v)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);