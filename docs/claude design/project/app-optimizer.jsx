/* Polyforge — Portfolio Optimizer
   Suggest reweighting of current positions for better risk/return. Efficient frontier. */

const OP_CURRENT = [
  { ticker: 'FED-CUT-JUL',  weight: 28, exp: 14.2, vol: 18.4, color: '#0066ff' },
  { ticker: 'NVDA-EARN-Q1', weight: 18, exp: 22.4, vol: 28.6, color: '#10b981' },
  { ticker: 'BTC-150K-DEC', weight: 15, exp: 18.0, vol: 32.4, color: '#a78bfa' },
  { ticker: 'ETH-ETF-Q3',   weight: 12, exp: 24.8, vol: 30.2, color: '#f59e0b' },
  { ticker: 'TARIFF-CHN-25',weight: 10, exp: 12.8, vol: 16.4, color: '#ef4444' },
  { ticker: 'OSCARS-OPP',   weight:  6, exp:  8.2, vol: 14.0, color: '#64748b' },
  { ticker: 'NFL-SB-CHIEFS',weight:  6, exp: 10.4, vol: 22.4, color: '#14b8a6' },
  { ticker: 'TRUMP-NOM',    weight:  5, exp: 16.2, vol: 24.8, color: '#ec4899' },
];

const OP_OPTIMAL = [
  { ticker: 'FED-CUT-JUL',  weight: 22, exp: 14.2, vol: 18.4, color: '#0066ff' },
  { ticker: 'NVDA-EARN-Q1', weight: 14, exp: 22.4, vol: 28.6, color: '#10b981' },
  { ticker: 'BTC-150K-DEC', weight: 18, exp: 18.0, vol: 32.4, color: '#a78bfa' },
  { ticker: 'ETH-ETF-Q3',   weight: 16, exp: 24.8, vol: 30.2, color: '#f59e0b' },
  { ticker: 'TARIFF-CHN-25',weight: 14, exp: 12.8, vol: 16.4, color: '#ef4444' },
  { ticker: 'OSCARS-OPP',   weight:  4, exp:  8.2, vol: 14.0, color: '#64748b' },
  { ticker: 'NFL-SB-CHIEFS',weight:  6, exp: 10.4, vol: 22.4, color: '#14b8a6' },
  { ticker: 'TRUMP-NOM',    weight:  6, exp: 16.2, vol: 24.8, color: '#ec4899' },
];

const OP_PORTFOLIOS = [
  { id: 'conservative', label: 'Conservative',  exp: 12.8, vol: 14.4, sharpe: 0.89, x: 14.4, y: 12.8 },
  { id: 'balanced',     label: 'Balanced',       exp: 16.2, vol: 18.6, sharpe: 0.87, x: 18.6, y: 16.2 },
  { id: 'current',      label: 'Current',        exp: 17.4, vol: 22.8, sharpe: 0.76, x: 22.8, y: 17.4, current: true },
  { id: 'optimal',      label: 'Optimal',        exp: 19.4, vol: 19.8, sharpe: 0.98, x: 19.8, y: 19.4, optimal: true },
  { id: 'aggressive',   label: 'Aggressive',     exp: 22.6, vol: 26.4, sharpe: 0.86, x: 26.4, y: 22.6 },
];

const OP_CHANGES = [
  { ticker: 'BTC-150K-DEC',  from: 15, to: 18, dir: 'up' },
  { ticker: 'ETH-ETF-Q3',    from: 12, to: 16, dir: 'up' },
  { ticker: 'TARIFF-CHN-25', from: 10, to: 14, dir: 'up' },
  { ticker: 'TRUMP-NOM',     from:  5, to:  6, dir: 'up' },
  { ticker: 'FED-CUT-JUL',   from: 28, to: 22, dir: 'down' },
  { ticker: 'NVDA-EARN-Q1',  from: 18, to: 14, dir: 'down' },
  { ticker: 'OSCARS-OPP',    from:  6, to:  4, dir: 'down' },
];

