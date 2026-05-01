/* Polyforge — Correlation Matrix
   How correlated are the markets you trade? Help users diversify. */

const COR_MARKETS = [
  'FED-CUT-JUL', 'FED-CUT-SEP', 'CPI-MAR', 'JOBS-Q2',
  'BTC-150K', 'ETH-ETF', 'NVDA-EARN', 'TSLA-DLV',
  'TARIFF-CHN', 'NFL-SB', 'OSCARS-OPP', 'TRUMP-NOM',
];

// Symmetric correlation matrix (-1 to 1)
const COR_MATRIX = [
  // FED-J FED-S CPI   JOBS  BTC   ETH   NVDA  TSLA  TARI  NFL   OSC   TRUMP
  [ 1.00, 0.84, 0.62, 0.48,-0.18,-0.12, 0.04,-0.02, 0.32, 0.04, 0.02, 0.18], // FED-CUT-JUL
  [ 0.84, 1.00, 0.58, 0.44,-0.14,-0.08, 0.08, 0.02, 0.28, 0.02, 0.04, 0.14], // FED-CUT-SEP
  [ 0.62, 0.58, 1.00, 0.52,-0.22,-0.16,-0.04,-0.08, 0.18, 0.00, 0.02, 0.08], // CPI-MAR
  [ 0.48, 0.44, 0.52, 1.00,-0.10,-0.04, 0.18, 0.12, 0.14, 0.04, 0.06, 0.04], // JOBS-Q2
  [-0.18,-0.14,-0.22,-0.10, 1.00, 0.78, 0.42, 0.32, 0.04, 0.02, 0.04, 0.02], // BTC-150K
  [-0.12,-0.08,-0.16,-0.04, 0.78, 1.00, 0.38, 0.28, 0.02, 0.04, 0.02, 0.06], // ETH-ETF
  [ 0.04, 0.08,-0.04, 0.18, 0.42, 0.38, 1.00, 0.64, 0.08, 0.04, 0.02, 0.04], // NVDA-EARN
  [-0.02, 0.02,-0.08, 0.12, 0.32, 0.28, 0.64, 1.00, 0.04, 0.02, 0.04, 0.04], // TSLA-DLV
  [ 0.32, 0.28, 0.18, 0.14, 0.04, 0.02, 0.08, 0.04, 1.00, 0.02, 0.04, 0.42], // TARIFF-CHN
  [ 0.04, 0.02, 0.00, 0.04, 0.02, 0.04, 0.04, 0.02, 0.02, 1.00, 0.18, 0.04], // NFL-SB
  [ 0.02, 0.04, 0.02, 0.06, 0.04, 0.02, 0.02, 0.04, 0.04, 0.18, 1.00, 0.06], // OSCARS-OPP
  [ 0.18, 0.14, 0.08, 0.04, 0.02, 0.06, 0.04, 0.04, 0.42, 0.04, 0.06, 1.00], // TRUMP-NOM
];

const COR_INSIGHTS = [
  { kind: 'warn', a: 'FED-CUT-JUL', b: 'FED-CUT-SEP', rho:  0.84,
    head: 'Concentration risk',
    body: 'You hold size in both. The two contracts will move together — trim the smaller leg.' },
  { kind: 'gain', a: 'NFL-SB',      b: 'FED-CUT-JUL', rho:  0.04,
    head: 'Healthy hedge',
    body: 'Sports × macro is decorrelated. Useful when sizing a new sports position against existing macro.' },
  { kind: 'neutral', a: 'BTC-150K', b: 'CPI-MAR',     rho: -0.22,
    head: 'Negative pair',
    body: 'Crypto rallies on cool inflation prints. Modest but exploitable as a paired bet on print day.' },
];

function colorFor(v) {
  // Blue (positive) ↔ neutral ↔ red (negative)
  if (v >= 0.95) return 'rgba(255,255,255,0.10)'; // diagonal
  if (v > 0)  return `rgba(0, 102, 255, ${Math.min(1, Math.abs(v) * 1.15).toFixed(2)})`;
  if (v < 0)  return `rgba(239, 68, 68, ${Math.min(1, Math.abs(v) * 1.15).toFixed(2)})`;
  return 'transparent';
}

