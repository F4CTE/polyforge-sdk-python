/* Polyforge — User App shell
   Trader-facing companion to the admin shell. Shares all .adm-* CSS and
   AdmIcon, but exposes a different IA tuned to the trader's workflow:
   Trade · Markets · Whales · Backtests · Portfolio · Account.
   The brand chip drops the "· Admin" suffix; everything else inherits. */

const USR_NAV = [
  {
    label: 'Trade',
    items: [
      { id: 'dashboard',     icon: 'dashboard',     label: 'Mission control', href: 'App.html' },
      { id: 'strategies',    icon: 'blocks',        label: 'Strategies',      href: 'App-Strategies.html' },
      { id: 'strategy',      icon: 'blocks',        label: 'Strategy detail', href: 'App-Strategy-Detail.html', hidden: true },
      { id: 'builder',       icon: 'hammer',        label: 'Builder',         href: 'App-Builder.html' },
      { id: 'orders',        icon: 'cart',          label: 'Orders & fills',  href: 'App-Orders.html' },
      { id: 'positions',     icon: 'pie',           label: 'Positions',       href: 'App-Positions.html' },
    ],
  },
  {
    label: 'Discover',
    items: [
      { id: 'markets',       icon: 'bar-chart',     label: 'Markets',         href: 'App-Markets.html' },
      { id: 'market',        icon: 'bar-chart',     label: 'Market detail',   href: 'App-Market-Detail.html', hidden: true },
      { id: 'whales',        icon: 'trending',      label: 'Whales',          href: 'App-Whales.html' },
      { id: 'backtests',     icon: 'flask',         label: 'Backtests',       href: 'App-Backtests.html' },
      { id: 'marketplace',   icon: 'shopping-bag',  label: 'Marketplace',     href: 'App-Marketplace.html' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'wallet',        icon: 'dollar',        label: 'Wallet',          href: 'App-Wallet.html' },
      { id: 'notifications', icon: 'bell',          label: 'Notifications',   href: 'App-Notifications.html', badge: '4', badgeKind: 'accent' },
      { id: 'activity',      icon: 'scroll',        label: 'Activity log',    href: 'App-Activity.html' },
      { id: 'team',          icon: 'users',         label: 'Team',            href: 'App-Team.html' },
      { id: 'keys',          icon: 'lock',          label: 'API keys',        href: 'App-Keys.html' },
      { id: 'settings',      icon: 'settings',      label: 'Settings',        href: 'App-Settings.html' },
    ],
  },
];

