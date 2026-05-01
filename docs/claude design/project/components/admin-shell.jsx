/* Polyforge — Admin shell
   Sidebar (5 sections, 24 routes) + topbar + content slot.
   Routes are static — pages link to one another via plain <a href>.
   Visual tone: control-room, tabular, mono numerals, violet accent. */

const ADM_NAV = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard',   icon: 'dashboard',   label: 'Dashboard',         href: 'Admin.html' },
      { id: 'revenue',     icon: 'dollar',      label: 'Revenue',           href: 'Admin-Revenue.html' },
      { id: 'retention',   icon: 'pie',         label: 'Retention cohorts', href: 'Admin-Retention.html' },
      { id: 'reports',     icon: 'newspaper',   label: 'Scheduled reports', href: 'Admin-Reports.html' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'users',       icon: 'users',         label: 'Users',          href: 'Admin-Users.html' },
      { id: 'user-detail', icon: 'user-check',    label: 'User profile',   href: 'Admin-User-Detail.html', hidden: true },
      { id: 'user-segmentation', icon: 'filter', label: 'Segmentation', href: 'Admin-User-Segmentation.html' },
      { id: 'approvals',   icon: 'shield-check',  label: 'Approvals',      href: 'Admin-Approvals.html', badge: '12', badgeKind: 'warn' },
      { id: 'invites',     icon: 'mail',          label: 'Invites & referrals', href: 'Admin-Invites.html' },
      { id: 'admins',      icon: 'lock',          label: 'Admin team',     href: 'Admin-Admins.html' },
      { id: 'tickets',     icon: 'ticket',        label: 'Support tickets', href: 'Admin-Tickets.html', badge: '34' },
      { id: 'ticket',      icon: 'ticket',        label: 'Ticket #4214',   href: 'Admin-Ticket-Detail.html', hidden: true },
      { id: 'broadcasts',  icon: 'megaphone',     label: 'Broadcasts',     href: 'Admin-Broadcasts.html' },
    ],
  },
  {
    label: 'Trading',
    items: [
      { id: 'strategies',  icon: 'blocks',     label: 'Strategies',      href: 'Admin-Strategies.html' },
      { id: 'orders',      icon: 'cart',       label: 'Orders & fills',  href: 'Admin-Orders.html' },
      { id: 'markets',     icon: 'bar-chart',  label: 'Markets',         href: 'Admin-Markets.html' },
      { id: 'backtests',   icon: 'flask',      label: 'Backtests',       href: 'Admin-Backtests.html' },
      { id: 'listings',    icon: 'shopping-bag', label: 'Marketplace listings', href: 'Admin-Listings.html', badge: '7', badgeKind: 'warn' },
      { id: 'builder',     icon: 'hammer',     label: 'Builder telemetry', href: 'Admin-Builder.html' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { id: 'logs',        icon: 'scroll',     label: 'Audit log',       href: 'Admin-Logs.html' },
      { id: 'health',      icon: 'activity',   label: 'System health',   href: 'Admin-Health.html' },
      { id: 'cache',       icon: 'database',   label: 'Cache & queues',  href: 'Admin-Cache.html' },
      { id: 'venues',      icon: 'globe',      label: 'Venue connectors', href: 'Admin-Venues.html', badge: '1', badgeKind: 'loss' },
      { id: 'sentiment',   icon: 'trending',   label: 'Sentiment ingest', href: 'Admin-Sentiment.html' },
    ],
  },
  {
    label: 'Trust & Safety',
    items: [
      { id: 'abuse',       icon: 'shield-alert', label: 'Abuse queue',   href: 'Admin-Abuse.html', badge: '23' },
      { id: 'config',      icon: 'settings',   label: 'Feature flags',   href: 'Admin-Config.html' },
    ],
  },
];

