// Shared shell for all four legal pages: reading progress, sticky sidebar TOC,
// page header with metadata + callout, Markdown content, footer.

(function () {
  const { useState, useEffect, useRef, useMemo } = React;

  function ReadingProgress() {
    const [pct, setPct] = useState(0);
    useEffect(() => {
      const onScroll = () => {
        const doc = document.documentElement;
        const h = doc.scrollHeight - doc.clientHeight;
        setPct(h > 0 ? Math.min(100, (doc.scrollTop / h) * 100) : 0);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return (
      <div className="reading-progress" aria-hidden="true">
        <div className="reading-progress-bar" style={{ width: pct + '%' }} />
      </div>
    );
  }

  function smoothScrollTo(targetY, duration = 560) {
    const start = window.scrollY || document.documentElement.scrollTop;
    const delta = targetY - start;
    if (Math.abs(delta) < 2) return;
    // easeInOutCubic
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const t0 = performance.now();
    let raf = 0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + delta * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // cancel on user scroll-wheel / touch so we don't fight them
    const cancel = () => { cancelAnimationFrame(raf); cleanup(); };
    const cleanup = () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (['ArrowDown','PageDown','ArrowUp','PageUp','Home','End',' '].includes(e.key)) cancel();
    };
    window.addEventListener('wheel', cancel, { passive: true, once: true });
    window.addEventListener('touchstart', cancel, { passive: true, once: true });
    window.addEventListener('keydown', onKey, { once: true });
    setTimeout(cleanup, duration + 50);
  }

  function BackToTopFab() {
    const [visible, setVisible] = useState(false);
    const [pct, setPct] = useState(0);
    useEffect(() => {
      const onScroll = () => {
        const doc = document.documentElement;
        const y = doc.scrollTop;
        const h = doc.scrollHeight - doc.clientHeight;
        setVisible(y > 360);
        setPct(h > 0 ? Math.min(100, (y / h) * 100) : 0);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const up = () => smoothScrollTo(0, 560);
    return (
      <button
        className={'legal-fab' + (visible ? ' visible' : '')}
        onClick={up}
        aria-label="Back to top"
        title="Back to top"
        style={{ ['--pct']: pct }}
      >
        <span className="legal-fab-ring" aria-hidden="true" />
        <Icon name="arrow-up" size={16} />
      </button>
    );
  }

  function SidebarTOC({ items, readMin }) {
    const [active, setActive] = useState(items[0]?.slug);
    const [copiedSlug, setCopiedSlug] = useState(null);

    useEffect(() => {
      // Observe each H2 — "active" = the one whose top is closest to but ≤ 120px from viewport top.
      const handler = () => {
        const offset = 140;
        let best = items[0]?.slug;
        let bestDist = Infinity;
        for (const it of items) {
          const el = document.getElementById(it.slug);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top <= offset) {
            const dist = offset - top;
            if (dist < bestDist) { bestDist = dist; best = it.slug; }
          }
        }
        setActive(best);
      };
      handler();
      window.addEventListener('scroll', handler, { passive: true });
      return () => window.removeEventListener('scroll', handler);
    }, [items]);

    const onClick = (e, slug) => {
      e.preventDefault();
      const el = document.getElementById(slug);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 88;
      smoothScrollTo(top, 520);
      history.replaceState(null, '', '#' + slug);
    };

    const copyLink = async (slug) => {
      const url = location.origin + location.pathname + '#' + slug;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 1400);
      } catch (e) {}
    };

    return (
      <aside className="legal-sidebar" aria-label="Table of contents">
        <div className="legal-sidebar-inner">
          <div className="legal-sidebar-head">
            <div className="legal-sidebar-label">On this page</div>
            {readMin && <div className="legal-sidebar-read mono">{readMin} min read</div>}
          </div>
          <nav className="legal-toc">
            <ol>
              {items.map((it) => (
                <li key={it.slug} className={active === it.slug ? 'active' : ''}>
                  <a href={'#' + it.slug} onClick={(e) => onClick(e, it.slug)}>
                    {it.number && <span className="legal-toc-num mono">{it.number}</span>}
                    <span className="legal-toc-title">{it.title}</span>
                  </a>
                  <button
                    className="legal-toc-copy"
                    onClick={() => copyLink(it.slug)}
                    aria-label={'Copy link to ' + it.title}
                    title={copiedSlug === it.slug ? 'Copied!' : 'Copy link'}
                  >
                    {copiedSlug === it.slug ? (
                      <Icon name="check" size={12}/>
                    ) : (
                      <Icon name="copy" size={12}/>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="legal-sidebar-foot">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => smoothScrollTo(0, 560)}
            >
              Back to top
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => window.print()}
              title="Print or save as PDF"
            >
              <Icon name="copy" size={11}/> Print / PDF
            </button>
          </div>
        </div>
      </aside>
    );
  }

  function LegalPage({ docKey, title, kind, effective, lastUpdated, callout, source, children }) {
    const toc = useMemo(() => buildTOC(source), [source]);
    const readMin = useMemo(() => readingTime(source), [source]);

    // Apply tweak side effects on mount (match landing)
    useEffect(() => {
      const tw = window.__TWEAKS__ || {};
      document.documentElement.setAttribute('data-theme', tw.theme || 'dark');
      if (tw.accent && tw.accent !== 'electric-blue') {
        document.documentElement.setAttribute('data-accent', tw.accent);
      }
    }, []);

    // Scroll to anchor on load
    useEffect(() => {
      if (location.hash) {
        const el = document.getElementById(location.hash.slice(1));
        if (el) {
          setTimeout(() => {
            const top = el.getBoundingClientRect().top + window.scrollY - 88;
            window.scrollTo({ top, behavior: 'smooth' });
          }, 120);
        }
      }
    }, []);

    return (
      <>
        <ReadingProgress />
        <BackToTopFab />
        <Nav />
        <main id="main" className="legal-main">
          <div className="container legal-container">
            <div className="legal-layout">
              <SidebarTOC items={toc} readMin={readMin} />
              <article className="legal-article">
                <header className="legal-header">
                  <div className="legal-breadcrumb">
                    <a href="Landing Page.html">Polyforge</a>
                    <span>/</span>
                    <span>Legal</span>
                    <span>/</span>
                    <span className="legal-breadcrumb-current">{kind}</span>
                  </div>
                  <div className="legal-kind-row">
                    <span className="legal-kind-pill">{kind}</span>
                    <span className="legal-kind-sep" />
                    <span className="mono legal-kind-meta">v1.0 · EN</span>
                  </div>
                  <h1 className="legal-title">{title}</h1>
                  <dl className="legal-meta">
                    <div>
                      <dt>Effective</dt>
                      <dd className="mono tabnum">{effective}</dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd className="mono tabnum">{lastUpdated}</dd>
                    </div>
                    <div>
                      <dt>Reading time</dt>
                      <dd className="mono tabnum">~{readMin} min</dd>
                    </div>
                    <div>
                      <dt>Operator</dt>
                      <dd>Shems Chelgoui — Polyforge Labs (EI, FR)</dd>
                    </div>
                  </dl>
                  {callout && (
                    <div className={'legal-hero-callout' + (callout.variant ? ' ' + callout.variant : '')}>
                      <div className="legal-hero-callout-icon">
                        <Icon name={callout.icon || 'shield'} size={18}/>
                      </div>
                      <div>
                        <div className="legal-hero-callout-title">{callout.title}</div>
                        <p>{callout.body}</p>
                      </div>
                    </div>
                  )}
                </header>

                {/* Related documents strip */}
                <nav className="legal-related no-scrollbar" aria-label="Related documents">
                  {[
                    { k: 'terms',   label: 'Terms of Service',   href: 'Terms.html' },
                    { k: 'privacy', label: 'Privacy Policy',     href: 'Privacy.html' },
                    { k: 'risk',    label: 'Risk Disclosure',    href: 'Risk Disclosure.html' },
                    { k: 'cookies', label: 'Cookie Policy',      href: 'Cookies.html' },
                  ].map((d) => (
                    <a
                      key={d.k}
                      href={d.href}
                      className={'legal-related-link' + (d.k === docKey ? ' active' : '')}
                      aria-current={d.k === docKey ? 'page' : undefined}
                    >
                      {d.label}
                    </a>
                  ))}
                </nav>

                {/* Optional per-page widget (cookies preferences, etc.) */}
                {children}

                <MarkdownDoc source={source} />

                <footer className="legal-article-foot">
                  <div>
                    <div className="legal-article-foot-label mono">Questions?</div>
                    <p>
                      Reach legal & compliance at{' '}
                      <a href="mailto:legal@polyforge.app">legal@polyforge.app</a>.
                      For data-subject requests, use{' '}
                      <a href="mailto:privacy@polyforge.app">privacy@polyforge.app</a>.
                    </p>
                  </div>
                  <div className="legal-article-foot-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                      Save as PDF
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => smoothScrollTo(0, 560)}>
                      Back to top
                    </button>
                  </div>
                </footer>
              </article>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Load a markdown file via fetch (works on http/https and most file:// with CORS off)
  async function loadMarkdown(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load ' + path);
    return await res.text();
  }

  Object.assign(window, { LegalPage, SidebarTOC, ReadingProgress, BackToTopFab, loadMarkdown });
})();