function UsrShell({ active, title, crumbs = [], actions = null, mode = 'paper', children, className = '' }) {
  const defaults = window.__TWEAKS__ || {};
  const [density, setDensity] = React.useState(defaults.density || 'cozy');
  const [sidebar, setSidebar] = React.useState(defaults.sidebar || 'expanded');
  const [accent, setAccent]   = React.useState(defaults.accent  || 'electric-blue');
  const [theme, setTheme]     = React.useState(defaults.theme   || 'dark');
  const [tradeMode, setTradeMode] = React.useState(defaults.tradeMode || mode);
  const [mobileNav, setMobileNav] = React.useState(false);
  const [now, setNow] = React.useState('');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (accent && accent !== 'electric-blue') {
      document.documentElement.setAttribute('data-accent', accent);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
  }, [theme, accent]);

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

  React.useEffect(() => {
    const handler = (e) => {
      const d = e.data;
      if (d?.type === '__edit_mode_set_keys' && d.edits) {
        if (d.edits.density != null) setDensity(d.edits.density);
        if (d.edits.sidebar != null) setSidebar(d.edits.sidebar);
        if (d.edits.accent != null) setAccent(d.edits.accent);
        if (d.edits.theme != null) setTheme(d.edits.theme);
        if (d.edits.tradeMode != null) setTradeMode(d.edits.tradeMode);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className={`adm-root usr-root ${className}`} data-density={density} data-sidebar={sidebar}>
      <UsrSidebar active={active} sidebar={sidebar} onCollapse={() => setSidebar(sidebar === 'collapsed' ? 'expanded' : 'collapsed')} mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} tradeMode={tradeMode} setTradeMode={setTradeMode} />
      <div className="adm-main">
        <UsrTopbar title={title} crumbs={crumbs} actions={actions} now={now} onMobileNav={() => setMobileNav(true)} theme={theme} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} tradeMode={tradeMode} />
        <main className="adm-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function UsrSidebar({ active, sidebar, onCollapse, mobileOpen, tradeMode, setTradeMode }) {
  return (
    <aside className={`adm-sidebar usr-sidebar${mobileOpen ? ' is-mobile-open' : ''}`}>
      <div className="adm-brand">
        <div className="adm-brand-logo" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="m3 7 9 5 9-5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 12v10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6.15 15.25l2.7-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M17.85 15.25l-2.7-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="adm-brand-text">Polyforge</span>
        <button className="adm-brand-collapse" onClick={onCollapse} title="Collapse sidebar" aria-label="Collapse sidebar">
          <AdmIcon name="panel-left" size={14} />
        </button>
      </div>

      {/* Trade mode toggle (paper / live) — replaces admin's plain brand row */}
      <div className="usr-mode-toggle" role="group" aria-label="Trade mode">
        <button
          className={`usr-mode-btn${tradeMode === 'paper' ? ' is-active' : ''}`}
          onClick={() => setTradeMode('paper')}
          title="Paper trading — simulated fills, no real money"
        >
          <span className="usr-mode-dot" />
          <span>Paper</span>
        </button>
        <button
          className={`usr-mode-btn${tradeMode === 'live' ? ' is-active is-live' : ''}`}
          onClick={() => setTradeMode('live')}
          title="Live trading — real orders on Polymarket / Kalshi"
        >
          <span className="usr-mode-dot is-live" />
          <span>Live</span>
        </button>
      </div>

      <nav className="adm-nav">
        {USR_NAV.map((section) => (
          <div className="adm-nav-section" key={section.label}>
            <div className="adm-nav-section-label">{section.label}</div>
            {section.items.filter(i => !i.hidden || i.id === active).map((item) => (
              <a key={item.id} href={item.href} className={`adm-nav-link${active === item.id ? ' is-active' : ''}`}>
                <AdmIcon name={item.icon} size={15} />
                <span className="adm-nav-link-label">{item.label}</span>
                {item.badge && (
                  <span className={`adm-nav-link-badge${item.badgeKind === 'accent' ? ' is-accent' : ''}${item.badgeKind === 'warn' ? ' is-warn' : ''}${item.badgeKind === 'loss' ? ' is-loss' : ''}`}>{item.badge}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="adm-foot">
        <a className="adm-foot-link" href="Guide.html">
          <AdmIcon name="help" size={14} />
          <span>Guide</span>
        </a>
        <a className="adm-foot-link" href="Docs.html">
          <AdmIcon name="newspaper" size={14} />
          <span>Docs</span>
          <kbd style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>⌘?</kbd>
        </a>
        <div className="adm-user">
          <div className="adm-user-avatar">AD</div>
          <div style={{ minWidth: 0, flex: 1 }} className="adm-user-meta">
            <div className="adm-user-name">Ada Diallo</div>
            <div className="adm-user-role">
              <span className="role-pill is-pro">Pro</span>
              <span style={{ fontFamily: 'Geist Mono, monospace' }}>$12,847</span>
            </div>
          </div>
          <a className="adm-foot-link" href="App-Settings.html" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }} title="Account settings">
            <AdmIcon name="settings" size={13} />
          </a>
        </div>
      </div>
    </aside>
  );
}

function UsrTopbar({ title, crumbs, actions, now, onMobileNav, theme, onThemeToggle, tradeMode }) {
  return (
    <header className="adm-topbar usr-topbar">
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
          <input type="text" placeholder="Search markets, strategies, whales…" />
          <kbd>⌘K</kbd>
        </div>
        <div title="UTC clock" style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', padding: '0 8px', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', height: 20, display: 'flex', alignItems: 'center' }}>
          {now}
        </div>
        {actions}
        <button className="adm-icon-btn" title="Toggle theme" onClick={onThemeToggle} aria-label="Toggle theme">
          <AdmIcon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
        </button>
        <a className="adm-icon-btn" title="Notifications" aria-label="Notifications" href="App-Notifications.html">
          <AdmIcon name="bell" size={14} />
          <span className="badge">4</span>
        </a>
      </div>
    </header>
  );
}

/* ---- Reusable user-app primitives.
   Mostly aliased Adm primitives so existing pages stay tidy. ---- */

function UsrTickerStrip({ items }) {
  // Compact horizontal price tape — drop above page-head when relevant
  return (
    <div className="usr-ticker">
      <div className="usr-ticker-track">
        {[...items, ...items].map((m, i) => (
          <div key={i} className="usr-ticker-item">
            <span className="usr-ticker-sym">{m.sym}</span>
            <span className="usr-ticker-px">¢{Math.round(m.px * 100)}</span>
            <span className={m.chg >= 0 ? 'usr-ticker-chg is-gain' : 'usr-ticker-chg is-loss'}>
              {m.chg >= 0 ? '+' : ''}{m.chg.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsrEquityCurve({ points, height = 96, kind = 'gain', showAxis = true, label }) {
  if (!points || !points.length) return null;
  const w = 600, h = height;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const ys = points.map(p => h - 6 - ((p - min) / range) * (h - 12));
  const linePath = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`;
  const last = ys[ys.length - 1];
  const color = kind === 'loss' ? 'var(--loss-text)' : 'var(--gain-text)';
  return (
    <svg className="usr-equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`eq-${kind}-${height}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showAxis && (
        <g stroke="var(--border-subtle)" strokeWidth="0.5">
          {[0.25, 0.5, 0.75].map((p, i) => (
            <line key={i} x1="0" x2={w} y1={h * p} y2={h * p} />
          ))}
        </g>
      )}
      <path d={areaPath} fill={`url(#eq-${kind}-${height})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={w} cy={last} r="3" fill={color} />
      <circle cx={w} cy={last} r="6" fill={color} opacity="0.25" />
      {label && <text x={w - 4} y={14} textAnchor="end" fill={color} fontFamily="Geist Mono, monospace" fontSize="10" fontWeight="600">{label}</text>}
    </svg>
  );
}

function UsrVenueBadge({ venue }) {
  const map = {
    polymarket: { label: 'Polymarket', color: '#4F6EF7' },
    kalshi:     { label: 'Kalshi',     color: '#16A34A' },
  };
  const v = map[venue] || { label: venue, color: 'var(--text-tertiary)' };
  return (
    <span className="usr-venue-badge" style={{ borderColor: `color-mix(in srgb, ${v.color} 35%, transparent)`, color: v.color, background: `color-mix(in srgb, ${v.color} 8%, transparent)` }}>
      <span className="usr-venue-dot" style={{ background: v.color }} />
      {v.label}
    </span>
  );
}

Object.assign(window, { UsrShell, UsrTickerStrip, UsrEquityCurve, UsrVenueBadge, USR_NAV });
