/* Design System — section components.
   Each section is a self-contained block; the app file just renders them. */

const { useState, useEffect, useRef, useCallback } = React;

/* ---- Copy helper ---- */
function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea'); ta.value = text;
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  return Promise.resolve();
}

/* ---- Hex prism mark ---- */
function PrismMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          <path d="M12 11.7 L4.5 8 M12 11.7 L19.5 8 M12 11.7 V22" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 5.5v3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M6.15 15.25l2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M17.85 15.25l-2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  );
}

function Section({ id, num, eyebrow, title, sub, children }) {
  return (
    <section id={id} className="ds-section">
      <header className="ds-section-head">
        <div className="ds-section-eyebrow">
          <span className="num">{num}</span>
          <span>{eyebrow}</span>
        </div>
        <h2 className="ds-section-title">{title}</h2>
        {sub && <p className="ds-section-sub">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

function Sub({ children }) { return <div className="ds-sub">{children}</div>; }

function Swatch({ token, name, darkHex, lightHex, theme, onCopy }) {
  const hex = theme === 'light' ? lightHex : darkHex;
  const [copied, setCopied] = useState(false);
  const handle = () => {
    copyToClipboard(`var(${token})`);
    onCopy(`var(${token})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };
  return (
    <div className={`ds-swatch${copied ? ' is-copied' : ''}`} onClick={handle} title="Click to copy CSS variable">
      <div className="ds-swatch-fill"><div className="fill" style={{ background: hex }} /></div>
      <div className="ds-swatch-meta">
        <div className="ds-swatch-name">
          <span>{name}</span>
          <span className="copy">{copied ? '✓' : '⧉'}</span>
        </div>
        <div className="ds-swatch-token">{token}</div>
        <div className="ds-swatch-hex">{hex}</div>
      </div>
    </div>
  );
}

/* ===== 00 OVERVIEW ===== */
function OverviewSection() {
  return (
    <Section id="overview" num="00" eyebrow="Overview" title="What this is"
      sub="Polyforge ships across five surfaces — Marketing, Docs, User Guide, Auth, and the Admin control room — that share one set of tokens and two complementary component layers.">
      <div className="ds-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {[
          ['Two surfaces',  'Marketing-layer (.btn, .chip, .card) and Admin-layer (.adm-*). Same tokens, different density.'],
          ['One token set', '~70 CSS variables. Theme via data-theme="dark|light"; brand via data-accent.'],
          ['Two icon sets', '<Icon /> for marketing/docs/auth, <AdmIcon /> for admin. Stroke 1.5–1.6 on a 24-unit grid.'],
          ['Two type roles', 'Geist for UI, Geist Mono for IDs/numbers/code. Tabular numerals everywhere money appears.'],
        ].map(([h, p]) => (
          <div key={h} className="ds-card"><div className="ds-card-body">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{h}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p}</div>
          </div></div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 01 BRAND ===== */
function BrandSection() {
  return (
    <Section id="brand" num="01" eyebrow="Brand" title="Mark, wordmark, and lockups"
      sub="The Polyforge mark is a hexagonal prism — a forge of converging facets. Three short center marks reinforce the meeting point of the three visible faces, reading as a moment of convergence at any size.">
      <Sub>Primary mark</Sub>
      <div className="ds-brand-grid">
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-dark"><PrismMark size={64} /></div>
          <div className="ds-brand-foot"><strong>Mark · dark</strong> · #F0F1F5 on #0E0F11</div>
        </div>
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-light" style={{ color: '#0E0F11' }}><PrismMark size={64} /></div>
          <div className="ds-brand-foot"><strong>Mark · light</strong> · #0E0F11 on #FAFAFA</div>
        </div>
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-accent"><PrismMark size={64} /></div>
          <div className="ds-brand-foot"><strong>Mark · accent</strong> · #FFFFFF on #4F6EF7</div>
        </div>
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-grid" style={{ color: '#7B96FF' }}><PrismMark size={64} /></div>
          <div className="ds-brand-foot"><strong>Mark · grid</strong> · accent on subtle grid</div>
        </div>
      </div>

      <Sub>Wordmark</Sub>
      <div className="ds-brand-grid">
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-dark">
            <span className="ds-wordmark" style={{ fontSize: 28 }}><span className="mark"><PrismMark size={28} /></span>Polyforge</span>
          </div>
          <div className="ds-brand-foot"><strong>Standard lockup</strong> · mark + Geist 600</div>
        </div>
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-dark">
            <span className="ds-wordmark" style={{ fontSize: 22 }}>
              <span className="mark"><PrismMark size={22} /></span>
              <span>Polyforge <em style={{ fontStyle: 'normal', color: 'var(--text-tertiary)', fontWeight: 400 }}>· Admin</em></span>
            </span>
          </div>
          <div className="ds-brand-foot"><strong>Surface lockup</strong> · admin/auth/docs chrome</div>
        </div>
        <div className="ds-brand-tile">
          <div className="ds-brand-stage is-dark">
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>polyforge.app</span>
          </div>
          <div className="ds-brand-foot"><strong>URL form</strong> · Geist Mono in tertiary text</div>
        </div>
      </div>

      <Sub>Anatomy</Sub>
      <div className="ds-anatomy">
        <div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 24, display: 'grid', placeItems: 'center', minHeight: 220 }}>
            <svg width="180" height="180" viewBox="0 0 24 24" fill="none">
              <g stroke="rgba(123,150,255,0.25)" strokeWidth="0.2">
                <line x1="3" y1="0" x2="3" y2="24" /><line x1="12" y1="0" x2="12" y2="24" /><line x1="21" y1="0" x2="21" y2="24" />
                <line x1="0" y1="2" x2="24" y2="2" /><line x1="0" y1="7" x2="24" y2="7" /><line x1="0" y1="12" x2="24" y2="12" /><line x1="0" y1="17" x2="24" y2="17" /><line x1="0" y1="22" x2="24" y2="22" />
              </g>
              <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          <path d="M12 11.7 L4.5 8 M12 11.7 L19.5 8 M12 11.7 V22" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 5.5v3" stroke="var(--accent-text)" strokeWidth="0.9" strokeLinecap="round" />
              <path d="M6.15 15.25l2.7-1.5" stroke="var(--accent-text)" strokeWidth="0.9" strokeLinecap="round" />
              <path d="M17.85 15.25l-2.7-1.5" stroke="var(--accent-text)" strokeWidth="0.9" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div>
          <ul>
            <li><strong style={{ color: 'var(--text-primary)' }}>Geometry.</strong> 24×24 box. Apex (12,2); base apexes at (2,7), (2,17), (12,22), (22,17), (22,7).</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Form.</strong> Wireframe silhouette — outer hex outline plus three Y-seams meeting at (12,11.7). Stroked, not filled.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Convergence stubs.</strong> Top (12,5.5)→(12,8.5). Lower stubs run from face center 30–50% toward (12,12). Always rendered in <span className="ds-mono">var(--accent-text)</span> when over the mark on neutral surfaces.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Stub stroke.</strong> 0.9 — fine, hairline weight. Round caps.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Color.</strong> Mark is <span className="ds-mono">currentColor</span> — inherits from chrome. Use <span className="ds-mono">var(--text-primary)</span> in surfaces, <span className="ds-mono">var(--accent-text)</span> for brand-forward placements.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Clear space.</strong> ½× mark height on every side.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Min size.</strong> 16px (favicon). Below 14px — drop the convergence stubs, silhouette only.</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ===== 02 COLOR ===== */
function ColorSection({ theme, copy }) {
  return (
    <Section id="colors" num="02" eyebrow="Color" title="Tokens, not raw hex"
      sub="Every color in Polyforge is reachable through a CSS variable. Click any swatch to copy its var() reference. Hex values shown match the active theme.">
      {Object.entries(DS.DS_COLORS).map(([key, group]) => (
        <div key={key} style={{ marginBottom: 28 }}>
          <Sub>{group.title}</Sub>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: 720, lineHeight: 1.6 }}>{group.desc}</p>
          <div className="ds-palette">
            {group.swatches.map((sw) => (
              <Swatch key={sw.token} {...sw} theme={theme} onCopy={copy} />
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

/* ===== 03 TYPOGRAPHY ===== */
function TypographySection() {
  return (
    <Section id="typography" num="03" eyebrow="Typography" title="Geist + Geist Mono"
      sub="Geist (Vercel) for UI; Geist Mono for IDs, hashes, code, and any number that must align in a column.">
      <Sub>Families</Sub>
      <div className="ds-grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="ds-card">
          <div className="ds-card-head"><div className="ds-card-title">Geist</div><span className="ds-card-sub">UI · 400/500/600</span></div>
          <div className="ds-card-body">
            <div style={{ fontSize: 56, lineHeight: 1, letterSpacing: '-0.03em' }}>Aa Bb Gg</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, fontFamily: 'Geist Mono, monospace' }}>0123456789 · The forge holds firm.</div>
          </div>
        </div>
        <div className="ds-card">
          <div className="ds-card-head"><div className="ds-card-title">Geist Mono</div><span className="ds-card-sub">Numbers · 400/500/600</span></div>
          <div className="ds-card-body">
            <div style={{ fontSize: 56, lineHeight: 1, fontFamily: 'Geist Mono, monospace' }}>0Aa Gg</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, fontFamily: 'Geist Mono, monospace' }}>0xA1F4·8B22 · 1,247.83 USDC</div>
          </div>
        </div>
      </div>

      <Sub>Type scale</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ padding: '4px 18px' }}>
        {DS.DS_TYPE.map((t) => (
          <div className="ds-type-row" key={t.token}>
            <div className="ds-type-meta">
              <span className="role">{t.role}</span>
              {t.token} · {t.size} / {t.weight} / lh {t.lh}
            </div>
            <div className={t.mono ? 'mono' : ''} style={{
              fontSize: t.role === 'Hero' ? 'clamp(28px, 4vw, 48px)' : t.role === 'Display LG' ? 24 : t.role === 'Heading 2' ? 28 : t.role === 'Display SM' ? 18 : t.role === 'Heading' ? 14 : t.role === 'Body' ? 14 : t.role === 'Body SM' ? 13 : t.role === 'Label' ? 12 : t.role === 'Caption' ? 11 : 14,
              fontWeight: t.weight,
              lineHeight: t.lh,
              letterSpacing: t.tracking,
              color: 'var(--text-primary)',
              fontFamily: t.mono ? 'Geist Mono, monospace' : undefined,
            }}>{t.sample}</div>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 04 SPACING ===== */
function SpacingSection() {
  return (
    <Section id="spacing" num="04" eyebrow="Spacing" title="4-based scale"
      sub="Polyforge uses a multiple-of-2 scale rooted at 4px. Section padding 80–112px; card padding 18–20px; component gaps 8–16px.">
      <div className="ds-spacing">
        {DS.DS_SPACING.map((s) => (
          <div className="ds-spacing-row" key={s.name}>
            <div className="ds-spacing-token">space-{s.name}</div>
            <div><div className="ds-spacing-bar" style={{ width: s.px }} /></div>
            <div className="ds-spacing-px">{s.px}px</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 05 RADII ===== */
function RadiiSection() {
  return (
    <Section id="radii" num="05" eyebrow="Radii" title="Corner radius"
      sub="Each radius has a specific home. Don't invent in-between values.">
      <div className="ds-grid-3">
        {DS.DS_RADII.map((r) => (
          <div className="ds-tile" key={r.name} style={{ borderRadius: 8 }}>
            <div className="ds-tile-preview" style={{ borderRadius: r.px === 999 ? 999 : r.px }} />
            <div className="ds-tile-name">Radius {r.name}</div>
            <div className="ds-tile-token">{r.px === 999 ? '999px' : `${r.px}px`} · {r.use}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 06 SHADOWS ===== */
function ShadowsSection() {
  return (
    <Section id="shadows" num="06" eyebrow="Shadows" title="Elevation"
      sub="Polyforge is mostly flat. Elevation is reserved for floating chrome — popovers, tweaks panels, command palette, drawers.">
      <div className="ds-grid-3">
        {DS.DS_SHADOWS.map((s) => (
          <div className="ds-tile" key={s.name} style={{ borderRadius: 8 }}>
            <div className="ds-tile-preview" style={{ borderRadius: 10, boxShadow: s.value === 'none' ? 'none' : s.value, background: 'var(--bg-surface)' }} />
            <div className="ds-tile-name">{s.name}</div>
            <div className="ds-tile-token">{s.token}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>{s.use}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 07 MOTION ===== */
function MotionTile({ name, token, ease, use }) {
  const [phase, setPhase] = useState('idle');
  const puckRef = useRef(null);
  useEffect(() => { const id = setTimeout(() => setPhase('go'), 100); return () => clearTimeout(id); }, []);
  const replay = () => {
    setPhase('reset');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('go'));
    });
  };
  const puckStyle = phase === 'reset'
    ? { transform: 'translateX(0)', transition: 'none', '--ds-motion-dur': token, '--ds-motion-ease': ease }
    : phase === 'go'
    ? { transform: 'translateX(140px)', transition: `transform ${token} ${ease}`, '--ds-motion-dur': token, '--ds-motion-ease': ease }
    : { transform: 'translateX(0)', transition: 'none', '--ds-motion-dur': token, '--ds-motion-ease': ease };
  return (
    <div className="ds-motion-tile" onClick={replay}>
      <div className="ds-motion-stage">
        <div className="ds-motion-puck" ref={puckRef} style={puckStyle} />
      </div>
      <div className="ds-motion-name">{name}</div>
      <div className="ds-motion-token">{token} · {ease}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>{use}</div>
    </div>
  );
}
function MotionSection() {
  const [tick, setTick] = useState(0);
  return (
    <Section id="motion" num="07" eyebrow="Motion" title="Quiet, deterministic, brief"
      sub="Polyforge motion exists to reinforce hierarchy and signal change — never to perform. 120–220ms for transitions; longer durations for orchestrated reveals.">
      <div className="ds-row" style={{ marginBottom: 14 }}>
        <button className="adm-btn adm-btn-secondary" onClick={() => setTick(t => t + 1)}>Replay all ↺</button>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Click a tile to play it.</span>
      </div>
      <div className="ds-motion-grid">
        {DS.DS_MOTION.map((m, i) => (
          <MotionTile key={`${m.name}-${tick}-${i}`} {...m} />
        ))}
      </div>
    </Section>
  );
}

/* ===== 08 ICONS ===== */
function IconSection({ copy }) {
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('admin');
  const [copied, setCopied] = useState('');
  const list = (tab === 'admin' ? DS.DS_ADMIN_ICONS : DS.DS_MARKETING_ICONS).filter(n => n.toLowerCase().includes(filter.toLowerCase()));
  const handle = (n) => {
    const snippet = tab === 'admin' ? `<AdmIcon name="${n}" size={16} />` : `<Icon name="${n}" size={16} />`;
    copyToClipboard(snippet); copy(snippet);
    setCopied(n); setTimeout(() => setCopied(''), 900);
  };
  const IconCmp = tab === 'admin' ? AdmIcon : Icon;
  return (
    <Section id="iconography" num="08" eyebrow="Icons" title="Two complementary sets"
      sub="Stroke 1.5–1.6, 24-unit grid. Marketing/docs/auth in components/icons.jsx; admin in components/admin-icons.jsx. Click to copy snippet.">
      <div className="ds-row" style={{ marginBottom: 14 }}>
        <div className="ds-tabs" style={{ borderBottom: 'none' }}>
          <button className={`ds-tab${tab === 'admin' ? ' is-active' : ''}`} onClick={() => setTab('admin')}>
            Admin <span className="ds-mono ds-muted" style={{ fontSize: 11 }}>· {DS.DS_ADMIN_ICONS.length}</span>
          </button>
          <button className={`ds-tab${tab === 'marketing' ? ' is-active' : ''}`} onClick={() => setTab('marketing')}>
            Marketing <span className="ds-mono ds-muted" style={{ fontSize: 11 }}>· {DS.DS_MARKETING_ICONS.length}</span>
          </button>
        </div>
        <div className="ds-input" style={{ marginLeft: 'auto', minWidth: 220 }}>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" />
        </div>
      </div>
      <div className="ds-icons">
        {list.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No icons match "{filter}"</div>
        ) : list.map((n) => (
          <div key={n} className={`ds-icon-cell${copied === n ? ' is-copied' : ''}`} onClick={() => handle(n)} title={`Copy <${tab === 'admin' ? 'AdmIcon' : 'Icon'} name="${n}" />`}>
            <IconCmp name={n} size={20} />
            <span className="ds-icon-cell-name">{copied === n ? 'Copied!' : n}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 09 DATA VIZ ===== */
function DataVizSection() {
  const linePts = [3,5,4,6,8,7,9,11,10,12,11,13,15,14,16];
  const w = 240, h = 60;
  const min = Math.min(...linePts), max = Math.max(...linePts);
  const step = w / (linePts.length - 1);
  const ys = linePts.map(p => h - 4 - ((p - min) / (max - min)) * (h - 8));
  const path = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <Section id="data-viz" num="09" eyebrow="Data viz" title="Charts, sparks, bars, dots"
      sub="Trading data is a hot loop. Polyforge avoids decorative charts: sparklines for trends, bars for ratios, dots for status. Always tabular numerals.">
      <Sub>Sparkline</Sub>
      <div className="ds-grid-3">
        {[
          { kind: '',        label: 'Default · accent', token: '<AdmSpark/>' },
          { kind: 'is-gain', label: 'Gain',             token: 'kind="gain"' },
          { kind: 'is-loss', label: 'Loss',             token: 'kind="loss"' },
        ].map((s) => (
          <div key={s.label} className="ds-card"><div className="ds-card-body" style={{ padding: 18 }}>
            <svg className={`adm-spark ${s.kind}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h, width: '100%' }}>
              <path className="area" d={area} />
              <path className="line" d={path} />
            </svg>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginTop: 6 }}>{s.label}</div>
            <div className="ds-mono ds-muted" style={{ fontSize: 11 }}>{s.token}</div>
          </div></div>
        ))}
      </div>
      <Sub>Bars</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 12 }}>
        {[
          { pct: 84, kind: '',        label: 'Hit rate',  value: '84%' },
          { pct: 62, kind: 'is-gain', label: 'Win-loss',  value: '62 / 38' },
          { pct: 23, kind: 'is-warn', label: 'Drawdown',  value: '−23%' },
          { pct: 9,  kind: 'is-loss', label: 'Risk used', value: '9 / 100' },
        ].map((b) => (
          <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.label}</span>
            <div className={`adm-bar ${b.kind}`}><span style={{ width: `${b.pct}%` }} /></div>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{b.value}</span>
          </div>
        ))}
      </div></div>
      <Sub>Dots</Sub>
      <div className="ds-card"><div className="ds-card-body ds-row">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="adm-dot is-gain" /> <span style={{ fontSize: 13 }}>Operational</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="adm-dot is-warn" /> <span style={{ fontSize: 13 }}>Degraded</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="adm-dot is-loss" /> <span style={{ fontSize: 13 }}>Offline</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="adm-dot" /> <span style={{ fontSize: 13 }}>Unknown</span></span>
      </div></div>
    </Section>
  );
}

