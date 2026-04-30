function StatusPill() {
  // subtle connection-status cluster: venues + our infra
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const services = [
    { name: 'Polymarket',       state: 'operational', detail: 'CLOB · WS · Gamma',     latency: '84ms' },
    { name: 'Kalshi',           state: 'operational', detail: 'REST · WS · markets',   latency: '61ms' },
    { name: 'Execution engine', state: 'operational', detail: 'signer · queue · routes', latency: '38ms' },
    { name: 'Strategy runtime', state: 'operational', detail: '847 strategies live',    latency: '—'    },
    { name: 'Whale ingestion',  state: 'operational', detail: '2,341 wallets tracked',  latency: '47/min' },
    { name: 'Backtest cluster', state: 'degraded',    detail: 'queue depth elevated',   latency: '2.1s' },
  ];
  const worst = services.some(s => s.state === 'outage') ? 'outage'
              : services.some(s => s.state === 'degraded') ? 'degraded' : 'operational';
  const label = worst === 'operational' ? 'All systems normal'
              : worst === 'degraded' ? 'Partial degradation' : 'Incident in progress';
  const dotCls = worst === 'operational' ? 'status-dot-live'
              : worst === 'degraded' ? 'status-dot-warn' : 'status-dot-error';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button className="status-pill" onClick={() => setOpen(v => !v)} aria-haspopup="true" aria-expanded={open}>
        <span className={`status-dot ${dotCls}`} />
        <span className="status-pill-label">{label}</span>
        <Icon name="chevron-down" size={11}/>
      </button>
      {open && (
        <div className="status-popover" role="dialog" aria-label="System status">
          <div className="status-pop-head">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>System status</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>updated just now · auto-refresh 30s</div>
            </div>
            <a href="Status.html" className="status-link" style={{ fontSize: 12 }}>full page <Icon name="arrow-right" size={11}/></a>
          </div>
          <div className="status-pop-list">
            {services.map(s => (
              <div key={s.name} className="status-pop-row">
                <span className={`status-dot ${s.state === 'operational' ? 'status-dot-live' : s.state === 'degraded' ? 'status-dot-warn' : 'status-dot-error'}`}/>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.detail}</div>
                </div>
                <span className="mono tabnum" style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{s.latency}</span>
              </div>
            ))}
          </div>
          <div className="status-pop-foot">
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>region</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>us-east-1 · primary</span>
            <span style={{ flex: 1 }}/>
            <span className="mono tabnum" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>uptime 99.98% · 90d</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Nav() {
  const [theme, setTheme] = useTweak('theme');
  const [cmdOpen, setCmdOpen] = useCmdK();
  // On sub-pages, anchor links should route back to the landing page.
  const onLanding = /(?:^|\/)(?:index\.html|Landing Page\.html)?$/.test(location.pathname) ||
                    location.pathname.endsWith('/') ||
                    /Landing Page\.html$/i.test(location.pathname);
  const prefix = onLanding ? '' : 'Landing Page.html';
  const links = [
    ['product', prefix + '#product'],
    ['blocks', prefix + '#blocks'],
    ['whales', prefix + '#whales'],
    ['developers', prefix + '#developers'],
    ['pricing', 'Pricing.html'],
    ['docs', 'Docs.html'],
  ];
  const homeHref = prefix + '#top' || '#top';
  return (
    <nav className="pf-nav">
      <div className="container nav-inner">
        <a href={homeHref} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>
          <span style={{ color: 'var(--accent-text)', display: 'inline-flex' }}><Icon name="logo" size={20} /></span>
          polyforge
          <span className="chip" style={{ marginLeft: 6, height: 18, fontSize: 10 }}>beta</span>
        </a>
        <div className="nav-links">
          {links.map(([l, href]) => <a key={l} href={href}>{l}</a>)}
        </div>
        <div className="nav-right">
          <StatusPill/>
          <button
            className="btn btn-ghost btn-sm"
            style={{ gap: 6, paddingRight: 6 }}
            aria-label="Search (Cmd+K)"
            onClick={() => setCmdOpen(true)}
          >
            <Icon name="search" size={14} />
            <span className="kbd">⌘K</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" style={{ width: 32, padding: 0 }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
          <a className="btn btn-secondary btn-sm" href="Login.html">sign in</a>
          <a className="btn btn-primary btn-sm" href="Sign Up.html">start free <Icon name="arrow-right" size={13} /></a>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </nav>
  );
}
window.Nav = Nav;
window.StatusPill = StatusPill;
