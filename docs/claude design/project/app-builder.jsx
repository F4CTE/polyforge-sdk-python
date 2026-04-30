/* Polyforge — Builder
   Visual canvas with palette + property inspector. */

const PAL_GROUPS = [
  { label: 'Sources', kind: 'source', items: [
    { icon: 'database',   name: 'Polymarket', sub: 'Market data feed' },
    { icon: 'database',   name: 'Kalshi',     sub: 'Market data feed' },
    { icon: 'rss',        name: 'News feed',  sub: 'Realtime headlines' },
    { icon: 'trending',   name: 'Whale flow', sub: 'Large position changes' },
  ]},
  { label: 'Features', kind: 'feat', items: [
    { icon: 'sigma',      name: 'EMA',         sub: 'Exponential moving avg' },
    { icon: 'sigma',      name: 'RSI',         sub: 'Relative strength' },
    { icon: 'sigma',      name: 'Z-score',     sub: 'Standard deviations' },
    { icon: 'flame',      name: 'Volatility',  sub: 'Realized vol window' },
    { icon: 'sigma',      name: 'Spread',      sub: 'Bid-ask delta' },
  ]},
  { label: 'Logic', kind: 'signal', items: [
    { icon: 'zap',        name: 'Threshold',   sub: 'value > X' },
    { icon: 'zap',        name: 'Cross',       sub: 'A crosses B' },
    { icon: 'zap',        name: 'AND / OR',    sub: 'Combine signals' },
    { icon: 'zap',        name: 'Time gate',   sub: 'Only during window' },
  ]},
  { label: 'Risk & Execution', kind: 'risk', items: [
    { icon: 'shield',     name: 'Position cap', sub: 'Max % of capital' },
    { icon: 'shield',     name: 'Loss limit',   sub: 'Daily / weekly cap' },
    { icon: 'send',       name: 'Limit order',  sub: 'At specific price' },
    { icon: 'send',       name: 'TWAP',         sub: 'Time-weighted avg' },
    { icon: 'logout',     name: 'Take profit',  sub: 'Exit at +X%' },
    { icon: 'logout',     name: 'Stop loss',    sub: 'Exit at −X%' },
  ]},
];

const CANVAS_BLOCKS = [
  { id: 'src',   icon: 'database', title: 'Polymarket',   subtitle: 'FED-CUT-JUL · yes',   kind: 'source',   x: 40,  y: 60 },
  { id: 'feat1', icon: 'sigma',    title: 'EMA(20)',      subtitle: 'on yes_price',         kind: 'feat',     x: 240, y: 30 },
  { id: 'feat2', icon: 'trending', title: 'Whale flow',   subtitle: '6h net buy',           kind: 'feat',     x: 240, y: 130 },
  { id: 'sig',   icon: 'zap',      title: 'AND',          subtitle: 'price>EMA & flow>$50k', kind: 'signal',   x: 440, y: 80, selected: true },
  { id: 'risk',  icon: 'shield',   title: 'Position cap', subtitle: 'max 12% capital',      kind: 'risk',     x: 640, y: 80 },
  { id: 'exec',  icon: 'send',     title: 'Limit order',  subtitle: 'TWAP 5m',              kind: 'risk',     x: 840, y: 80 },
];
const EDGES = [['src','feat1'],['src','feat2'],['feat1','sig'],['feat2','sig'],['sig','risk'],['risk','exec']];

function colorForKind(k) {
  return ({ source: 'var(--accent-text)', feat: '#a78bfa', signal: 'var(--gain-text)', risk: 'var(--warn-text)' })[k] || 'var(--text-secondary)';
}