function App() {
  const [hover, setHover] = React.useState(null); // {i, j}

  return (
    <UsrShell active="analytics" title="Correlation matrix" crumbs={[
      { label: 'Analytics', href: 'App-Analytics.html' },
      { label: 'Correlation' },
    ]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Configure</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
      </>
    }>
      <AdmPageHead
        title="Correlation matrix"
        sub="Pairwise correlation across the 12 markets you've traded most · 90-day window · daily mid-price returns"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Matrix */}
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Pairwise correlation</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: 'rgba(239, 68, 68, 0.9)', borderRadius: 2 }} />
                <span>-1</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: 'var(--bg-elevated)', borderRadius: 2 }} />
                <span>0</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: 'rgba(0, 102, 255, 0.9)', borderRadius: 2 }} />
                <span>+1</span>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4 }}>
            {/* spacer */}
            <div></div>
            {/* Top labels */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COR_MARKETS.length}, 1fr)`, gap: 2, paddingLeft: 4 }}>
              {COR_MARKETS.map((m, j) => (
                <div key={j} className="mono" style={{
                  fontSize: 9.5, color: hover && hover.j === j ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transform: 'rotate(-50deg)', transformOrigin: 'left bottom', height: 64,
                  display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap', fontWeight: 500,
                }}>{m}</div>
              ))}
            </div>

            {/* Side labels + cells */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
              {COR_MARKETS.map((m, i) => (
                <div key={i} className="mono" style={{
                  fontSize: 10.5, color: hover && hover.i === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textAlign: 'right', paddingRight: 8, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}>{m}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateRows: `repeat(${COR_MARKETS.length}, 26px)`, gap: 2 }}>
              {COR_MATRIX.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${COR_MARKETS.length}, 1fr)`, gap: 2 }}>
                  {row.map((v, j) => {
                    const isHover = hover && (hover.i === i && hover.j === j);
                    const isDiag = i === j;
                    return (
                      <div
                        key={j}
                        onMouseEnter={() => setHover({ i, j, v })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          background: colorFor(v),
                          border: isHover ? '1px solid var(--text-primary)' : '1px solid transparent',
                          borderRadius: 2,
                          fontSize: 9.5, fontFamily: 'Geist Mono, monospace', fontWeight: 600,
                          color: Math.abs(v) > 0.5 ? '#fff' : 'var(--text-tertiary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'border-color 0.1s',
                          cursor: 'pointer',
                        }}
                      >
                        {!isDiag && (v.toFixed(2).replace('0.', '.').replace('-.', '−.'))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {hover && (
            <div style={{ marginTop: 14, padding: 10, background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{COR_MARKETS[hover.i]}</span>
              <span>×</span>
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{COR_MARKETS[hover.j]}</span>
              <span style={{ marginLeft: 'auto' }}>ρ = </span>
              <span className="mono" style={{ color: hover.v > 0 ? 'var(--accent-text)' : hover.v < 0 ? 'var(--loss-text)' : 'var(--text-secondary)', fontWeight: 600 }}>{hover.v.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>What this means for you</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{COR_INSIGHTS.length} signals</div>
            </div>
            {COR_INSIGHTS.map((ins, i) => {
              const rhoColor = ins.rho >= 0.5 ? 'var(--loss-text)'
                             : ins.rho <= -0.15 ? 'var(--accent-text)'
                             : 'var(--text-secondary)';
              const tag = ins.kind === 'warn' ? { t: 'TRIM', c: 'var(--loss-text)' }
                        : ins.kind === 'gain' ? { t: 'HEDGE', c: 'var(--gain-text)' }
                        : { t: 'PAIR', c: 'var(--accent-text)' };
              return (
                <div key={i} style={{ padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: tag.c }}>{tag.t}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ins.head}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11 }} className="mono">
                    <span style={{ color: 'var(--text-secondary)' }}>{ins.a}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>×</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{ins.b}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>ρ</span>
                    <span style={{ color: rhoColor, fontWeight: 600, fontSize: 12 }}>{ins.rho > 0 ? '+' : ''}{ins.rho.toFixed(2)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins.body}</p>
                </div>
              );
            })}
          </div>

          <div className="adm-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Portfolio diversification score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span className="mono tabnum" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>0.62</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/ 1.00</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--gain-text)', fontWeight: 600 }}>+0.04 vs 30d</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-canvas)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: '62%', height: '100%', background: 'linear-gradient(90deg, var(--loss) 0%, var(--warn) 50%, var(--gain) 100%)' }} />
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Mean off-diagonal |ρ| = 0.16. Lower is more diversified. Healthy zone: <span className="mono" style={{ color: 'var(--text-secondary)' }}>0.50–0.75</span>.</p>
          </div>
        </div>
      </div>

      {/* Below the fold: rolling correlation + cluster detection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        {/* Rolling correlation */}
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Rolling correlation · 30-day window</div>
            <button className="adm-btn adm-btn-sm adm-btn-ghost" style={{ fontSize: 11 }}>
              <span className="mono">FED-CUT-JUL × FED-CUT-SEP</span>
              <AdmIcon name="chevron-down" size={11} />
            </button>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 11.5, color: 'var(--text-tertiary)' }}>How the correlation between this pair has drifted over the last 90 days.</p>

          {/* Sparkline / area chart */}
          <div style={{ position: 'relative', height: 180 }}>
            {/* Y-axis labels */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {['+1.0','+0.5',' 0.0','-0.5','-1.0'].map(t => (
                <span key={t} className="mono tabnum" style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textAlign: 'right' }}>{t}</span>
              ))}
            </div>
            {/* Chart area */}
            <div style={{ position: 'absolute', left: 36, right: 0, top: 0, bottom: 18 }}>
              {/* Gridlines */}
              {[0, 25, 50, 75, 100].map(y => (
                <div key={y} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 1, background: y === 50 ? 'var(--border-default)' : 'var(--border-subtle)', opacity: y === 50 ? 0.6 : 0.4 }} />
              ))}
              {/* Healthy zone shading */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '12.5%', height: '37.5%', background: 'rgba(0,102,255,0.04)' }} />
              {/* Line + area */}
              <svg width="100%" height="100%" viewBox="0 0 300 162" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <linearGradient id="rollFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,102,255,0.30)" />
                    <stop offset="100%" stopColor="rgba(0,102,255,0)" />
                  </linearGradient>
                </defs>
                {/* Walk: starts ~0.42, climbs to 0.84 by end. 14 points across 90d. */}
                {(() => {
                  const pts = [0.42, 0.48, 0.51, 0.46, 0.55, 0.62, 0.58, 0.66, 0.71, 0.69, 0.74, 0.78, 0.81, 0.84];
                  const xs = pts.map((_, i) => (i / (pts.length - 1)) * 300);
                  const ys = pts.map(v => 81 - v * 81); // 0 at center (81), ±1 = ±81
                  const linePath = pts.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${ys[i]}`).join(' ');
                  const areaPath = `${linePath} L 300 81 L 0 81 Z`;
                  return (
                    <>
                      <path d={areaPath} fill="url(#rollFill)" />
                      <path d={linePath} stroke="var(--accent-text)" strokeWidth="1.5" fill="none" />
                      {pts.map((v, i) => i === pts.length - 1 ? (
                        <g key={i}>
                          <circle cx={xs[i]} cy={ys[i]} r="3.5" fill="var(--bg-elev-1)" stroke="var(--accent-text)" strokeWidth="1.5" />
                        </g>
                      ) : null)}
                    </>
                  );
                })()}
              </svg>
              {/* End-of-line callout */}
              <div className="mono tabnum" style={{ position: 'absolute', right: 8, top: 4, fontSize: 11, color: 'var(--accent-text)', fontWeight: 600 }}>+0.84</div>
            </div>
            {/* X-axis */}
            <div style={{ position: 'absolute', left: 36, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between' }}>
              {['-90d','-60d','-30d','today'].map(t => (
                <span key={t} className="mono tabnum" style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>90d range</div>
              <div className="mono tabnum" style={{ color: 'var(--text-primary)' }}>0.42 → 0.84</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trend</div>
              <div className="mono tabnum" style={{ color: 'var(--loss-text)' }}>+0.42 (tightening)</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Volatility (σ)</div>
              <div className="mono tabnum" style={{ color: 'var(--text-primary)' }}>0.12</div>
            </div>
          </div>
        </div>

        {/* Clusters */}
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-detected clusters</div>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>hierarchical · |ρ| ≥ 0.30</span>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'var(--text-tertiary)' }}>Markets that move together. Treat each cluster as one risk bet when sizing.</p>

          {(() => {
            const clusters = [
              { name: 'Macro · rate-sensitive', avg: 0.62, color: 'var(--accent-text)', bar: 'rgba(0,102,255,0.55)',
                members: ['FED-CUT-JUL', 'FED-CUT-SEP', 'CPI-MAR', 'JOBS-Q2'] },
              { name: 'Risk-on · crypto + tech', avg: 0.53, color: 'var(--accent-text)', bar: 'rgba(0,102,255,0.45)',
                members: ['BTC-150K', 'ETH-ETF', 'NVDA-EARN', 'TSLA-DLV'] },
              { name: 'Politics · trade & nom', avg: 0.42, color: 'var(--accent-text)', bar: 'rgba(0,102,255,0.35)',
                members: ['TARIFF-CHN', 'TRUMP-NOM'] },
              { name: 'Idiosyncratic · entertainment', avg: 0.18, color: 'var(--text-secondary)', bar: 'rgba(255,255,255,0.10)',
                members: ['NFL-SB', 'OSCARS-OPP'] },
            ];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {clusters.map((c, i) => (
                  <div key={i} style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>avg ρ</span>
                        <span className="mono tabnum" style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.avg.toFixed(2)}</span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-canvas)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${c.avg * 100}%`, height: '100%', background: c.bar }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {c.members.map(m => (
                        <span key={m} className="mono" style={{ fontSize: 10.5, padding: '2px 6px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-secondary)' }}>{m}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);