/* Polyforge — Analytics
   Personal trading analytics: P&L attribution, breakdowns, factor exposure. */

const AN_KPIS = [
  { label: 'Total P&L (1y)',  value: '+$48,284', delta: '+128% vs cost basis', kind: 'gain' },
  { label: 'Win rate',         value: '64.2%',   delta: '↑ 3.1pp QoQ', kind: 'gain' },
  { label: 'Sharpe (1y)',      value: '2.14',    delta: 'top decile', kind: 'gain' },
  { label: 'Max drawdown',     value: '-8.4%',   delta: 'on Mar 18', kind: 'warn' },
];

// 12-month P&L
const AN_MONTHLY = [
  { m: 'May', v:  +1840 }, { m: 'Jun', v:  +2240 }, { m: 'Jul', v:  +3120 }, { m: 'Aug', v:   -640 },
  { m: 'Sep', v:  +4280 }, { m: 'Oct', v:  +5180 }, { m: 'Nov', v:  +2840 }, { m: 'Dec', v:  +6420 },
  { m: 'Jan', v:  +3960 }, { m: 'Feb', v:  -1280 }, { m: 'Mar', v:  +8240 }, { m: 'Apr', v: +12080 },
];

// Category breakdown
const AN_CATEGORIES = [
  { cat: 'Macro',     pnl: '+$18,420', pct: 38, color: '#10b981', trades: 84 },
  { cat: 'Crypto',    pnl: '+$11,840', pct: 25, color: '#0066ff', trades: 142 },
  { cat: 'Equities',  pnl:  '+$8,240', pct: 17, color: '#a78bfa', trades: 64 },
  { cat: 'Politics',  pnl:  '+$6,180', pct: 13, color: '#f59e0b', trades: 38 },
  { cat: 'Sports',    pnl:  '+$2,840', pct:  6, color: '#ef4444', trades: 92 },
  { cat: 'Culture',   pnl:    '+$764', pct:  1, color: '#64748b', trades: 18 },
];

// Top winners / losers
const AN_TOP = [
  { ticker: 'NVDA-EARN-Q1',   pnl: '+$8,420', pct: '+30.1%' },
  { ticker: 'FED-CUT-JUL',    pnl: '+$5,280', pct: '+10.9%' },
  { ticker: 'ETH-ETF-Q3',     pnl: '+$5,460', pct: '+42.7%' },
  { ticker: 'TARIFF-CHN-25',  pnl: '+$3,180', pct: '+14.2%' },
  { ticker: 'OSCARS-OPP',     pnl:  '-$840',  pct: '-13.1%' },
  { ticker: 'NFL-SB-CHIEFS',  pnl: '-$1,200', pct: '-14.3%' },
];

// Strategies
const AN_STRATEGIES = [
  { name: 'Whale Shadow',          pnl: '+$22,840', share: 47, color: '#0066ff' },
  { name: 'FOMC Drift',             pnl:  '+$9,840', share: 20, color: '#10b981' },
  { name: 'Cross-Venue Arb',        pnl:  '+$6,180', share: 13, color: '#a78bfa' },
  { name: 'Earnings Beat',          pnl:  '+$5,420', share: 11, color: '#f59e0b' },
  { name: 'Manual',                 pnl:  '+$4,004', share:  9, color: '#64748b' },
];

// Factor exposure (radar-ish data)
const AN_FACTORS = [
  { f: 'Momentum',     v: 0.84 },
  { f: 'Reversal',     v: 0.32 },
  { f: 'Volatility',   v: 0.68 },
  { f: 'Crowding',     v: 0.42 },
  { f: 'Sentiment',    v: 0.74 },
  { f: 'Macro beta',   v: 0.58 },
];