function App() {
  const blockMap = Object.fromEntries(CANVAS_BLOCKS.map(b => [b.id, b]));

  return (
    <UsrShell active="builder" title="Builder" actions={
      <>
        <button className="adm-btn adm-btn-ghost adm-btn-sm"><AdmIcon name="undo" size={12} />Undo</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="flask" size={12} />Backtest</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="play" size={12} />Run paper</button>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="save" size={12} />Save</button>
      </>
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <input
          defaultValue="fed-rate-cut-tracker"
          style={{ background: 'transparent', border: 0, fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 6, outline: 'none', flex: 1, maxWidth: 360 }}
        />
        <span className="adm-pill is-warn">UNSAVED · v10</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>autosave 8s ago</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 14, height: 'calc(100vh - 220px)', minHeight: 620 }}>
        {/* Palette */}
        <div className="adm-card" style={{ padding: 0, overflowY: 'auto' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
            <div className="adm-search" style={{ height: 28 }}>
              <AdmIcon name="search" size={11} />
              <input placeholder="Search blocks..." />
            </div>
          </div>
          {PAL_GROUPS.map(g => (
            <div key={g.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '0 14px 6px' }}>{g.label}</div>
              {g.items.map(it => (
                <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'grab', borderLeft: '2px solid transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderLeftColor = colorForKind(g.kind); }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: colorForKind(g.kind), border: '1px solid var(--border-subtle)' }}>
                    <AdmIcon name={it.icon} size={11} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{it.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 10, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.6 }} />
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 6 }}>
            <div className="adm-filter-group" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: 4, borderRadius: 8 }}>
              <button className="adm-filter is-active">Graph</button>
              <button className="adm-filter">Code</button>
              <button className="adm-filter">YAML</button>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, display: 'flex', gap: 4 }}>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: 28, padding: 0, justifyContent: 'center' }}><AdmIcon name="minus" size={12} /></button>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', height: 26, borderRadius: 5, fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>100%</span>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: 28, padding: 0, justifyContent: 'center' }}><AdmIcon name="plus" size={12} /></button>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: 28, padding: 0, justifyContent: 'center', marginLeft: 4 }} title="Fit"><AdmIcon name="refresh" size={12} /></button>
          </div>

          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="bld-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-tertiary)" />
              </marker>
            </defs>
            {EDGES.map(([a, b], i) => {
              const A = blockMap[a], B = blockMap[b];
              const x1 = A.x + 168, y1 = A.y + 38;
              const x2 = B.x, y2 = B.y + 38;
              const mx = (x1 + x2) / 2;
              return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" markerEnd="url(#bld-arrow)" opacity="0.7" />;
            })}
          </svg>

          {CANVAS_BLOCKS.map(b => (
            <div key={b.id} style={{
              position: 'absolute', left: b.x, top: b.y, width: 168, minHeight: 76,
              background: 'var(--bg-surface)',
              border: `1.5px solid ${b.selected ? 'var(--accent-default)' : 'var(--border-default)'}`,
              borderRadius: 8, padding: 12,
              boxShadow: b.selected ? '0 0 0 4px var(--accent-subtle)' : '0 1px 0 rgba(0,0,0,0.04)',
              cursor: 'grab',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: colorForKind(b.kind), border: '1px solid var(--border-subtle)' }}>
                  <AdmIcon name={b.icon} size={12} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', lineHeight: 1.4 }}>{b.subtitle}</div>
              {/* Connection ports */}
              <div style={{ position: 'absolute', left: -5, top: 32, width: 10, height: 10, borderRadius: 99, background: 'var(--bg-surface)', border: '1.5px solid var(--text-tertiary)' }} />
              <div style={{ position: 'absolute', right: -5, top: 32, width: 10, height: 10, borderRadius: 99, background: 'var(--text-tertiary)', border: '1.5px solid var(--bg-surface)' }} />
            </div>
          ))}

          {/* Status bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)' }}>
            <span><span style={{ color: 'var(--gain-text)' }}>●</span> 6 blocks · 6 connections · valid</span>
            <span style={{ marginLeft: 'auto' }}>Latency budget · 12ms / 50ms</span>
          </div>
        </div>

        {/* Inspector */}
        <div className="adm-card" style={{ padding: 0, overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--gain-text)', border: '1px solid var(--border-subtle)' }}>
                <AdmIcon name="zap" size={12} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AND signal</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Combine 2+ signals · output triggers when all are true</div>
          </div>

          {[
            { label: 'Inputs', items: [
              { k: 'A', v: 'EMA(20) cross', meta: 'feat1.crossed_above' },
              { k: 'B', v: 'Whale flow > $50k', meta: 'feat2.cumulative_buy' },
            ]},
          ].map(grp => (
            <div key={grp.label} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>{grp.label}</div>
              {grp.items.map(it => (
                <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--accent-subtle)', color: 'var(--accent-text)', display: 'grid', placeItems: 'center', fontFamily: 'Geist Mono, monospace', fontSize: 10, fontWeight: 600 }}>{it.k}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{it.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{it.meta}</div>
                  </div>
                  <button className="row-action"><AdmIcon name="x" size={11} /></button>
                </div>
              ))}
              <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: '100%', marginTop: 6 }}><AdmIcon name="plus" size={11} />Add input</button>
            </div>
          ))}

          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Behavior</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Trigger</label>
              <select style={{ width: '100%', height: 30, padding: '0 10px', background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit' }}>
                <option>All true (AND)</option>
                <option>Any true (OR)</option>
                <option>Exactly N true</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Cooldown</label>
              <input defaultValue="15m" style={{ width: '100%', height: 30, padding: '0 10px', background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Geist Mono, monospace' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <input type="checkbox" defaultChecked /> Only during market hours
            </div>
          </div>

          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Last 24h</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'Geist Mono, monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Triggers</span><span>14</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Acted on</span><span>14</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Skipped (risk gate)</span><span>0</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Avg latency</span><span>4.2ms</span></div>
            </div>
          </div>
        </div>
      </div>

    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
