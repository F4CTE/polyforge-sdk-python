/* Polyforge — Strategy detail
   Header KPIs · equity curve · block diagram · trades · risk · backtest summary · params */

const SD_FILLS = [
  { t: '14:24:08', mk: 'FED-CUT-JUL', side: 'YES', sz: 420, px: 73, val: '+$306', kind: 'gain' },
  { t: '13:47:18', mk: 'FED-CUT-JUL', side: 'YES', sz: 200, px: 72, val: '+$142', kind: 'gain' },
  { t: '12:14:42', mk: 'FED-CUT-JUL', side: 'YES', sz: 320, px: 71, val: '+$224', kind: 'gain' },
  { t: '11:38:09', mk: 'FED-CUT-JUL', side: 'NO',  sz: 80,  px: 28, val: '−$18',  kind: 'loss' },
  { t: '10:52:14', mk: 'FED-CUT-JUL', side: 'YES', sz: 240, px: 70, val: '+$168', kind: 'gain' },
  { t: '09:46:21', mk: 'FED-CUT-JUL', side: 'YES', sz: 180, px: 68, val: '+$108', kind: 'gain' },
  { t: '09:14:08', mk: 'FED-CUT-JUL', side: 'YES', sz: 100, px: 66, val: '+$54',  kind: 'gain' },
];

const SD_BLOCKS = [
  { id: 'src',   icon: 'database',  title: 'Source',     subtitle: 'Polymarket · FED-CUT-JUL',   kind: 'source',   x: 0,  y: 0 },
  { id: 'feat',  icon: 'sigma',     title: 'EMA(20)',    subtitle: 'on yes_price',                kind: 'feat',     x: 1,  y: 0 },
  { id: 'feat2', icon: 'sigma',     title: 'Whale flow', subtitle: '6h net buy > $50k',           kind: 'feat',     x: 1,  y: 1 },
  { id: 'sig',   icon: 'zap',       title: 'Signal',     subtitle: 'price > EMA & whale +',       kind: 'signal',   x: 2,  y: 0 },
  { id: 'risk',  icon: 'shield',    title: 'Risk gate',  subtitle: 'max 12% capital · 1 pos',     kind: 'risk',     x: 3,  y: 0 },
  { id: 'exec',  icon: 'send',      title: 'Execute',    subtitle: 'limit ¢73 · TWAP 5m',         kind: 'exec',     x: 4,  y: 0 },
  { id: 'exit',  icon: 'logout',    title: 'Exit',       subtitle: 'TP +20% · SL −8% · resolve',  kind: 'exit',     x: 5,  y: 0 },
];

