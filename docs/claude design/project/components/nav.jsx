function Nav() {
  const [theme, setTheme] = useTweak('theme');
  const links = [
    ['product', '#product'],
    ['blocks', '#blocks'],
    ['whales', '#whales'],
    ['developers', '#developers'],
    ['pricing', '#pricing'],
    ['docs', '#docs'],
  ];
  return (
    <nav className="pf-nav">
      <div className="container nav-inner">
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>
          <span style={{ color: 'var(--accent-text)', display: 'inline-flex' }}><Icon name="logo" size={20} /></span>
          polyforge
          <span className="chip" style={{ marginLeft: 6, height: 18, fontSize: 10 }}>beta</span>
        </a>
        <div className="nav-links">
          {links.map(([l, href]) => <a key={l} href={href}>{l}</a>)}
        </div>
        <div className="nav-right">
          <button className="btn btn-ghost btn-sm" style={{ gap: 6, paddingRight: 6 }} aria-label="Search markets">
            <Icon name="search" size={14} />
            <span className="kbd">⌘K</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" style={{ width: 32, padding: 0 }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
          <a className="btn btn-secondary btn-sm" href="#">sign in</a>
          <a className="btn btn-primary btn-sm" href="#">start free <Icon name="arrow-right" size={13} /></a>
        </div>
      </div>
    </nav>
  );
}
window.Nav = Nav;
