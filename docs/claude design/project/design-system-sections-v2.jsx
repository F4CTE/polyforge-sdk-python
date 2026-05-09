/* Design System — additional sections (v2).
   Extends the base sections with missing components + deeper demos. */

/* ===== 21 AVATARS ===== */
function AvatarsSection() {
  const sizes = [
    { name: 'XS', px: 20, fs: 8 },
    { name: 'SM', px: 28, fs: 10 },
    { name: 'Base', px: 36, fs: 12 },
    { name: 'LG', px: 48, fs: 16 },
    { name: 'XL', px: 64, fs: 22 },
  ];
  const people = [
    { initials: 'AK', name: 'Alex K.' },
    { initials: 'SR', name: 'Sarah R.' },
    { initials: 'MC', name: 'Marcus C.' },
    { initials: 'JP', name: 'Jun P.' },
  ];
  return (
    <Section id="avatars" num="21" eyebrow="Avatars" title="Initials, sizes, stacking"
      sub="Avatars use initials on a muted background. No images — Polyforge is pseudonymous. Circle for people, rounded-square for strategies/blocks.">
      <Sub>Sizes</Sub>
      <div className="ds-component-stage">
        {sizes.map(s => (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: s.px, height: s.px, borderRadius: 99,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: s.fs, fontWeight: 600, color: 'var(--text-tertiary)',
              fontFamily: 'Geist Mono, monospace'
            }}>AK</div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.name} · {s.px}px</span>
          </div>
        ))}
      </div>

      <Sub>Shapes</Sub>
      <div className="ds-component-stage">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 99, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>SR</div>
          <span style={{ fontSize: 13 }}>Circle — people, operators</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)' }}><AdmIcon name="blocks" size={16} /></div>
          <span style={{ fontSize: 13 }}>Rounded square — strategies, blocks</span>
        </div>
      </div>

      <Sub>Group stack</Sub>
      <div className="ds-component-stage">
        <div style={{ display: 'flex' }}>
          {people.map((p, i) => (
            <div key={p.initials} style={{
              width: 32, height: 32, borderRadius: 99,
              background: 'var(--bg-elevated)', border: '2px solid var(--bg-app)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
              fontFamily: 'Geist Mono, monospace',
              marginLeft: i === 0 ? 0 : -10, zIndex: people.length - i,
              position: 'relative'
            }}>{p.initials}</div>
          ))}
          <div style={{
            width: 32, height: 32, borderRadius: 99,
            background: 'var(--bg-surface)', border: '2px solid var(--bg-app)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)',
            marginLeft: -10, position: 'relative'
          }}>+3</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Overlap by 10px. Border matches bg-app.</span>
      </div>

      <Sub>With status dot</Sub>
      <div className="ds-component-stage">
        {[
          { initials: 'AK', status: 'is-gain', label: 'Online' },
          { initials: 'SR', status: 'is-warn', label: 'Away' },
          { initials: 'MC', status: '', label: 'Offline' },
        ].map(a => (
          <div key={a.initials} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{a.initials}</div>
              <span className={`adm-dot ${a.status}`} style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, border: '2px solid var(--bg-app)' }} />
            </div>
            <span style={{ fontSize: 13 }}>{a.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== 22 DROPDOWNS ===== */
function DropdownsSection() {
  const [sel, setSel] = React.useState('polymarket');
  const [open, setOpen] = React.useState(false);
  const options = ['polymarket', 'kalshi', 'predictit', 'manifold'];
  return (
    <Section id="dropdowns" num="22" eyebrow="Dropdowns" title="Select, menu, popover"
      sub="Native <select> for simple cases. Custom dropdown for icon/meta rows. Always keyboard-navigable.">
      <Sub>Native select</Sub>
      <div className="ds-component-stage" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        <select defaultValue="polymarket" style={{ width: '100%', height: 34, padding: '0 10px', background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, appearance: 'auto', cursor: 'pointer' }}>
          <option value="polymarket">Polymarket</option>
          <option value="kalshi">Kalshi</option>
          <option value="predictit">PredictIt</option>
        </select>
        <select style={{ width: '100%', height: 34, padding: '0 10px', background: 'var(--bg-app)', border: '1px solid var(--loss, #ef4444)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, appearance: 'auto', cursor: 'pointer' }}>
          <option>Select venue…</option>
        </select>
      </div>

      <Sub>Custom dropdown</Sub>
      <div className="ds-component-stage" style={{ minHeight: open ? 220 : 80 }}>
        <div style={{ position: 'relative', width: 260 }}>
          <button onClick={() => setOpen(!open)} style={{
            width: '100%', height: 36, padding: '0 12px',
            background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6,
            color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', textAlign: 'left'
          }}>
            <span style={{ textTransform: 'capitalize' }}>{sel}</span>
            <AdmIcon name="chevron-down" size={14} />
          </button>
          {open && (
            <div style={{
              position: 'absolute', top: 40, left: 0, width: '100%',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 8, padding: 4, zIndex: 10,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
            }}>
              {options.map(o => (
                <button key={o} onClick={() => { setSel(o); setOpen(false); }} style={{
                  width: '100%', height: 32, padding: '0 10px', border: 0, borderRadius: 6,
                  background: o === sel ? 'var(--accent-subtle)' : 'transparent',
                  color: o === sel ? 'var(--accent-text)' : 'var(--text-primary)',
                  fontFamily: 'inherit', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize'
                }}>
                  {o === sel && <AdmIcon name="check" size={13} />}
                  <span style={{ marginLeft: o !== sel ? 21 : 0 }}>{o}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sub>Spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Trigger', '36px height, bg-app, border-default, radius 6'],
          ['Menu', 'bg-elevated, shadow-3, radius 8, 4px padding'],
          ['Item', '32px height, radius 6, hover → bg-subtle'],
          ['Selected', 'accent-subtle bg, accent-text, ✓ prefix'],
          ['Gap', 'Menu opens 4px below trigger'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 23 MODAL ===== */
function ModalSection() {
  const [show, setShow] = React.useState(false);
  return (
    <Section id="modal" num="23" eyebrow="Modal" title="Confirm, destroy, inform"
      sub="Use modals only for destructive or irreversible actions. They interrupt — don't use them for info that could be a toast.">
      <Sub>Live demo</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-danger" onClick={() => setShow(true)}>Kill all live strategies</button>
      </div>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'grid', placeItems: 'center' }} onClick={() => setShow(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', width: 420, maxWidth: '90vw',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Kill all live strategies?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                This will immediately stop execution on <strong>12 live strategies</strong>. Open orders will be cancelled. This cannot be undone.
              </div>
            </div>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg-surface)' }}>
              <button className="adm-btn adm-btn-secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="adm-btn adm-btn-danger" onClick={() => setShow(false)}>Kill all</button>
            </div>
          </div>
        </div>
      )}
      <Sub>Anatomy</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Scrim', 'rgba(0,0,0,0.6), backdrop-filter: blur(4px)'],
          ['Container', 'bg-elevated, border-default, radius 12, shadow 16px 48px'],
          ['Header', 'Title (15px/600) + description (13px), 20px padding'],
          ['Footer', 'bg-surface, right-aligned actions, 14px 20px padding'],
          ['Width', '420px default, max-width 90vw'],
          ['Primary action', 'Right-most. Danger-styled for destructive ops.'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 24 COMMAND PALETTE ===== */
function CmdKSection() {
  const [q, setQ] = React.useState('');
  const items = [
    { icon: 'dashboard', label: 'Dashboard', shortcut: '⌘ D', section: 'Pages' },
    { icon: 'blocks', label: 'Strategy builder', shortcut: '⌘ B', section: 'Pages' },
    { icon: 'trending', label: 'Markets', shortcut: '⌘ M', section: 'Pages' },
    { icon: 'search', label: 'Search markets…', shortcut: '/', section: 'Actions' },
    { icon: 'plus', label: 'New strategy', shortcut: '⌘ N', section: 'Actions' },
    { icon: 'settings', label: 'Settings', shortcut: '⌘ ,', section: 'Actions' },
  ];
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
  const sections = [...new Set(filtered.map(i => i.section))];
  return (
    <Section id="cmdk" num="24" eyebrow="Command palette" title="⌘K — jump anywhere"
      sub="The command palette is the power-user backbone. Fuzzy search across pages, actions, and recent items. Always ⌘K / Ctrl+K.">
      <Sub>Static preview</Sub>
      <div style={{
        width: 480, maxWidth: '100%', margin: '0 auto',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AdmIcon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command or search…"
            style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, outline: 'none' }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 6px', background: 'var(--bg-app)', borderRadius: 4, fontFamily: 'Geist Mono, monospace' }}>esc</span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '6px' }}>
          {sections.map(sec => (
            <div key={sec}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px 4px' }}>{sec}</div>
              {filtered.filter(i => i.section === sec).map((item, idx) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  background: idx === 0 && sec === sections[0] ? 'var(--accent-subtle)' : 'transparent',
                  color: idx === 0 && sec === sections[0] ? 'var(--accent-text)' : 'var(--text-primary)',
                  cursor: 'pointer', fontSize: 13
                }}>
                  <AdmIcon name={item.icon} size={16} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)' }}>{item.shortcut}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>↑↓ Navigate</span><span>↵ Open</span><span>esc Close</span>
        </div>
      </div>
    </Section>
  );
}

/* ===== 25 BREADCRUMBS ===== */
function BreadcrumbsSection() {
  return (
    <Section id="breadcrumbs" num="25" eyebrow="Breadcrumbs" title="Path navigation"
      sub="Used in admin detail pages and nested views. Never on top-level list pages.">
      <Sub>Standard</Sub>
      <div className="ds-component-stage is-block">
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <a href="#" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Strategies</a>
          <span style={{ color: 'var(--text-disabled)' }}>/</span>
          <a href="#" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>breakout-momentum</a>
          <span style={{ color: 'var(--text-disabled)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Backtest #847</span>
        </nav>
      </div>
      <Sub>With icon</Sub>
      <div className="ds-component-stage is-block">
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <a href="#" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AdmIcon name="dashboard" size={13} /> Admin</a>
          <AdmIcon name="chevron-right" size={12} style={{ color: 'var(--text-disabled)' }} />
          <a href="#" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Users</a>
          <AdmIcon name="chevron-right" size={12} style={{ color: 'var(--text-disabled)' }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>maya@polyforge.app</span>
        </nav>
      </div>
      <Sub>Spec</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Font', '13px, Geist, 400 for links, 500 for current'],
          ['Links', 'text-tertiary, no underline, hover → text-secondary'],
          ['Separator', '/ or chevron-right, text-disabled'],
          ['Current', 'text-primary, 500 weight, not a link'],
          ['Placement', 'Above page title, below topbar'],
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

/* ===== 26 PAGINATION ===== */
function PaginationSection() {
  const [page, setPage] = React.useState(3);
  const total = 12;
  return (
    <Section id="pagination" num="26" eyebrow="Pagination" title="Paged lists"
      sub="Used in admin tables and user-facing lists. Shows current page, total, and prev/next. Compact for tight spaces.">
      <Sub>Standard</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Showing 21–30 of 118</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ width: 30, height: 30, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><AdmIcon name="chevron-left" size={14} /></button>
            {[1, 2, 3, 4, 5, '…', total].map((p, i) => (
              <button key={i} onClick={() => typeof p === 'number' && setPage(p)} style={{
                width: 30, height: 30, borderRadius: 6,
                border: p === page ? '1px solid var(--accent-border)' : '1px solid transparent',
                background: p === page ? 'var(--accent-subtle)' : 'transparent',
                color: p === page ? 'var(--accent-text)' : p === '…' ? 'var(--text-disabled)' : 'var(--text-secondary)',
                fontFamily: 'Geist Mono, monospace', fontSize: 12, fontWeight: 500,
                cursor: typeof p === 'number' ? 'pointer' : 'default',
                display: 'grid', placeItems: 'center'
              }}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(total, page + 1))} disabled={page === total} style={{ width: 30, height: 30, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><AdmIcon name="chevron-right" size={14} /></button>
          </div>
        </div>
      </div>
      <Sub>Compact (table footer)</Sub>
      <div className="ds-component-stage is-block">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>3 / 12</span>
          <button style={{ width: 26, height: 26, border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><AdmIcon name="chevron-left" size={12} /></button>
          <button style={{ width: 26, height: 26, border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><AdmIcon name="chevron-right" size={12} /></button>
        </div>
      </div>
    </Section>
  );
}

/* ===== 27 PROGRESS ===== */
function ProgressSection() {
  return (
    <Section id="progress" num="27" eyebrow="Progress" title="Bars, gauges, loading"
      sub="Progress bars fill left-to-right. Gain/loss coloring follows semantic tokens. Loading spinners are 14px inline, 24px standalone.">
      <Sub>Fill bar</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 14 }}>
        {[
          { label: 'Win rate', pct: 67, kind: '' },
          { label: 'Sharpe ratio', pct: 84, kind: 'is-gain' },
          { label: 'Risk usage', pct: 23, kind: 'is-warn' },
          { label: 'Max drawdown', pct: 12, kind: 'is-loss' },
        ].map(b => (
          <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.label}</span>
            <div style={{ height: 6, background: 'var(--bg-app)', borderRadius: 99, overflow: 'hidden' }}>
              <div className={`adm-bar ${b.kind}`} style={{ height: '100%', width: `${b.pct}%`, borderRadius: 99 }}><span style={{ width: '100%' }} /></div>
            </div>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{b.pct}%</span>
          </div>
        ))}
      </div></div>

      <Sub>Spinner</Sub>
      <div className="ds-component-stage">
        {[14, 18, 24].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: s, height: s, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-default)', borderRadius: '50%', animation: 'rs-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s}px</span>
          </div>
        ))}
        <style>{`@keyframes rs-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <Sub>Loading button</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-primary" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
          <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rs-spin 0.8s linear infinite', display: 'inline-block' }} />
          Saving…
        </button>
        <button className="adm-btn adm-btn-secondary" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
          <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rs-spin 0.8s linear infinite', display: 'inline-block' }} />
          Deploying…
        </button>
      </div>

      <Sub>Skeleton loading</Sub>
      <div className="ds-component-stage is-block">
        <div className="adm-card"><div style={{ display: 'grid', gap: 12 }}>
          {[85, 60, 92, 45].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--bg-elevated)', animation: 'ds-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-surface) 50%, var(--bg-elevated) 100%)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, width: `${w}%`, borderRadius: 4, marginBottom: 6, background: 'var(--bg-elevated)', animation: 'ds-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-surface) 50%, var(--bg-elevated) 100%)' }} />
                <div style={{ height: 8, width: `${w * 0.6}%`, borderRadius: 4, background: 'var(--bg-subtle)', animation: 'ds-shimmer 1.4s ease-in-out infinite', animationDelay: '0.2s', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-subtle) 0%, var(--bg-surface) 50%, var(--bg-subtle) 100%)' }} />
              </div>
            </div>
          ))}
        </div></div>
        <style>{`@keyframes ds-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    </Section>
  );
}

/* ===== 28 LAYOUT ===== */
function LayoutSection() {
  return (
    <Section id="layout" num="28" eyebrow="Layout" title="Grid, container, breakpoints"
      sub="Polyforge uses three layout shells: marketing (centered container), user app (sidebar + main), and admin (sidebar + main). Responsive breakpoints are intentional and few.">
      <Sub>Shells</Sub>
      <div className="ds-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {[
          ['Marketing', 'Max 1120px centered, 80–112px section padding', 'pf-nav (64px sticky) + stacked sections + pf-footer'],
          ['User app', '240px sidebar + fluid main', 'usr-shell → usr-sidebar + usr-main (topbar 52px + content)'],
          ['Admin', '240px sidebar + fluid main', 'adm-shell → adm-sidebar + adm-main (topbar 48px + content)'],
        ].map(([name, dims, structure]) => (
          <div key={name} className="ds-card"><div className="ds-card-body">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>{dims}</div>
            <div className="ds-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{structure}</div>
          </div></div>
        ))}
      </div>

      <Sub>Breakpoints</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['< 480px', 'Mobile', 'Single column. Sidebar hidden. Tables → card lists.'],
          ['480–720px', 'Small tablet', 'Sidebar collapses. 2-col grids → 1-col.'],
          ['720–900px', 'Tablet', 'Sidebar overlay on admin/user. 3-col → 2-col.'],
          ['900–1100px', 'Small desktop', 'Full sidebar. Most grids at full columns.'],
          ['> 1100px', 'Desktop', 'Full layout. Marketing container hits max-width.'],
        ].map(([bp, name, desc]) => (
          <div key={bp} style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr', gap: 12, alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--accent-text)' }}>{bp}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</span>
          </div>
        ))}
      </div></div>

      <Sub>Container</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['.container', 'max-width: 1120px, margin: 0 auto, padding: 0 24px'],
          ['.container-sm', 'max-width: 720px — used for legal/guide prose'],
          ['Section padding', '80px top/bottom (mobile), 112px (desktop)'],
          ['Card padding', '18–20px internal, 16px gap between cards'],
          ['Admin card grid', '3–4 columns at desktop via grid-template-columns'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'baseline' }}>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--accent-text)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 29 FONT FEATURES ===== */
function FontFeaturesSection() {
  return (
    <Section id="font-features" num="29" eyebrow="Font features" title="OpenType and number formatting"
      sub="Polyforge is a numbers-heavy product. Tabular numerals (tnum) are mandatory wherever numbers appear in columns.">
      <Sub>Features in use</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 12 }}>
        {[
          { feature: 'tnum', label: 'Tabular numerals', sample: '$1,247.83', sampleOff: '$1,247.83', desc: 'Equal-width digits. Required for tables, P&L, order sizes.' },
          { feature: 'zero', label: 'Slashed zero', sample: '0x4F6E', sampleOff: '0x4F6E', desc: 'Distinguishes 0 from O. Used in Geist Mono for hashes and addresses.' },
          { feature: 'ss01', label: 'Stylistic set 01', sample: 'Polyforge', sampleOff: 'Polyforge', desc: 'Alternative glyph forms in Geist. Slightly more geometric.' },
          { feature: 'cv11', label: 'Character variant 11', sample: 'Strategy', sampleOff: 'Strategy', desc: 'Alternative lowercase l/I disambiguation.' },
          { feature: 'ss03', label: 'Stylistic set 03', sample: 'resolution', sampleOff: 'resolution', desc: 'Alternative r/a curves in Geist.' },
        ].map(f => (
          <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14, alignItems: 'flex-start', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <div>
              <span className="ds-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-text)' }}>{f.feature}</span>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{f.label}</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontFeatureSettings: `"${f.feature}"`, fontFamily: f.feature === 'zero' ? 'Geist Mono, monospace' : 'inherit', marginBottom: 4 }}>{f.sample}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div></div>

      <Sub>Global application</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['body', 'font-feature-settings: "cv11", "ss01", "ss03"'],
          ['.mono', 'font-feature-settings: "zero", "ss02"'],
          ['.col-num, .adm-stat-value', 'font-variant-numeric: tabular-nums; font-feature-settings: "tnum"'],
          ['All tables', 'Tabular numerals via refinements.css'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--color-purple-400)' }}>{k}</span>
            <span className="ds-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

/* ===== 30 ACCESSIBILITY ===== */
function AccessibilitySection() {
  return (
    <Section id="a11y" num="30" eyebrow="Accessibility" title="Focus, motion, ARIA"
      sub="Polyforge targets WCAG 2.1 AA. Focus rings are always visible on keyboard nav. Reduced-motion is respected globally.">
      <Sub>Focus ring</Sub>
      <div className="ds-component-stage">
        <button className="adm-btn adm-btn-primary" style={{ outline: '2px solid var(--accent-default)', outlineOffset: 2 }}>Focused primary</button>
        <button className="adm-btn adm-btn-secondary" style={{ outline: '2px solid var(--accent-default)', outlineOffset: 2 }}>Focused secondary</button>
        <div className="ds-input" style={{ outline: '2px solid var(--accent-default)', outlineOffset: 1, borderRadius: 6 }}><input defaultValue="Focused input" /></div>
      </div>

      <Sub>Contrast ratios</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['text-primary on bg-app', '#F0F1F5 on #0E0F11', '15.2:1', '✓ AAA'],
          ['text-secondary on bg-app', '#8B8FA8 on #0E0F11', '6.1:1', '✓ AA'],
          ['text-tertiary on bg-app', '#545770 on #0E0F11', '3.2:1', '✓ AA large'],
          ['accent-text on bg-app', '#7B96FF on #0E0F11', '5.8:1', '✓ AA'],
          ['gain-text on bg-app', '#4ADE80 on #0E0F11', '8.9:1', '✓ AAA'],
          ['loss-text on bg-app', '#F87171 on #0E0F11', '4.8:1', '✓ AA'],
        ].map(([pair, hex, ratio, grade]) => (
          <div key={pair} style={{ display: 'grid', gridTemplateColumns: '200px 160px 60px 80px', gap: 10, alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{pair}</span>
            <span className="ds-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hex}</span>
            <span className="ds-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ratio}</span>
            <span className={`adm-pill ${grade.includes('AAA') ? 'is-gain' : grade.includes('large') ? 'is-warn' : 'is-accent'}`} style={{ fontSize: 9 }}>{grade}</span>
          </div>
        ))}
      </div></div>

      <Sub>Reduced motion</Sub>
      <div className="ds-card"><div className="ds-card-body">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          When <span className="ds-mono">prefers-reduced-motion: reduce</span> is set, all CSS animations resolve to <span className="ds-mono">animation: none</span> and transitions to <span className="ds-mono">transition: none</span>. Entry animations (fade-up, slide-in) skip to final state. The live status pulse dot stops animating. Sparkline draw animations are instant.
        </p>
      </div></div>

      <Sub>ARIA patterns</Sub>
      <div className="ds-card"><div className="ds-card-body" style={{ display: 'grid', gap: 8 }}>
        {[
          ['Sidebar nav', 'nav + role="navigation" + aria-label'],
          ['Toggles', 'role="switch" + aria-checked'],
          ['Modals', 'role="dialog" + aria-labelledby + focus trap'],
          ['Tables', 'Semantic <table>, <thead>, <th scope="col">'],
          ['Status pills', 'aria-label describing state (e.g. "Status: live")'],
          ['Toasts', 'role="status" + aria-live="polite"'],
          ['Command palette', 'role="combobox" + aria-expanded + listbox'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>
            <span className="ds-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div></div>
    </Section>
  );
}

window.DSSectionsV2 = {
  AvatarsSection, DropdownsSection, ModalSection, CmdKSection,
  BreadcrumbsSection, PaginationSection, ProgressSection,
  LayoutSection, FontFeaturesSection, AccessibilitySection,
};