function AdmShell({ active, title, crumbs = [], actions = null, children, className = '' }) {
  // Tweaks state — persisted by host
  const defaults = window.__TWEAKS__ || {};
  const [density, setDensity] = React.useState(defaults.density || 'cozy');
  const [sidebar, setSidebar] = React.useState(defaults.sidebar || 'expanded');
  const [accent, setAccent]   = React.useState(defaults.accent  || 'electric-blue');
  const [severity, setSeverity] = React.useState(defaults.severity || 'normal');
  const [theme, setTheme]     = React.useState(defaults.theme   || 'dark');
  const [mobileNav, setMobileNav] = React.useState(false);
  const [now, setNow] = React.useState('');

  // Apply theme/accent at root. electric-blue is the default in styles.css
  // — setting data-accent="electric-blue" would NOT match, so we strip the
  // attribute instead. Other values map to the variants in styles.css.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (accent && accent !== 'electric-blue') {
      document.documentElement.setAttribute('data-accent', accent);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
  }, [theme, accent]);

  // Live clock in topbar
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      setNow(`${hh}:${mm}:${ss} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Tweaks UI is owned by admin-tweaks-app.jsx — the shell only mirrors the
  // persisted values into local state for live re-renders. Listen for the host
  // pushing key updates back so density/sidebar/etc. stay in sync.
  React.useEffect(() => {
    const handler = (e) => {
      const d = e.data;
      if (d?.type === '__edit_mode_set_keys' && d.edits) {
        if (d.edits.density != null) setDensity(d.edits.density);
        if (d.edits.sidebar != null) setSidebar(d.edits.sidebar);
        if (d.edits.accent != null) setAccent(d.edits.accent);
        if (d.edits.severity != null) setSeverity(d.edits.severity);
        if (d.edits.theme != null) setTheme(d.edits.theme);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className={`adm-root ${className}`} data-density={density} data-sidebar={sidebar} data-severity={severity}>
      <AdmSidebar active={active} sidebar={sidebar} onCollapse={() => setSidebar(sidebar === 'collapsed' ? 'expanded' : 'collapsed')} mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      {mobileNav && <div className="adm-mobile-backdrop" onClick={() => setMobileNav(false)} aria-hidden="true" />}
      <div className="adm-main">
        <AdmTopbar title={title} crumbs={crumbs} actions={actions} now={now} onMobileNav={() => setMobileNav(true)} theme={theme} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        <main className="adm-content">
          {children}
        </main>
      </div>

    </div>
  );
}

function AdmSidebar({ active, sidebar, onCollapse, mobileOpen, onMobileClose }) {
  return (
    <aside className={`adm-sidebar${mobileOpen ? ' is-mobile-open' : ''}`}>
      <div className="adm-brand">
        <div className="adm-brand-logo" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          <path d="M12 11.7 L4.5 8 M12 11.7 L19.5 8 M12 11.7 V22" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Short center marks on each face: outer-corner → inner meeting
                point (12,12), rendered as a short central segment of each
                diagonal (35%–65% of the way). Reinforces the "convergence"
                feel of the prism mark without crowding the silhouette. */}
            <path d="M12 5.5v3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M6.15 15.25l2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M17.85 15.25l-2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="adm-brand-text">Polyforge <em>· Admin</em></span>
        <button className="adm-brand-collapse" onClick={onCollapse} title="Collapse sidebar" aria-label="Collapse sidebar">
          <AdmIcon name="panel-left" size={14} />
        </button>
      </div>

      <nav className="adm-nav">
        {ADM_NAV.map((section) => (
          <div className="adm-nav-section" key={section.label}>
            <div className="adm-nav-section-label">{section.label}</div>
            {section.items.filter(i => !i.hidden || i.id === active).map((item) => (
              <a key={item.id} href={item.href} className={`adm-nav-link${active === item.id ? ' is-active' : ''}`}>
                <AdmIcon name={item.icon} size={15} />
                <span className="adm-nav-link-label">{item.label}</span>
                {item.badge && (
                  <span className={`adm-nav-link-badge${item.badgeKind === 'warn' ? ' is-warn' : ''}${item.badgeKind === 'loss' ? ' is-loss' : ''}`}>{item.badge}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="adm-foot">
        <a className="adm-foot-link" href="Admin-Login.html">
          <AdmIcon name="keyboard" size={14} />
          <span>Shortcuts</span>
          <kbd style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>⌘K</kbd>
        </a>
        <a className="adm-foot-link" href="Docs.html">
          <AdmIcon name="help" size={14} />
          <span>Help & docs</span>
        </a>
        <div className="adm-user">
          <div className="adm-user-avatar">MC</div>
          <div style={{ minWidth: 0, flex: 1 }} className="adm-user-meta">
            <div className="adm-user-name">Maya Chen</div>
            <div className="adm-user-role">
              <span className="role-pill">Root</span>
              <span style={{ fontFamily: 'Geist Mono, monospace' }}>maya@</span>
            </div>
          </div>
          <button className="adm-foot-link" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }} title="Sign out">
            <AdmIcon name="log-out" size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function AdmTopbar({ title, crumbs, actions, now, onMobileNav, theme, onThemeToggle }) {
  return (
    <header className="adm-topbar">
      <button className="adm-icon-btn" onClick={onMobileNav} title="Menu" style={{ display: 'none' }} aria-label="Open menu">
        <AdmIcon name="panel-left" size={15} />
      </button>

      {crumbs.length > 0 ? (
        <div className="adm-topbar-crumbs">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">/</span>}
              {c.href ? <a href={c.href} style={{ color: 'inherit', textDecoration: 'none' }}>{c.label}</a> : <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>}
            </React.Fragment>
          ))}
          <span className="sep">/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{title}</span>
        </div>
      ) : (
        <div className="adm-topbar-title">{title}</div>
      )}

      <div className="adm-topbar-actions">
        <div className="adm-search" role="search">
          <AdmIcon name="search" size={13} />
          <input type="text" placeholder="Jump to user, order, market…" />
          <kbd>⌘K</kbd>
        </div>
        <div title="UTC clock" style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', padding: '0 8px', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', height: 20, display: 'flex', alignItems: 'center' }}>
          {now}
        </div>
        {actions}
        <button className="adm-icon-btn" title="Toggle theme" onClick={onThemeToggle} aria-label="Toggle theme">
          <AdmIcon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
        </button>
        <button className="adm-icon-btn" title="Notifications" aria-label="Notifications">
          <AdmIcon name="bell" size={14} />
          <span className="badge">3</span>
        </button>
      </div>
    </header>
  );
}

// Legacy inline tweaks panel — kept for reference but no longer rendered.
// admin-tweaks-app.jsx owns the live Tweaks UI now.
// eslint-disable-next-line no-unused-vars
function _AdmTweaks_unused({ density, setDensity, sidebar, setSidebar, accent, setAccent, severity, setSeverity, theme, setTheme, onClose }) {
  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>{children}</div>
    </div>
  );
  const Pill = ({ on, onClick, children }) => (
    <button onClick={onClick} className={`adm-btn adm-btn-sm ${on ? 'adm-btn-primary' : 'adm-btn-secondary'}`} style={{ height: 26 }}>{children}</button>
  );
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, width: 320, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-3)', zIndex: 80, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Tweaks</div>
        <button className="adm-icon-btn" style={{ marginLeft: 'auto', width: 24, height: 24 }} onClick={onClose} aria-label="Close">
          <AdmIcon name="x" size={12} />
        </button>
      </div>
      <div style={{ padding: '4px 16px 12px' }}>
        <Row label="Theme">
          <Pill on={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</Pill>
          <Pill on={theme === 'light'} onClick={() => setTheme('light')}>Light</Pill>
        </Row>
        <Row label="Density">
          <Pill on={density === 'cozy'} onClick={() => setDensity('cozy')}>Cozy</Pill>
          <Pill on={density === 'compact'} onClick={() => setDensity('compact')}>Compact</Pill>
        </Row>
        <Row label="Sidebar">
          <Pill on={sidebar === 'expanded'} onClick={() => setSidebar('expanded')}>Wide</Pill>
          <Pill on={sidebar === 'collapsed'} onClick={() => setSidebar('collapsed')}>Rail</Pill>
        </Row>
        <Row label="Accent">
          <Pill on={accent === 'violet'} onClick={() => setAccent('violet')}>Violet</Pill>
          <Pill on={accent === 'mint'} onClick={() => setAccent('mint')}>Mint</Pill>
          <Pill on={accent === 'amber'} onClick={() => setAccent('amber')}>Amber</Pill>
        </Row>
        <Row label="Severity">
          <Pill on={severity === 'muted'} onClick={() => setSeverity('muted')}>Muted</Pill>
          <Pill on={severity === 'normal'} onClick={() => setSeverity('normal')}>Normal</Pill>
          <Pill on={severity === 'loud'} onClick={() => setSeverity('loud')}>Loud</Pill>
        </Row>
      </div>
    </div>
  );
}

/* ---- Reusable admin primitives shared across pages ---- */

function AdmStat({ label, value, delta, deltaKind = 'tertiary', icon, iconKind = '', spark, sparkKind, hint }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-label">
        <span>{label}</span>
        {icon && <div className={`adm-stat-icon ${iconKind}`}><AdmIcon name={icon} size={13} /></div>}
      </div>
      <div className="adm-stat-value">{value}</div>
      {delta != null && (
        <div className={`adm-stat-delta ${deltaKind === 'gain' ? 'is-gain' : deltaKind === 'loss' ? 'is-loss' : ''}`}>
          {deltaKind === 'gain' && <AdmIcon name="arrow-up" size={11} />}
          {deltaKind === 'loss' && <AdmIcon name="arrow-down" size={11} />}
          {delta}{hint && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{hint}</span>}
        </div>
      )}
      {spark && <AdmSpark points={spark} kind={sparkKind} />}
    </div>
  );
}

function AdmSpark({ points, kind = '', height = 36 }) {
  // points: array of numbers, normalized to 0..1
  if (!points || !points.length) return null;
  const w = 200;
  const h = height;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const ys = points.map(p => h - 2 - ((p - min) / range) * (h - 6));
  const linePath = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`;
  return (
    <svg className={`adm-spark ${kind === 'gain' ? 'is-gain' : kind === 'loss' ? 'is-loss' : ''}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="area" d={areaPath} />
      <path className="line" d={linePath} />
    </svg>
  );
}

function AdmPill({ kind, dot, pulse, children }) {
  const cls = `adm-pill${kind ? ` is-${kind}` : ''}${dot ? ' has-dot' : ''}${pulse ? ' is-pulse' : ''}`;
  return <span className={cls}>{children}</span>;
}

function AdmPageHead({ title, sub, actions }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1 className="adm-page-title">{title}</h1>
        {sub && <p className="adm-page-sub">{sub}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </div>
  );
}

function AdmSectionHead({ title, action }) {
  return (
    <div className="adm-section-head">
      <span className="adm-section-title">{title}</span>
      <span className="adm-section-rule" />
      {action}
    </div>
  );
}

function AdmFilter({ active, count, children, onClick }) {
  return (
    <button className={`adm-filter${active ? ' is-active' : ''}`} onClick={onClick}>
      {children}
      {count != null && <span className="count">{count}</span>}
    </button>
  );
}

function AdmAvatar({ name, size = 'sm', tone }) {
  const initials = (name || '??').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const cls = `adm-avatar${size === 'md' ? ' adm-avatar-md' : ''}${size === 'lg' ? ' adm-avatar-lg' : ''}`;
  // Neutral by default (matches Linear/docs); pass `tone` only for status-coded pills.
  return <span className={cls} style={tone ? { background: tone, color: '#fff', borderColor: tone } : undefined}>{initials}</span>;
}

function AdmBar({ pct, kind, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div className={`adm-bar${kind ? ` is-${kind}` : ''}`} style={{ flex: 1, minWidth: 60 }}>
        <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {label && <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', minWidth: 36, textAlign: 'right' }}>{label}</span>}
    </div>
  );
}

Object.assign(window, { AdmShell, AdmStat, AdmSpark, AdmPill, AdmPageHead, AdmSectionHead, AdmFilter, AdmAvatar, AdmBar, ADM_NAV });
