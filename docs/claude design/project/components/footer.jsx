function Footer() {
  const onLanding = /Landing Page\.html$/i.test(location.pathname) || /\/$/.test(location.pathname) || location.pathname.endsWith('/index.html');
  const p = onLanding ? '' : 'Landing Page.html';
  const cols = [
    { title: 'Product', links: [
      ['Strategy builder', p + '#product'],
      ['Whale intelligence', p + '#whales'],
      ['Backtest', p + '#product'],
      ['Paper trading', p + '#product'],
      ['Marketplace', p + '#product'],
    ]},
    { title: 'Developers', links: [
      ['Documentation', 'Docs.html'],
      ['Quickstart', 'Docs-Quickstart.html'],
      ['SDK reference', 'Docs-SDK.html'],
      ['REST API', 'Docs-API.html'],
      ['MCP server', 'Docs-MCP.html'],
    ]},
    { title: 'Company', links: [
      ['About', 'About.html'],
      ['Changelog', 'Changelog.html'],
      ['Roadmap', 'Roadmap.html'],
      ['Status', 'Status.html'],
      ['Contact', 'Contact.html'],
    ]},
    { title: 'Legal', links: [
      ['Terms of Service', 'Terms.html'],
      ['Privacy Policy', 'Privacy.html'],
      ['Risk disclosure', 'Risk Disclosure.html'],
      ['Cookie Policy', 'Cookies.html'],
    ]},
  ];
  return (
    <footer className="pf-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a href={p + '#top' || '#top'} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
              <span style={{ color: 'var(--accent-text)' }}><Icon name="logo" size={22}/></span> polyforge
            </a>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 14, maxWidth: 280, lineHeight: 1.55 }}>
              Algorithmic trading for prediction markets. Dark by default. Precise by design.
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
              {['X','Discord','Telegram','GitHub'].map(n => (
                <a key={n} href="#" className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }} aria-label={n}>{n[0]}</a>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 28, letterSpacing: '0.06em', lineHeight: 1.8 }}>
              v6.32.0 · eu-west-2<br/>
              builder program · tier 3
            </div>
          </div>
          {cols.map(c => (
            <div key={c.title}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 16 }}>{c.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.links.map(([label, href]) => (
                  <li key={label}><a href={href} style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', transition: 'color 120ms' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }} className="mono">
          <span>© 2026 Polyforge · Algorithmic trading involves risk of loss.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="dot dot-pulse"/> all systems operational</span>
        </div>
      </div>
    </footer>
  );
}
window.Footer = Footer;