function BlockCanvas() {
  const cellW = 168, cellH = 84, gapX = 28, gapY = 16;
  const cols = 6, rows = 2;
  const w = cols * cellW + (cols - 1) * gapX + 32;
  const h = rows * cellH + (rows - 1) * gapY + 32;
  const colorFor = k => ({
    source: 'var(--accent-text)',
    feat: '#a78bfa',
    signal: 'var(--gain-text)',
    risk: 'var(--warn-text)',
    exec: 'var(--accent-text)',
    exit: 'var(--text-secondary)',
  }[k]);
  const pos = (b) => ({ x: 16 + b.x * (cellW + gapX), y: 16 + b.y * (cellH + gapY) });
  // edges by id pairs
  const edges = [
    ['src','feat'], ['src','feat2'], ['feat','sig'], ['feat2','sig'],
    ['sig','risk'], ['risk','exec'], ['exec','exit'],
  ];
  const blockMap = Object.fromEntries(SD_BLOCKS.map(b => [b.id, b]));
  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 0 }}>
      <div style={{ position: 'relative', width: w, height: h, backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={w} height={h}>
          <defs>
            <marker id="sd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-tertiary)" />
            </marker>
          </defs>
          {edges.map(([a, b], i) => {
            const A = pos(blockMap[a]), B = pos(blockMap[b]);
            const x1 = A.x + cellW, y1 = A.y + cellH / 2;
            const x2 = B.x, y2 = B.y + cellH / 2;
            const mx = (x1 + x2) / 2;
            const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            return <path key={i} d={d} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.4" markerEnd="url(#sd-arrow)" opacity="0.7" />;
          })}
        </svg>
        {SD_BLOCKS.map(b => {
          const p = pos(b);
          return (
            <div key={b.id} style={{
              position: 'absolute', left: p.x, top: p.y, width: cellW, height: cellH,
              background: 'var(--bg-surface)', border: `1px solid var(--border-default)`,
              borderRadius: 8, padding: 12, boxShadow: '0 1px 0 rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: colorFor(b.kind), border: '1px solid var(--border-subtle)' }}>
                  <AdmIcon name={b.icon} size={12} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', lineHeight: 1.4 }}>{b.subtitle}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const equity = [];
  let v = 5000;
  for (let i = 0; i < 90; i++) {
    v = v + (Math.sin(i * 0.27) * 35) + 20 + (i > 60 ? 8 : 0);
    equity.push(v);
  }

  return (
    <UsrShell active="strategy" title="fed-rate-cut-tracker" crumbs={[{ label: 'Strategies', href: 'App-Strategies.html' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="copy" size={12} />Clone</button>
        <a className="adm-btn adm-btn-secondary" href="App-Builder.html"><AdmIcon name="hammer" size={12} />Edit blocks</a>
        <button className="adm-btn adm-btn-danger"><AdmIcon name="pause" size={12} />Pause</button>
      </>
    }>

      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flexShrink: 0 }}>
          <AdmIcon name="blocks" size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>fed-rate-cut-tracker</h1>
            <span className="adm-pill is-gain has-dot is-pulse">RUNNING</span>
            <span className="adm-pill is-gain">LIVE</span>
            <UsrVenueBadge venue="polymarket" />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 720, lineHeight: 1.5 }}>
            Long YES on FED-CUT-JUL when 20-period EMA breaks resistance and aggregate whale flow turns positive over a 6h window. Exits on +20% / −8% / resolution.
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>
            <span>Created Mar 14 · 28d ago</span>
            <span>·</span>
            <span>9 versions · v9 active</span>
            <span>·</span>
            <span>Last fill 14:24:08 UTC</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Equity" value="$6,847.20" delta="+18.4% · 30d" deltaKind="gain" />
        <AdmStat label="Today's P&L" value="+$284.10" delta="+4.3%" deltaKind="gain" />
        <AdmStat label="Win rate · 30d" value="74.2%" delta="184 / 248" deltaKind="neutral" />
        <AdmStat label="Sharpe · 30d" value="2.81" delta="max DD −4.2%" deltaKind="neutral" />
      </div>

      {/* Equity + risk panel */}
      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Equity · 90d</h3>
            <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
              <button className="adm-filter">7d</button>
              <button className="adm-filter">30d</button>
              <button className="adm-filter is-active">90d</button>
              <button className="adm-filter">all</button>
            </div>
          </div>
          <UsrEquityCurve points={equity} kind="gain" height={180} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total return</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--gain-text)', fontWeight: 600 }}>+36.9%</div></div>
            <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>CAGR</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>184.2%</div></div>
            <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Profit factor</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>3.42</div></div>
            <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Avg trade</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>+$74</div></div>
          </div>
        </div>

        <div className="adm-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AdmIcon name="shield" size={14} />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Risk gates</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gain-text)', fontFamily: 'Geist Mono, monospace' }}>● HEALTHY</span>
          </div>
          {[
            { label: 'Capital deployed',    val: '$1,840 / $5,000', pct: 36.8, kind: 'gain' },
            { label: 'Daily loss · today',  val: '−$0 / −$250',     pct: 0,    kind: 'gain' },
            { label: 'Max position',        val: '1 / 1',           pct: 100,  kind: 'gain' },
            { label: 'Open exposure · YES', val: '$1,840',          pct: 36.8, kind: 'gain' },
            { label: 'Concentration risk',  val: '1 market',        pct: 100,  kind: 'warn' },
            { label: 'Slippage · 24h avg',  val: '0.4¢',            pct: 8,    kind: 'gain' },
          ].map(r => (
            <div key={r.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>{r.val}</span>
              </div>
              <div className={`usr-fill-gauge${r.kind === 'gain' ? ' is-gain' : ''}${r.kind === 'warn' ? '' : ''}`} style={{ background: 'var(--bg-app)' }}>
                <span style={{ width: `${r.pct}%`, background: r.kind === 'warn' ? 'var(--warn)' : 'var(--gain)' }} />
              </div>
            </div>
          ))}
          <button className="adm-btn adm-btn-secondary" style={{ width: '100%', marginTop: 4 }}>Edit risk limits</button>
        </div>
      </div>

      {/* Block diagram */}
      <AdmSectionHead title="Logic graph" action={<a href="App-Builder.html" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Open in builder →</a>} />
      <div style={{ marginBottom: 24 }}>
        <BlockCanvas />
      </div>

      {/* Two columns: trades + params/backtest */}
      <div className="adm-grid-2">
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent fills</span>
            <span className="adm-pill is-gain" style={{ marginLeft: 4 }}>248 · 30d</span>
            <a href="App-Orders.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All trades →</a>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Side</th>
                <th>Size</th>
                <th>Px</th>
                <th className="col-num">P&L</th>
              </tr>
            </thead>
            <tbody>
              {SD_FILLS.map((f, i) => (
                <tr key={i}>
                  <td className="col-mono col-tertiary">{f.t}</td>
                  <td><span className={`adm-pill ${f.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 18, fontSize: 10 }}>{f.side}</span></td>
                  <td className="col-num">{f.sz}</td>
                  <td className="col-mono">¢{f.px}</td>
                  <td className="col-num" style={{ color: f.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>{f.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AdmIcon name="flask" size={14} />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Backtest</h3>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>2024-01-01 → 2025-04-22</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>BACKTEST RETURN</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--gain-text)', fontWeight: 600 }}>+212.8%</div></div>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>LIVE RETURN</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--gain-text)', fontWeight: 600 }}>+36.9%</div></div>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>BT WIN RATE</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>71.4%</div></div>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>LIVE WIN RATE</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>74.2%</div></div>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>BT SHARPE</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>2.42</div></div>
              <div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>LIVE SHARPE</div><div style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>2.81</div></div>
            </div>
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6 }}>
              <AdmIcon name="info" size={12} />
              <span>Live performance is tracking <strong style={{ color: 'var(--gain-text)' }}>+3.1%</strong> above backtest expectations.</span>
            </div>
          </div>

          <div className="adm-card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
              <AdmIcon name="settings" size={14} style={{ marginRight: 8 }} />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Parameters</h3>
              <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginLeft: 'auto' }}><AdmIcon name="edit" size={11} />Edit</button>
            </div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11.5 }}>
              {[
                ['ema.period',           '20'],
                ['ema.source',           'yes_price'],
                ['whale.window',         '6h'],
                ['whale.threshold',      '$50,000'],
                ['risk.max_position',    '12% capital'],
                ['risk.daily_loss_cap',  '−$250'],
                ['exit.take_profit',     '+20%'],
                ['exit.stop_loss',       '−8%'],
                ['exec.order_type',      'limit'],
                ['exec.twap_window',     '5m'],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: i < 9 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
