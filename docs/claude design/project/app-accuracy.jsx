/* Polyforge — Forecast Accuracy
   How calibrated are your predictions? Brier score + reliability diagram. */

const FA_KPIS = [
  { label: 'Brier score',       value: '0.184', delta: '↓ 0.022 vs Q4', kind: 'gain' },
  { label: 'Calibration error', value: '4.2%',  delta: 'top quartile',  kind: 'gain' },
  { label: 'Predictions made',  value: '284',   delta: 'last 90 days',  kind: 'neutral' },
  { label: 'Hit rate',          value: '64.2%', delta: '67% high-conv', kind: 'gain' },
];

// Reliability diagram bins: predicted prob → actual frequency
const FA_BINS = [
  { pred: 5,  actual: 4,  count: 18 },
  { pred: 15, actual: 13, count: 32 },
  { pred: 25, actual: 22, count: 28 },
  { pred: 35, actual: 31, count: 38 },
  { pred: 45, actual: 48, count: 42 },
  { pred: 55, actual: 58, count: 36 },
  { pred: 65, actual: 62, count: 34 },
  { pred: 75, actual: 78, count: 28 },
  { pred: 85, actual: 84, count: 18 },
  { pred: 95, actual: 96, count: 10 },
];

// Recent predictions
const FA_RECENT = [
  { id: 'P-184', market: 'FED-CUT-JUL',    pred: '72%', actual: 'YES',   resolved: 'Apr 28', score: '+0.078' },
  { id: 'P-183', market: 'NVDA-EARN-Q1',   pred: '64%', actual: 'YES',   resolved: 'Apr 22', score: '+0.130' },
  { id: 'P-182', market: 'OSCARS-OPP',     pred: '38%', actual: 'NO',    resolved: 'Apr 18', score: '+0.144' },
  { id: 'P-181', market: 'NFL-SB-CHIEFS',  pred: '52%', actual: 'NO',    resolved: 'Apr 14', score: '-0.270' },
  { id: 'P-180', market: 'TARIFF-CHN-25',  pred: '74%', actual: 'YES',   resolved: 'Apr 12', score: '+0.068' },
  { id: 'P-179', market: 'ETH-ETF-Q3',     pred: '38%', actual: 'YES',   resolved: 'Apr 09', score: '-0.384' },
  { id: 'P-178', market: 'CPI-MAR-COOL',   pred: '68%', actual: 'YES',   resolved: 'Apr 04', score: '+0.102' },
  { id: 'P-177', market: 'TRUMP-NOM',      pred: '88%', actual: 'YES',   resolved: 'Mar 30', score: '+0.014' },
];

// Category breakdown
const FA_BY_CAT = [
  { cat: 'Macro',     brier: 0.142, n: 38,  acc: 71 },
  { cat: 'Crypto',    brier: 0.168, n: 64,  acc: 66 },
  { cat: 'Equities',  brier: 0.176, n: 42,  acc: 64 },
  { cat: 'Politics',  brier: 0.198, n: 24,  acc: 58 },
  { cat: 'Sports',    brier: 0.224, n: 84,  acc: 52 },
  { cat: 'Culture',   brier: 0.246, n: 32,  acc: 48 },
];

function App() {
  return (
    <UsrShell active="accuracy" title="Forecast accuracy" crumbs={[{ label: 'Accuracy' }]}>
      <AdmPageHead
        title="Forecast accuracy"
        sub="How calibrated are you? · Brier score · reliability diagram · category breakdown"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {FA_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.kind} />)}
      </div>

      {/* Reliability diagram */}
      <div className="adm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Reliability diagram</h3>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Closer to the diagonal = better calibrated</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: 'var(--text-tertiary)', borderTop: '1px dashed' }} />
              <span>Perfect calibration</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: 'var(--accent-default)' }} />
              <span>Your forecasts</span>
            </span>
          </div>
        </div>

        <svg viewBox="0 0 600 360" style={{ width: '100%', height: 360, display: 'block' }}>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <React.Fragment key={t}>
              <line x1={50 + t * 510} y1="20" x2={50 + t * 510} y2="320" stroke="var(--border-subtle)" strokeWidth="0.5" />
              <line x1="50" y1={320 - t * 300} x2="560" y2={320 - t * 300} stroke="var(--border-subtle)" strokeWidth="0.5" />
              <text x={50 + t * 510} y="340" fill="var(--text-tertiary)" fontSize="10" textAnchor="middle" fontFamily="Geist Mono">{(t * 100).toFixed(0)}%</text>
              <text x="40" y={324 - t * 300} fill="var(--text-tertiary)" fontSize="10" textAnchor="end" fontFamily="Geist Mono">{(t * 100).toFixed(0)}%</text>
            </React.Fragment>
          ))}
          {/* Diagonal (perfect) */}
          <line x1="50" y1="320" x2="560" y2="20" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 4" />
          {/* User curve */}
          <polyline
            points={FA_BINS.map(b => `${50 + (b.pred / 100) * 510},${320 - (b.actual / 100) * 300}`).join(' ')}
            fill="none" stroke="var(--accent-default)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
          {/* Bin dots, sized by count */}
          {FA_BINS.map((b, i) => (
            <g key={i}>
              <circle
                cx={50 + (b.pred / 100) * 510}
                cy={320 - (b.actual / 100) * 300}
                r={Math.sqrt(b.count) * 1.4}
                fill="var(--accent-default)"
                opacity="0.25"
              />
              <circle
                cx={50 + (b.pred / 100) * 510}
                cy={320 - (b.actual / 100) * 300}
                r="3"
                fill="var(--accent-default)"
              />
            </g>
          ))}
          {/* Axis labels */}
          <text x="305" y="358" fill="var(--text-secondary)" fontSize="11" textAnchor="middle" fontWeight="500">Predicted probability</text>
          <text x="14" y="170" fill="var(--text-secondary)" fontSize="11" textAnchor="middle" fontWeight="500" transform="rotate(-90 14 170)">Actual frequency</text>
        </svg>

        <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--gain-text)' }}>Well-calibrated.</strong> Your high-confidence predictions (75%+) resolve as YES at the rate you predict — bin sizes 28-44 trades each.
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Slight underconfidence around 65%.</strong> Markets you call 65% YES resolve YES 62% of the time — close enough to noise.
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Accuracy by category</h3>
          <table className="adm-table" style={{ marginTop: -4 }}>
            <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Brier</th><th style={{ textAlign: 'right' }}>Hit rate</th><th style={{ textAlign: 'right' }}>n</th></tr></thead>
            <tbody>
              {FA_BY_CAT.map(c => (
                <tr key={c.cat}>
                  <td style={{ fontSize: 12, fontWeight: 500 }}>{c.cat}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5 }}>{c.brier.toFixed(3)}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: c.acc >= 60 ? 'var(--gain-text)' : c.acc >= 50 ? 'var(--text-primary)' : 'var(--loss-text)' }}>{c.acc}%</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Recent resolutions</h3>
          </div>
          <table className="adm-table">
            <thead><tr><th>Market</th><th>Predicted</th><th>Resolved</th><th style={{ textAlign: 'right' }}>Brier Δ</th></tr></thead>
            <tbody>
              {FA_RECENT.slice(0, 6).map(p => {
                const win = p.score.startsWith('+');
                return (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{p.market}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{p.pred}</td>
                    <td><span className={`adm-pill ${p.actual === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 9.5 }}>{p.actual}</span></td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{p.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);