/* ===== 10 BUTTONS ===== */
function ButtonsSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section id="buttons" num="10" eyebrow="Buttons" title="Actions in two scales"
      sub="Marketing site uses .btn (36/40/28/24px). Admin uses .adm-btn (30/26px). Same intent ladder: primary, secondary, ghost, danger.">
      <Sub><span className="ds-tag is-marketing">marketing</span> .btn</Sub>
      <div className="ds-component-stage">
        <button className="btn btn-primary">Primary action</button>
        <button className="btn btn-secondary">Secondary</button>
        <button className="btn btn-ghost">Ghost</button>
        <a className="btn btn-link" href="#">Link button →</a>
        <button className="btn btn-primary" disabled>Disabled</button>
      </div>
      <div className="ds-component-stage" style={{ marginTop: 8 }}>
        <button className="btn btn-primary btn-lg">Large 40px</button>
        <button className="btn btn-primary">Default 36px</button>
        <button className="btn btn-primary btn-sm">Small 28px</button>
        <button className="btn btn-primary btn-xs">XS 24px</button>
      </div>
      <Sub><span className="ds-tag is-admin">admin</span> .adm-btn</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-primary">Save changes</button>
        <button className="adm-btn adm-btn-secondary">Cancel</button>
        <button className="adm-btn adm-btn-ghost">Skip</button>
        <button className="adm-btn adm-btn-danger">Kill switch</button>
        <button className="adm-btn adm-btn-secondary" disabled>Disabled</button>
      </div>

      <Sub>State matrix</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ overflowX: 'auto' }}>
        <table className="adm-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Variant</th><th>Default</th><th>Hover</th><th>Active</th><th>Focus</th><th>Disabled</th>
          </tr></thead>
          <tbody>
            {[
              { name: 'Primary', cls: 'adm-btn-primary' },
              { name: 'Secondary', cls: 'adm-btn-secondary' },
              { name: 'Ghost', cls: 'adm-btn-ghost' },
              { name: 'Danger', cls: 'adm-btn-danger' },
            ].map(v => (
              <tr key={v.name}>
                <td style={{ fontWeight: 600 }}>{v.name}</td>
                <td><button className={`adm-btn ${v.cls} adm-btn-sm`}>{v.name}</button></td>
                <td><button className={`adm-btn ${v.cls} adm-btn-sm`} style={{ opacity: 0.85 }}>{v.name}</button></td>
                <td><button className={`adm-btn ${v.cls} adm-btn-sm`} style={{ transform: 'scale(0.98)', opacity: 0.9 }}>{v.name}</button></td>
                <td><button className={`adm-btn ${v.cls} adm-btn-sm`} style={{ outline: '2px solid var(--accent-default)', outlineOffset: 2 }}>{v.name}</button></td>
                <td><button className={`adm-btn ${v.cls} adm-btn-sm`} disabled>{v.name}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>

      <Sub>Loading state</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-primary" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
          <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rs-spin 0.8s linear infinite', display: 'inline-block' }} />
          Saving…
        </button>
        <button className="adm-btn adm-btn-secondary" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
          <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rs-spin 0.8s linear infinite', display: 'inline-block' }} />
          Deploying…
        </button>
        <style>{`@keyframes rs-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <Sub>Icon + text</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AdmIcon name="plus" size={14} /> New strategy</button>
        <button className="adm-btn adm-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AdmIcon name="download" size={14} /> Export CSV</button>
        <button className="adm-btn adm-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AdmIcon name="refresh" size={14} /> Refresh</button>
        <button className="adm-btn adm-btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AdmIcon name="trash" size={14} /> Delete</button>
      </div>

      <Sub>Keyboard hint</Sub>
      <div className="ds-component-stage">
        <span className="ds-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
        <span className="ds-kbd"><kbd>Esc</kbd></span>
        <span className="ds-kbd"><kbd>↵</kbd></span>
        <span className="ds-kbd"><kbd>Shift</kbd><kbd>Enter</kbd></span>
      </div>
    </Section>
  );
}

/* ===== 11 INPUTS ===== */
function InputsSection() {
  const [text, setText] = useState('maya@polyforge.app');
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [radio, setRadio] = useState('cozy');
  return (
    <Section id="inputs" num="11" eyebrow="Forms" title="Inputs, switches, radios"
      sub="Inputs sit on var(--bg-app); focus pushes a 3px subtle accent ring. Errors swap the border to a 50% loss tint.">
      <Sub>Text input · states</Sub>
      <div className="ds-component-stage" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        <div className="ds-input"><input placeholder="Default" /></div>
        <div className="ds-input"><input value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div className="ds-input has-error"><input defaultValue="invalid@" /></div>
        <div className="ds-input is-disabled"><input placeholder="Disabled" /></div>
      </div>
      <Sub>Toggle · radio</Sub>
      <div className="ds-component-stage">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }} onClick={() => setSw1(!sw1)}>
          <span className={`ds-switch${sw1 ? ' is-on' : ''}`} />
          Live trading
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }} onClick={() => setSw2(!sw2)}>
          <span className={`ds-switch${sw2 ? ' is-on' : ''}`} />
          Paper mode
        </span>
        <span style={{ width: 16 }} />
        {['cozy','compact','minimal'].map((v) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }} onClick={() => setRadio(v)}>
            <span className={`ds-radio${radio === v ? ' is-on' : ''}`} />
            {v}
          </span>
        ))}
      </div>
    </Section>
  );
}

/* ===== 12 BADGES ===== */
function BadgesSection() {
  return (
    <Section id="badges" num="12" eyebrow="Badges" title="Inline tags & filter chips"
      sub="Chips communicate inline state and category. They never carry primary actions.">
      <Sub>Chips · marketing</Sub>
      <div className="ds-component-stage is-tight">
        <span className="chip">Default</span>
        <span className="chip accent">Accent</span>
        <span className="chip gain">+12.4%</span>
        <span className="chip loss">−3.7%</span>
        <span className="chip warning">Pending</span>
        <span className="chip mono">0x4f6e·a982</span>
      </div>
      <Sub>Hero eyebrow</Sub>
      <div className="ds-component-stage">
        <span className="hero-eyebrow"><span className="dot" /> v1.5 — Kalshi multi-venue routing</span>
        <span className="ds-hero-eyebrow">DESIGN SYSTEM · v1.0</span>
      </div>
    </Section>
  );
}

/* ===== 13 PILLS ===== */
function PillsSection() {
  return (
    <Section id="pills" num="13" eyebrow="Status pills" title=".adm-pill"
      sub="Loud, mono, uppercase — used wherever a row carries a hard-edged status: live, paused, failed, queued. Add `has-dot` for a leading dot; `is-pulse` to animate it.">
      <Sub>Tone</Sub>
      <div className="ds-component-stage is-tight">
        <span className="adm-pill">Default</span>
        <span className="adm-pill is-accent">Accent</span>
        <span className="adm-pill is-gain">Gain</span>
        <span className="adm-pill is-loss">Loss</span>
        <span className="adm-pill is-warn">Warn</span>
        <span className="adm-pill is-info">Info</span>
      </div>
      <Sub>With dot · pulsing</Sub>
      <div className="ds-component-stage is-tight">
        <span className="adm-pill is-gain has-dot">Live</span>
        <span className="adm-pill is-warn has-dot">Degraded</span>
        <span className="adm-pill is-loss has-dot is-pulse">Offline</span>
        <span className="adm-pill is-info has-dot">Queued</span>
      </div>
    </Section>
  );
}

/* ===== 14 CARDS ===== */
function CardsSection() {
  return (
    <Section id="cards" num="14" eyebrow="Cards" title="Surface · Stat · Showcase"
      sub="Three card families. Use .adm-stat for KPI tiles in admin grids; .adm-card for general containers; browser-chrome for marketing showcases.">
      <Sub>Surface card</Sub>
      <div className="ds-component-stage is-block">
        <div className="adm-card">
          <div className="adm-card-head">
            <h3 className="adm-card-title">Recent activity</h3>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginLeft: 'auto' }}>View all →</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {['Resolution settled · 2024-elect', 'Strategy paused · breakout-momentum', 'New approval · maya@polyforge.app'].map((t, i) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span className={`adm-dot ${i === 0 ? 'is-gain' : i === 1 ? 'is-warn' : ''}`} />
                <span style={{ color: 'var(--text-primary)' }}>{t}</span>
                <span className="ds-mono ds-muted" style={{ marginLeft: 'auto', fontSize: 11 }}>2m ago</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Sub>Stat card</Sub>
      <div className="ds-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: 'Total volume', value: '$4.2M', delta: '+12.4%', kind: 'gain' },
          { label: 'Active strategies', value: '88', delta: '+3', kind: 'gain' },
          { label: 'Max drawdown', value: '−8.2%', delta: '', kind: 'loss' },
          { label: 'Sharpe ratio', value: '1.84', delta: '−0.12', kind: 'warn' },
        ].map(s => (
          <div key={s.label} className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontFamily: 'Geist Mono, monospace', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
            {s.delta && <div style={{ fontSize: 12, fontFamily: 'Geist Mono, monospace', color: s.kind === 'gain' ? 'var(--gain-text)' : s.kind === 'loss' ? 'var(--loss-text)' : 'var(--warning)', marginTop: 4 }}>{s.delta}</div>}
          </div>
        ))}
      </div>

      <Sub>Browser chrome (showcase)</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', maxWidth: 480 }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: '#FF5F57' }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: '#FEBC2E' }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: '#28C840' }} />
            </div>
            <div style={{ flex: 1, height: 22, background: 'var(--bg-app)', borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>app.polyforge.app/strategies</div>
          </div>
          <div style={{ height: 120, background: 'var(--bg-app)', display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Content area</div>
        </div>
      </div>

      <Sub>Card spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Background', 'var(--bg-surface)'],
          ['Border', '1px solid var(--border-subtle)'],
          ['Radius', '10px (LG)'],
          ['Padding', '18–20px body, 14–16px head/foot'],
          ['Hover', 'border-color → accent-border (optional, for clickable cards)'],
          ['Head', 'Flex row: title (14px/600) + action button, border-bottom'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 15 TABLES ===== */
function TablesSection() {
  const [sel, setSel] = useState([1]);
  return (
    <Section id="tables" num="15" eyebrow="Tables" title=".adm-table"
      sub="The heart of the admin app. Every list view follows the same pattern: tools row (search + filters), table, footer.">
      <Sub>Full table with tools</Sub>
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <input placeholder="Filter strategies…" />
          </div>
          <button className="adm-filter is-active">Live <span className="count">88</span></button>
          <button className="adm-filter">Paused <span className="count">42</span></button>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ marginLeft: 'auto' }}>Export</button>
          <button className="adm-btn adm-btn-primary adm-btn-sm">+ New</button>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Strategy <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>▲</span></th>
              <th>7d PnL</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Updated <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>▼</span></th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'breakout-momentum', pnl: '+$24,108', kind: 'gain', tone: 'gain', text: 'Live', dot: true,  owner: 'M. Chen', when: '2m ago' },
              { name: 'sentiment-pulse',   pnl: '+$8,402',  kind: 'gain', tone: 'gain', text: 'Live', dot: true,  owner: 'J. Park',  when: '14m ago' },
              { name: 'whale-mirror',      pnl: '−$1,209',  kind: 'loss', tone: 'warn', text: 'Paused',           owner: 'A. Reyes', when: '1h ago' },
              { name: 'pump-frontrun',     pnl: '−$3,884',  kind: 'loss', tone: 'loss', text: 'Failed', dot: true, pulse: true, owner: 'M. Chen', when: '3h ago' },
            ].map((r, i) => (
              <tr key={r.name} style={sel.includes(i) ? { background: 'var(--accent-subtle)' } : {}}
                onClick={() => setSel(sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i])}>
                <td>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: sel.includes(i) ? 'none' : '1px solid var(--border-strong)',
                    background: sel.includes(i) ? 'var(--accent-default)' : 'transparent',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
                    transition: 'all 120ms ease'
                  }}>
                    {sel.includes(i) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                </td>
                <td><span className="col-mono" style={{ color: 'var(--text-primary)' }}>{r.name}</span></td>
                <td className="col-num" style={{ color: r.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)' }}>{r.pnl}</td>
                <td><span className={`adm-pill is-${r.tone}${r.dot ? ' has-dot' : ''}${r.pulse ? ' is-pulse' : ''}`}>{r.text}</span></td>
                <td className="col-secondary">{r.owner}</td>
                <td className="col-tertiary col-mono">{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>{sel.length} selected · Showing 1–4 of 130</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ width: 26, height: 26, border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>◀</button>
            <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)', lineHeight: '26px', padding: '0 6px' }}>1 / 33</span>
            <button style={{ width: 26, height: 26, border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>▶</button>
          </div>
        </div>
      </div>

      <Sub>Row states</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Default', 'bg-surface, text-primary'],
          ['Hover', 'bg-subtle (via refinements.css tr:hover)'],
          ['Selected', 'accent-subtle background, checkbox checked'],
          ['Sorted column', 'th gets ▲/▼ indicator, col text slightly bolder'],
          ['Sticky header', 'thead position: sticky, top: 0, bg-surface, z-index 2'],
          ['Empty', 'Single merged cell: centered message + action button'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>

      <Sub>Empty state</Sub>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Strategy</th><th>7d PnL</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>No strategies match your filters.</div>
                <button className="adm-btn adm-btn-secondary adm-btn-sm">Clear filters</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== 16 NAVIGATION ===== */
function NavigationSection() {
  const [tab, setTab] = useState('overview');
  const [navItem, setNavItem] = useState('dashboard');
  return (
    <Section id="navigation" num="16" eyebrow="Navigation" title="Sidebar, tabs, breadcrumbs"
      sub="Admin uses 240px sidebar; docs/design-system uses 260px. Marketing sits on a sticky top nav.">
      <Sub>Admin sidebar (240px)</Sub>
      <div className="ds-component-stage is-block" style={{ padding: 0 }}>
        <div style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', padding: '12px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px 4px', marginBottom: 2 }}>Overview</div>
          {[
            { icon: 'dashboard', label: 'Dashboard', id: 'dashboard' },
            { icon: 'dollar', label: 'Revenue', id: 'revenue' },
            { icon: 'users', label: 'Users', id: 'users' },
          ].map(item => (
            <button key={item.id} onClick={() => setNavItem(item.id)} style={{
              width: '100%', height: 30, padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 13,
              background: navItem === item.id ? 'var(--bg-elevated)' : 'transparent',
              color: navItem === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: navItem === item.id ? 500 : 400,
              fontFamily: 'inherit', textAlign: 'left',
            }}>
              <AdmIcon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 10px' }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px 4px', marginBottom: 2 }}>Strategy</div>
          {[
            { icon: 'blocks', label: 'Strategies', id: 'strategies' },
            { icon: 'bar-chart', label: 'Backtests', id: 'backtests' },
            { icon: 'hammer', label: 'Builder', id: 'builder' },
          ].map(item => (
            <button key={item.id} onClick={() => setNavItem(item.id)} style={{
              width: '100%', height: 30, padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 13,
              background: navItem === item.id ? 'var(--bg-elevated)' : 'transparent',
              color: navItem === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: navItem === item.id ? 500 : 400,
              fontFamily: 'inherit', textAlign: 'left',
            }}>
              <AdmIcon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <Sub>Sidebar spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Width', '240px admin, 260px docs/DS'],
          ['Background', 'var(--bg-surface)'],
          ['Item height', '30px, radius 6, padding 0 10px'],
          ['Active', 'bg-elevated, text-primary, weight 500'],
          ['Inactive', 'transparent bg, text-secondary, weight 400'],
          ['Section label', '10px uppercase, text-tertiary, 0.06em tracking'],
          ['Divider', '1px border-subtle, 8px margin'],
          ['Position', 'sticky, top: 0, height: 100vh, overflow-y: auto'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>

      <Sub>Tabs</Sub>
      <div className="ds-component-stage is-block" style={{ paddingBottom: 0 }}>
        <div className="ds-tabs">
          {['Overview','Activity','Members','Settings'].map((t) => (
            <button key={t} className={`ds-tab${tab === t.toLowerCase() ? ' is-active' : ''}`} onClick={() => setTab(t.toLowerCase())}>{t}</button>
          ))}
        </div>
      </div>

      <Sub>Status pill (top nav)</Sub>
      <div className="ds-component-stage">
        <button className="status-pill"><span className="status-dot status-dot-live" /><span className="status-pill-label">All systems operational</span></button>
        <button className="status-pill"><span className="status-dot status-dot-warn" /><span className="status-pill-label">Degraded · resolution-api</span></button>
      </div>
    </Section>
  );
}

/* ===== 17 OVERLAYS ===== */
function OverlaysSection() {
  return (
    <Section id="overlays" num="17" eyebrow="Overlays" title="Modals & toasts"
      sub="Modals interrupt; toasts confirm. Use a modal only for destructive or irreversible actions. Toasts are passing — never put primary actions in them.">
      <Sub>Toasts</Sub>
      <div className="ds-component-stage" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <div className="ds-toast is-gain">
          <AdmIcon name="circle-check" size={16} />
          <span>Strategy saved</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>just now</span>
        </div>
        <div className="ds-toast is-loss">
          <AdmIcon name="circle-x" size={16} />
          <span>Order rejected · insufficient balance</span>
        </div>
        <div className="ds-toast is-warn">
          <AdmIcon name="alert" size={16} />
          <span>Approaching daily risk limit</span>
        </div>
        <div className="ds-toast">
          <AdmIcon name="bell" size={16} />
          <span>3 markets resolve in 24h</span>
        </div>
      </div>

      <Sub>Toast spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Container', 'bg-elevated, border-subtle, left 3px accent border, radius 8'],
          ['Shadow', '0 4px 16px rgba(0,0,0,0.3)'],
          ['Icon', '16px AdmIcon, color inherits from border accent'],
          ['Text', '13px, text-primary'],
          ['Timestamp', '11px, text-tertiary, right-aligned (optional)'],
          ['Dismiss', 'Auto-dismiss 4s, or swipe/click to close'],
          ['Position', 'Bottom-right, 16px from edge, stacked 8px apart'],
          ['Gain', 'Left border var(--gain), icon circle-check'],
          ['Loss', 'Left border var(--loss), icon circle-x'],
          ['Warn', 'Left border var(--warning), icon alert'],
          ['Neutral', 'Left border var(--border-default), icon bell'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 18 FEEDBACK ===== */
function FeedbackSection() {
  return (
    <Section id="feedback" num="18" eyebrow="Feedback" title="Empty, loading, error"
      sub="No animations on first paint. Empty states are quiet, instructive, and offer the next action. Loading states use skeletons for layout and spinners for actions.">
      <Sub>Skeleton</Sub>
      <div className="ds-component-stage is-block">
        <div className="adm-card"><div style={{ display: 'grid', gap: 12 }}>
          {[85, 60, 92, 45].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--bg-elevated)', animation: 'ds-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-surface) 50%, var(--bg-elevated) 100%)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, width: w+'%', borderRadius: 4, marginBottom: 6, background: 'var(--bg-elevated)', animation: 'ds-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-surface) 50%, var(--bg-elevated) 100%)' }} />
                <div style={{ height: 8, width: (w*0.6)+'%', borderRadius: 4, background: 'var(--bg-subtle)', animation: 'ds-shimmer 1.4s ease-in-out infinite', animationDelay: '0.2s', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-subtle) 0%, var(--bg-surface) 50%, var(--bg-subtle) 100%)' }} />
              </div>
            </div>
          ))}
        </div></div>
        <style>{`@keyframes ds-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>

      <Sub>Spinner</Sub>
      <div className="ds-component-stage">
        {[14, 18, 24, 32].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: s, height: s, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-default)', borderRadius: '50%', animation: 'ds-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s}px</span>
          </div>
        ))}
        <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <Sub>Empty state — with action</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ border: '1px dashed var(--border-default)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
          <div style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--bg-elevated)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--text-tertiary)' }}><AdmIcon name="blocks" size={20} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No strategies yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.55 }}>Build your first strategy with the visual builder. Drag blocks, wire conditions, backtest against 90 days of data.</div>
          <button className="adm-btn adm-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AdmIcon name="plus" size={14} /> New strategy</button>
        </div>
      </div>

      <Sub>Empty state — minimal</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No results match “xyz”</div>
          <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginTop: 8 }}>Clear search</button>
        </div>
      </div>

      <Sub>Error state</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ background: 'color-mix(in srgb, var(--loss) 6%, var(--bg-surface))', border: '1px solid color-mix(in srgb, var(--loss) 20%, var(--border-subtle))', borderRadius: 8, padding: '14px 16px', maxWidth: 420, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AdmIcon name="alert" size={16} style={{ color: 'var(--loss-text)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Failed to load strategies</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>Connection to strategy service timed out. This usually resolves within a few minutes.</div>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--loss-text)' }}><AdmIcon name="refresh" size={12} /> Retry</button>
          </div>
        </div>
      </div>

      <Sub>Spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Skeleton shimmer', '1.4s ease-in-out infinite, bg-elevated → bg-surface gradient'],
          ['Spinner', '0.8s linear infinite, border-default + accent-default top'],
          ['Empty icon', '40px circle, bg-elevated, centered'],
          ['Empty title', '14px/600, text-primary'],
          ['Empty body', '13px/400, text-secondary, max ~2 lines'],
          ['Empty CTA', 'Primary or ghost button below body'],
          ['Error container', 'bg-surface, border-subtle, radius 8, subtle shadow'],
          ['Error icon', '16px AdmIcon alert, loss-text color, no background'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 19 VOICE ===== */
function VoiceSection() {
  const pairs = [
    { do: 'Resolution settled. $2,408.21 credited.', doNote: 'State the outcome. Lead with the number that matters.',
      dont: 'Great news! Your resolution has been completed successfully ✨', dontNote: 'No emoji, no "great news!" — Polyforge is the calm in the room.' },
    { do: 'Pause all live strategies?', doNote: 'Active voice, plain question, exact scope.',
      dont: 'Are you sure you would like to proceed with this action?', dontNote: 'Vague "this action" forces the user to remember context.' },
    { do: 'No backtests yet. Validate a strategy against 90 days of resolved markets.', doNote: 'Empty states explain what the screen is for.',
      dont: 'No data available.', dontNote: 'Tells the user nothing they didn\'t already see.' },
    { do: 'Insufficient balance · order rejected.', doNote: 'Cause first, effect second.',
      dont: 'Oh no, something went wrong while placing your order!', dontNote: 'Performative panic. Polyforge moves money — it stays steady.' },
  ];
  return (
    <Section id="voice" num="19" eyebrow="Voice" title="Steady, exact, plainspoken"
      sub="Polyforge is the desk light, not the showroom. We name the thing, give the number, and let the system do the talking.">
      <div className="ds-voice">
        {pairs.map((p, i) => (
          <React.Fragment key={i}>
            <div className="ds-voice-card is-do">
              <div className="ds-voice-tag">✓ Do</div>
              <p className="ds-voice-quote">{p.do}</p>
              <p className="ds-voice-note">{p.doNote}</p>
            </div>
            <div className="ds-voice-card is-dont">
              <div className="ds-voice-tag">× Don't</div>
              <p className="ds-voice-quote">{p.dont}</p>
              <p className="ds-voice-note">{p.dontNote}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}

/* ===== 20 IMPLEMENTATION ===== */
function ImplementationSection() {
  return (
    <Section id="code" num="20" eyebrow="Implementation" title="Wiring & files"
      sub="The system lives across stylesheets and a small set of JSX components. Pages compose at the page level.">
      <Sub>Stylesheets</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 10 }}>
        {[
          ['styles.css',  'Marketing, docs, auth, guide, legal, status, pricing, changelog. All root tokens and most reusable classes.'],
          ['admin.css',   'Admin shell. Layered on top of styles.css. Adds .adm-* primitives.'],
          ['docs.css',    'Three-column docs layout, sidebar TOC, callouts.'],
          ['auth.css',    'Split-pane authentication layout.'],
          ['legal.css',   'TOC sidebar, callouts, print styles.'],
          ['design-system.css', 'This page.'],
        ].map(([file, desc]) => (
          <div key={file} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <span className="ds-mono" style={{ color: 'var(--accent-text)', fontSize: 12 }}>{file}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{desc}</span>
          </div>
        ))}
      </div></div>
      <Sub>Component files</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 10 }}>
        {[
          ['components/icons.jsx',         '<Icon name="…" />, <Logo />.'],
          ['components/admin-icons.jsx',   '<AdmIcon name="…" />.'],
          ['components/admin-shell.jsx',   'Sidebar, topbar, AdmStat / AdmPill / AdmSpark / AdmAvatar / AdmFilter.'],
          ['components/docs-shell.jsx',    'Three-column docs shell.'],
          ['components/tweaks-panel.jsx',  'Floating tweaks panel + primitives.'],
          ['components/command-palette.jsx', '⌘K palette with keyboard nav.'],
        ].map(([file, desc]) => (
          <div key={file} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <span className="ds-mono" style={{ color: 'var(--color-purple-400)', fontSize: 12 }}>{file}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{desc}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

window.DSSections = {
  OverviewSection, BrandSection, ColorSection, TypographySection, SpacingSection,
  RadiiSection, ShadowsSection, MotionSection, IconSection, DataVizSection,
  ButtonsSection, InputsSection, BadgesSection, PillsSection, CardsSection,
  TablesSection, NavigationSection, OverlaysSection, FeedbackSection,
  VoiceSection, ImplementationSection,
};
