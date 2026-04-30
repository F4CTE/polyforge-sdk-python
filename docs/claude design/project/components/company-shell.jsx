/* eslint-disable */
/* Shared Polyforge Company-page shell — sub-nav + header + layout wrapper */

(() => {
  const { useState, useEffect } = React;

  const COMPANY_PAGES = [
    { slug: 'about',     label: 'About',     href: 'About.html' },
    { slug: 'changelog', label: 'Changelog', href: 'Changelog.html' },
    { slug: 'roadmap',   label: 'Roadmap',   href: 'Roadmap.html' },
    { slug: 'status',    label: 'Status',    href: 'Status.html', showDot: true },
    { slug: 'contact',   label: 'Contact',   href: 'Contact.html' },
  ];

  function CompanySubnav({ active, statusOk = true }) {
    return (
      <div className="company-subnav" role="navigation" aria-label="Company pages">
        <div className="company-subnav-inner">
          {COMPANY_PAGES.map((p) => (
            <a
              key={p.slug}
              href={p.href}
              className={'company-sub-link' + (p.slug === active ? ' active' : '')}
              aria-current={p.slug === active ? 'page' : undefined}
            >
              {p.showDot && (
                <span
                  className="dot dot-pulse"
                  style={{ background: statusOk ? 'var(--gain)' : 'var(--warning)' }}
                />
              )}
              {p.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  function CompanyPageHeader({ eyebrow, title, lede, meta }) {
    return (
      <header className="company-header">
        <div className="company-container">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {lede && <p className="lede">{lede}</p>}
          {meta && meta.length > 0 && (
            <div className="company-header-meta">
              {meta.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="sep">·</span>}
                  <span>{m.label && <strong>{m.label}: </strong>}{m.value}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </header>
    );
  }

  function CompanyPage({ active, statusOk, children }) {
    return (
      <>
        <Nav />
        <CompanySubnav active={active} statusOk={statusOk} />
        <main className="company-main">{children}</main>
        <Footer />
      </>
    );
  }

  function CompanySection({ title, subtitle, children, id }) {
    return (
      <section className="company-section" id={id}>
        <div className="company-container">
          {title && <h2 className="company-section-title">{title}</h2>}
          {subtitle && <p className="company-section-subtitle">{subtitle}</p>}
          {children}
        </div>
      </section>
    );
  }

  Object.assign(window, {
    COMPANY_PAGES,
    CompanySubnav,
    CompanyPageHeader,
    CompanyPage,
    CompanySection,
  });
})();
