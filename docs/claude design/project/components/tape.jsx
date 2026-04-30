// ------- Live price tape with flash -------
function Tape() {
  const tape = useTicker(MARKETS, { interval: 2000 });
  const items = [...tape, ...tape];
  return (
    <div aria-hidden="true" style={{
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
      padding: '12px 0',
    }}>
      <div className="tape-track" style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', willChange: 'transform' }}>
        {items.map((m, i) => (
          <div key={i} className={`mono ${m._flash ? 'flash-' + m._flash : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.sym}</span>
            <span className="tabnum" style={{ color: 'var(--text-secondary)' }}>¢{Math.round(m.px * 100)}</span>
            <span className={`tabnum ${m.chg >= 0 ? 'text-gain' : 'text-loss'}`}>
              {m.chg >= 0 ? '+' : ''}{m.chg.toFixed(1)}%
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>{m.vol}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------- Dashboard mock with hover crosshair on equity chart -------
function DashboardMock() {
  const live = useTicker([
    { sym: "US Election 2028", vol: "$1.2M", px: 0.42, chg: +2.4 },
    { sym: "BTC > $150k by Dec", vol: "$840K", px: 0.31, chg: -1.1 },
    { sym: "Fed Rate Cut · Jul", vol: "$620K", px: 0.73, chg: +4.2 },
    { sym: "ETH Spot ETF · Q2", vol: "$2.1M", px: 0.88, chg: +0.6 },
    { sym: "NVDA Earnings Beat", vol: "$1.4M", px: 0.81, chg: +1.2 },
  ], { interval: 2200 });

  // Equity data for crosshair tooltip
  const points = [
    { x: 0, y: 62, v: 10000 }, { x: 50, y: 52, v: 10180 }, { x: 100, y: 48, v: 10290 },
    { x: 150, y: 50, v: 10260 }, { x: 200, y: 38, v: 10520 }, { x: 260, y: 32, v: 10710 },
    { x: 310, y: 20, v: 10980 }, { x: 400, y: 10, v: 11830 },
  ];
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const onMove = (e) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    // find closest point
    let best = points[0], d = Math.abs(points[0].x - x);
    for (const p of points) { const dd = Math.abs(p.x - x); if (dd < d) { d = dd; best = p; } }
    setHover(best);
  };

  return (
    <div className="browser">
      <div className="browser-chrome">
        <div className="browser-dots"><span/><span/><span/></div>
        <div className="browser-path">app.polyforge.com · portfolio</div>
        <span className="chip" style={{ height: 20, gap: 6, background: 'color-mix(in srgb, var(--gain) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--gain) 30%, transparent)', color: 'var(--gain-text)' }}>
          <span className="status-dot status-dot-live" style={{ width: 5, height: 5 }}/>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>live</span>
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Top stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="t-caption text-tertiary">Total P&amp;L</div>
            <div className="tabnum mono text-gain" style={{ fontSize: 20, fontWeight: 600, marginTop: 2, letterSpacing: '-0.01em' }}>+$2,847</div>
            <div className="t-caption text-gain tabnum">+18.3%</div>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="t-caption text-tertiary">Win rate</div>
            <div className="tabnum mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 2, letterSpacing: '-0.01em' }}>67.2%</div>
            <div className="t-caption text-tertiary tabnum">142/212</div>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
            <div className="t-caption text-tertiary">Strategies</div>
            <div className="tabnum mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 2, letterSpacing: '-0.01em' }}>3</div>
            <div className="t-caption text-accent tabnum">2 paper · 1 live</div>
          </div>
        </div>

        {/* Equity chart with crosshair */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px', marginBottom: 12, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="t-label text-secondary">Equity curve · 30d</span>
            <span className="tabnum mono text-gain" style={{ fontSize: 12 }}>
              {hover ? `$${hover.v.toLocaleString()}` : '+18.3%'}
            </span>
          </div>
          <svg ref={svgRef} width="100%" height="80" viewBox="0 0 400 80" preserveAspectRatio="none"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)}
            style={{ cursor: 'crosshair' }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <g stroke="var(--border-subtle)" strokeWidth="0.5">
              <line x1="0" y1="20" x2="400" y2="20"/>
              <line x1="0" y1="40" x2="400" y2="40"/>
              <line x1="0" y1="60" x2="400" y2="60"/>
            </g>
            <path d="M0 62 L 50 52 L 100 48 L 150 50 L 200 38 L 260 32 L 310 20 L 400 10 L 400 80 L 0 80 Z" fill="url(#eqGrad)"/>
            <path d="M0 62 L 50 52 L 100 48 L 150 50 L 200 38 L 260 32 L 310 20 L 400 10" fill="none" stroke="var(--accent-default)" strokeWidth="1.5"/>
            <circle cx="400" cy="10" r="3" fill="var(--accent-default)"/>
            <circle cx="400" cy="10" r="6" fill="var(--accent-default)" opacity="0.25"/>
            {hover && (
              <g>
                <line x1={hover.x} y1="0" x2={hover.x} y2="80" stroke="var(--accent-default)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
                <circle cx={hover.x} cy={hover.y} r="3.5" fill="var(--accent-default)"/>
                <circle cx={hover.x} cy={hover.y} r="7" fill="var(--accent-default)" opacity="0.2"/>
              </g>
            )}
          </svg>
        </div>

        {/* Markets table */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', padding: '8px 14px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)' }} className="mono">
            <span>Market</span><span style={{ textAlign: 'right' }}>Yes</span><span style={{ textAlign: 'right' }}>Δ</span>
          </div>
          {live.map((m, i) => (
            <div key={m.sym} className={m._flash ? `flash-${m._flash}` : ''}
              style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', padding: '10px 14px', fontSize: 13, borderBottom: i < live.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-primary)' }}>{m.sym}</span>
              <span className="tabnum mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>¢{Math.round(m.px * 100).toString().padStart(2, '0')}</span>
              <span className={`tabnum mono ${m.chg >= 0 ? 'text-gain' : 'text-loss'}`} style={{ textAlign: 'right' }}>{m.chg >= 0 ? '+' : ''}{m.chg.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------- Strategy builder canvas (unchanged) -------
function BuilderCanvas({ compact = false }) {
  const h = compact ? 340 : 440;
  const CANVAS_W = 740;
  const stageRef = React.useRef(null);
  const innerRef = React.useRef(null);
  React.useEffect(() => {
    const stage = stageRef.current, inner = innerRef.current;
    if (!stage || !inner) return;
    const fit = () => {
      const w = stage.clientWidth;
      const pad = 16; // breathing room
      const scale = Math.min(1, (w - pad) / CANVAS_W);
      inner.style.transform = `scale(${scale})`;
      // Also compress vertically since contents are scaled
      inner.style.height = ((h - 42) / scale) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [h]);
  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      height: h,
      overflow: 'hidden',
      backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
      backgroundSize: '16px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', position: 'relative', zIndex: 2 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>momentum-α3.polyforge</span>
        <span className="chip" style={{ height: 20 }}><span className="dot dot-pulse"/> running · 42ms</span>
        <span style={{ marginLeft: 'auto' }} className="chip accent">paper</span>
      </div>
      <div ref={stageRef} style={{ position: 'absolute', top: 42, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div ref={innerRef} style={{ position: 'relative', width: CANVAS_W, height: h - 42, transformOrigin: 'top left' }}>
          <svg width={CANVAS_W} height={h - 42} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" fill="var(--accent-text)"/>
              </marker>
            </defs>
            <path d="M 180,70 C 230,70 260,140 310,140" stroke="var(--accent-text)" strokeWidth="1.5" fill="none" opacity="0.6"/>
            <path d="M 180,180 C 230,180 260,140 310,140" stroke="var(--accent-text)" strokeWidth="1.5" fill="none" opacity="0.6"/>
            <path d="M 450,140 C 510,140 530,70 580,70"  stroke="var(--accent-text)" strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#arrow)"/>
            <path d="M 450,140 C 510,140 530,220 580,220" stroke="var(--accent-text)" strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#arrow)"/>
          </svg>
          <Node top={44} left={24}  cat="trigger"   title="price_above_tick"     detail="YES ≥ 0.65"/>
          <Node top={154} left={24} cat="trigger"   title="volume_rate_tick"     detail="vol > 10k/24h"/>
          <Node top={110} left={310} cat="condition" title="max_position"        detail="$500 · 5% port"/>
          <Node top={40}  left={580} cat="action"    title="buy_yes"             detail="GTC · Kelly"/>
          <Node top={190} left={580} cat="action"    title="set_stop_loss"       detail="−8% trailing"/>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, pointerEvents: 'none' }} className="mono">
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>blocks: 5 · edges: 4 · tick 200ms</span>
      </div>
    </div>
  );
}

function Node({ top, left, cat, title, detail }) {
  const colorByCat = {
    trigger: 'var(--accent-text)',
    condition: 'var(--color-purple-400)',
    action: 'var(--gain-text)',
    safety: 'var(--warning)',
  };
  return (
    <div style={{
      position: 'absolute', top, left,
      width: 140,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: `2px solid ${colorByCat[cat]}`,
      borderRadius: 8,
      padding: '8px 10px',
      boxShadow: 'var(--shadow-2)',
    }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: colorByCat[cat] }}>{cat}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>{title}</div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{detail}</div>
    </div>
  );
}

Object.assign(window, { Tape, DashboardMock, BuilderCanvas });