function App() {
  const [target, setTarget] = React.useState('optimal');
  const [risk, setRisk] = React.useState(50);

  return (
    <UsrShell active="optimizer" title="Portfolio optimizer" crumbs={[{ label: 'Optimizer' }]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="check" size={12} />Apply allocation</button>
    }>
      <AdmPageHead
        title="Portfolio optimizer"
        sub="Mean-variance optimization · suggest reweighting for better risk-adjusted return"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Current expected return" value="17.4%" delta="annualized" deltaKind="neutral" />
        <AdmStat label="Current volatility"      value="22.8%" delta="↑ above peer median" deltaKind="warn" />
        <AdmStat label="Current Sharpe"          value="0.76"  delta="vs 0.98 optimal" deltaKind="warn" />
        <AdmStat label="Improvement potential"   value="+0.22 Sharpe" delta="if rebalanced" deltaKind="gain" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>
        {/* Efficient frontier */}
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Efficient frontier</h3>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Risk vs expected return</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 200px', gap: 18, alignItems: 'stretch' }}>
            {/* Legend / context column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Reading this chart</div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Each dot is a possible portfolio. The dashed curve is the best-possible return for each level of risk.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--loss)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Current</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Sharpe 0.76</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-default)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Optimal</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--accent-text)' }}>Sharpe 0.98 (+0.22)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Alternatives</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>3 risk profiles</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Distance to frontier</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span className="mono tabnum" style={{ fontSize: 16, fontWeight: 600, color: 'var(--loss-text)' }}>2.4%</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>return left on the table</span>
                </div>
              </div>
            </div>
            {/* Chart */}
            <svg viewBox="0 0 600 360" style={{ width: '100%', height: 320, display: 'block' }}>
            {/* X axis: 5%–32%, Y axis: 6%–24% */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <React.Fragment key={t}>
                <line x1={50 + t * 510} y1="20" x2={50 + t * 510} y2="320" stroke="var(--border-subtle)" strokeWidth="0.5" />
                <line x1="50" y1={320 - t * 300} x2="560" y2={320 - t * 300} stroke="var(--border-subtle)" strokeWidth="0.5" />
                <text x={50 + t * 510} y="340" fill="var(--text-tertiary)" fontSize="10" textAnchor="middle" fontFamily="Geist Mono">{(5 + t * 27).toFixed(0)}%</text>
                <text x="40" y={324 - t * 300} fill="var(--text-tertiary)" fontSize="10" textAnchor="end" fontFamily="Geist Mono">{(6 + t * 18).toFixed(0)}%</text>
              </React.Fragment>
            ))}
            {/* Frontier curve */}
            {(() => {
              const xMap = v => 50 + ((v - 5) / 27) * 510;
              const yMap = r => 320 - ((r - 6) / 18) * 300;
              const pts = [];
              for (let v = 8; v <= 30; v += 0.5) {
                const r = -0.012 * (v - 20) * (v - 20) + 22;
                pts.push(`${xMap(v)},${yMap(r)}`);
              }
              return <polyline points={pts.join(' ')} fill="none" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />;
            })()}
            {/* Portfolio dots */}
            {OP_PORTFOLIOS.map(p => {
              const cx = 50 + ((p.x - 5) / 27) * 510;
              const cy = 320 - ((p.y - 6) / 18) * 300;
              const isOpt = p.optimal, isCur = p.current;
              return (
                <g key={p.id}>
                  <circle cx={cx} cy={cy} r={isOpt || isCur ? 9 : 6}
                    fill={isOpt ? 'var(--accent-default)' : isCur ? 'var(--loss)' : 'var(--text-tertiary)'}
                    opacity={isOpt || isCur ? 1 : 0.6}
                  />
                  <text x={cx + 14} y={cy + 4} fill="var(--text-primary)" fontSize="11" fontWeight={isOpt || isCur ? 600 : 400}>{p.label}</text>
                  {(isOpt || isCur) && (
                    <text x={cx + 14} y={cy + 18} fill="var(--text-tertiary)" fontSize="10" fontFamily="Geist Mono">Sharpe {p.sharpe}</text>
                  )}
                </g>
              );
            })}
            <text x="305" y="358" fill="var(--text-secondary)" fontSize="11" textAnchor="middle" fontWeight="500">Volatility (annualized)</text>
            <text x="14" y="170" fill="var(--text-secondary)" fontSize="11" textAnchor="middle" fontWeight="500" transform="rotate(-90 14 170)">Expected return</text>
          </svg>
          {/* Right column: constraints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Constraints</div>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ fontSize: 10.5, padding: '0 6px', height: 20 }}>Edit</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Long-only', val: 'on' },
                  { label: 'Max position', val: '25%' },
                  { label: 'Max macro', val: '3' },
                  { label: 'Min liquidity', val: '$50k' },
                ].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <AdmIcon name="check" size={10} className="adm-icon-tertiary" />
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
                    <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Controls */}
        <div className="adm-card" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Target portfolio</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {OP_PORTFOLIOS.map(p => (
              <button
                key={p.id}
                onClick={() => setTarget(p.id)}
                style={{
                  textAlign: 'left', padding: '10px 12px',
                  background: target === p.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${target === p.id ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--accent-text)', fontWeight: 600 }}>{p.sharpe}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'Geist Mono, monospace' }}>
                  ER {p.exp}% · σ {p.vol}%
                </div>
              </button>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
              Risk tolerance · <span className="mono" style={{ color: 'var(--text-primary)' }}>{risk}</span>
            </label>
            <input type="range" min="0" max="100" value={risk} onChange={e => setRisk(e.target.value)} className="usr-range" style={{ '--val': risk / 100 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
              <span>Conservative</span><span>Aggressive</span>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation comparison */}
      <div className="adm-card" style={{ padding: 18 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Suggested rebalancing · {OP_PORTFOLIOS.find(p => p.id === target)?.label}</h3>
        <table className="adm-table">
          <thead><tr>
            <th>Market</th>
            <th style={{ textAlign: 'right' }}>Current</th>
            <th></th>
            <th style={{ textAlign: 'right' }}>Target</th>
            <th>Δ</th>
            <th style={{ textAlign: 'right' }}>Expected</th>
            <th style={{ textAlign: 'right' }}>Vol</th>
          </tr></thead>
          <tbody>
            {OP_CURRENT.map((c, i) => {
              const o = OP_OPTIMAL[i];
              const delta = o.weight - c.weight;
              return (
                <tr key={c.ticker}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                      <span className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{c.ticker}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5 }}>{c.weight}%</td>
                  <td style={{ width: 80 }}>
                    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${c.weight * 2.5}%`, height: '100%', background: c.color, opacity: 0.4 }} />
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 600 }}>{o.weight}%</td>
                  <td className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: delta > 0 ? 'var(--gain-text)' : delta < 0 ? 'var(--loss-text)' : 'var(--text-tertiary)' }}>
                    {delta > 0 ? '↑' : delta < 0 ? '↓' : '–'} {Math.abs(delta)}%
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11 }}>{c.exp}%</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>{c.vol}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);