function App() {
  const [range, setRange] = React.useState('1y');

  return (
    <UsrShell active="analytics" title="Analytics" crumbs={[{ label: 'Analytics' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export CSV</button>
        <button className="adm-btn adm-btn-secondary">Compare to peers</button>
      </>
    }>
      <AdmPageHead
        title="Analytics"
        sub="Your trading performance · attribution · factor exposure · benchmarks"
      />

      {/* Range filter */}
      <div className="adm-filter-group" style={{ marginBottom: 16 }}>
        {['7d', '30d', '90d', '1y', 'All'].map(r => (
          <button key={r} onClick={() => setRange(r)} className={`adm-filter ${range === r ? 'is-active' : ''}`}>{r}</button>
        ))}
      </div>

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {AN_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.kind} />)}
      </div>

      {/* Monthly P&L bars */}
      <div className="adm-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Equity curve</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: 'var(--gain-text)', letterSpacing: '-0.01em' }}>+$48,284</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>cumulative · 12 mo</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', gap: 18, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
              <span><span className="mono" style={{ color: 'var(--gain-text)', fontWeight: 600 }}>10</span> green months</span>
              <span><span className="mono" style={{ color: 'var(--loss-text)', fontWeight: 600 }}>2</span> red months</span>
              <span>best <span className="mono" style={{ color: 'var(--text-secondary)' }}>Apr +$12.1k</span></span>
              <span>worst <span className="mono" style={{ color: 'var(--text-secondary)' }}>Feb −$1.3k</span></span>
            </div>
          </div>
        </div>

        {/* Equity curve (large) */}
        {(() => {
          const cum = [];
          let acc = 0;
          AN_MONTHLY.forEach(d => { acc += d.v; cum.push(acc); });
          const points = [0, ...cum]; // include 0 starting point
          const labels = ['Start', ...AN_MONTHLY.map(d => d.m)];
          const yMin = Math.min(...points, 0);
          const yMax = Math.max(...points, 0);
          const pad = (yMax - yMin) * 0.08;
          const top = yMax + pad;
          const bot = Math.min(yMin - pad, 0);
          const W = 1200, H = 240, PAD_L = 16, PAD_R = 56, PAD_T = 16, PAD_B = 8;
          const innerW = W - PAD_L - PAD_R;
          const innerH = H - PAD_T - PAD_B;
          const xAt = i => PAD_L + (i / (points.length - 1)) * innerW;
          const yAt = v => PAD_T + ((top - v) / (top - bot)) * innerH;
          const fmt = v => (v >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(v / 1000)) + 'k';
          // y ticks: nice round numbers
          const niceTicks = [0, 12000, 24000, 36000, 48000].filter(t => t <= top + 500);
          const accent = 'var(--accent-text)';
          const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ');
          const areaPath = linePath + ` L ${xAt(points.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block', marginTop: 12 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="eqFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.32"/>
                  <stop offset="60%" stopColor="var(--gain)" stopOpacity="0.06"/>
                  <stop offset="100%" stopColor="var(--gain)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* horizontal gridlines */}
              {niceTicks.map((t, i) => (
                <g key={i}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yAt(t)} y2={yAt(t)} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={t === 0 ? '' : '2 5'} opacity={t === 0 ? 0.8 : 0.4} />
                  <text x={W - PAD_R + 10} y={yAt(t) + 3} textAnchor="start" fontSize="10" fontFamily="Geist Mono, monospace" fill="var(--text-tertiary)">{t === 0 ? '$0' : '$' + (t / 1000) + 'k'}</text>
                </g>
              ))}
              {/* area fill */}
              <path d={areaPath} fill="url(#eqFill)" stroke="none" />
              {/* line */}
              <path d={linePath} fill="none" stroke="var(--gain-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* end marker */}
              {(() => {
                const last = points[points.length - 1];
                const x = xAt(points.length - 1);
                const y = yAt(last);
                return (
                  <g>
                    <circle cx={x} cy={y} r="6" fill="var(--gain-text)" opacity="0.18" />
                    <circle cx={x} cy={y} r="3.5" fill="var(--gain-text)" />
                  </g>
                );
              })()}
            </svg>
          );
        })()}

        {/* Month strip — separate row below the curve */}
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>By month</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }} className="mono">range −$1.3k → +$12.1k</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${AN_MONTHLY.length}, 1fr)`, gap: 4 }}>
            {AN_MONTHLY.map(d => {
              const win = d.v >= 0;
              return (
                <div key={d.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: win ? 'var(--gain-text)' : 'var(--loss-text)', letterSpacing: '-0.01em' }}>
                    {(d.v >= 0 ? '+' : '−') + '$' + Math.abs(d.v / 1000).toFixed(1) + 'k'}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{d.m}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two columns: category + strategy attribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>P&amp;L by category</h3>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            {AN_CATEGORIES.map(c => (
              <div key={c.cat} style={{ width: `${c.pct}%`, background: c.color }} title={`${c.cat} ${c.pct}%`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AN_CATEGORIES.map(c => (
              <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{c.cat}</span>
                <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{c.trades} trades</span>
                <span className="mono" style={{ color: 'var(--gain-text)', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{c.pnl}</span>
                <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11, minWidth: 32, textAlign: 'right' }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>P&amp;L by strategy</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {AN_STRATEGIES.map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                  </span>
                  <span className="mono" style={{ color: 'var(--gain-text)', fontWeight: 600 }}>{s.pnl}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${s.share}%`, height: '100%', background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top winners/losers + Factor exposure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Top movers</h3>
          </div>
          <table className="adm-table">
            <thead><tr><th>Market</th><th style={{ textAlign: 'right' }}>P&L</th><th style={{ textAlign: 'right' }}>Return</th></tr></thead>
            <tbody>
              {AN_TOP.map(t => {
                const win = t.pnl.startsWith('+');
                return (
                  <tr key={t.ticker}>
                    <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{t.ticker}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{t.pnl}</td>
                    <td className="mono" style={{ textAlign: 'right', color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{t.pct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Factor exposure</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {AN_FACTORS.map(f => (
              <div key={f.f}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.f}</span>
                  <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{f.v.toFixed(2)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${f.v * 100}%`, height: '100%', background: 'var(--accent-default)' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 10, fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', borderRadius: 4, lineHeight: 1.5 }}>
            High momentum + sentiment exposure · Low reversal · Tilted toward growth-of-conviction trading style.
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);