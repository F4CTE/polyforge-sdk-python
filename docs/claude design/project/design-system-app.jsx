/* Design System app — sidebar + main scroll + theme/accent toggle. */

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

function DesignSystemApp() {
  const [theme, setTheme] = useStateApp(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [accent, setAccent] = useStateApp(() => document.documentElement.getAttribute('data-accent') || 'blue');
  const [active, setActive] = useStateApp('overview');
  const [filter, setFilter] = useStateApp('');
  const [toast, setToast] = useStateApp('');
  const toastTimerRef = useRefApp(null);

  useEffectApp(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffectApp(() => {
    if (accent === 'blue') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  // Scroll-spy for sidebar
  useEffectApp(() => {
    const ids = DS.DS_NAV.flatMap(g => g.items.map(i => i.id));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] });
    ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1400);
  };

  const filteredNav = DS.DS_NAV.map(g => ({
    ...g,
    items: g.items.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase())),
  })).filter(g => g.items.length > 0);

  const S = window.DSSections;

  return (
    <div className="ds-root">
      {/* ---- Sidebar ---- */}
      <aside className="ds-side">
        <div className="ds-side-brand">
          <div className="ds-side-brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          <path d="M12 11.7 L4.5 8 M12 11.7 L19.5 8 M12 11.7 V22" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 5.5v3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              <path d="M6.15 15.25l2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              <path d="M17.85 15.25l-2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="ds-side-brand-text">
            <div className="ds-side-brand-title">Polyforge</div>
            <div className="ds-side-brand-sub">design-system / v1.0</div>
          </div>
        </div>
        <div className="ds-side-search">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter sections…" />
        </div>
        <nav className="ds-toc">
          {filteredNav.map((group) => (
            <div className="ds-toc-group" key={group.label}>
              <div className="ds-toc-label">{group.label}</div>
              {group.items.map((it) => (
                <a key={it.id} href={`#${it.id}`} className={`ds-toc-link${active === it.id ? ' is-active' : ''}`}>
                  <span className="num">{it.num}</span>
                  <span>{it.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ---- Main ---- */}
      <main className="ds-main">
        <div className="ds-top">
          <div className="ds-top-crumbs">
            <span>Polyforge</span>
            <span className="sep">/</span>
            <span className="here">Design System</span>
          </div>
          <div className="ds-top-actions">
            <div className="ds-row" style={{ gap: 6 }}>
              {['blue','violet','mint','amber'].map((a) => (
                <button key={a} onClick={() => setAccent(a)} title={`Accent: ${a}`}
                  style={{
                    width: 22, height: 22, borderRadius: 99, padding: 0,
                    border: accent === a ? '2px solid var(--text-primary)' : '1px solid var(--border-default)',
                    background: a === 'blue' ? '#4F6EF7' : a === 'violet' ? '#8B5CF6' : a === 'mint' ? '#2DD4BF' : '#F59E0B',
                    cursor: 'pointer',
                  }} />
              ))}
            </div>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☾ Dark' : '☀ Light'}
            </button>
          </div>
        </div>

        <div className="ds-content">
          {/* Hero */}
          <header className="ds-hero">
            <span className="ds-hero-eyebrow">DESIGN SYSTEM · v1.0</span>
            <h1>The system <em>behind</em> Polyforge — tokens, components, and the voice that ties them together.</h1>
            <p>Polyforge ships across five surfaces — Marketing, Docs, User Guide, Auth, and the Admin control room — that share one set of tokens and two complementary component layers. This document is the canonical reference.</p>
            <div className="ds-hero-meta">
              <span>21 sections</span><span className="sep">·</span>
              <span>~70 tokens</span><span className="sep">·</span>
              <span>{DS.DS_ADMIN_ICONS.length + DS.DS_MARKETING_ICONS.length} icons</span><span className="sep">·</span>
              <span>2 surface layers</span>
            </div>
          </header>

          {/* Sections */}
          <S.OverviewSection />
          <S.BrandSection />
          <S.ColorSection theme={theme} copy={showToast} />
          <S.TypographySection />
          <S.SpacingSection />
          <S.RadiiSection />
          <S.ShadowsSection />
          <S.MotionSection />
          <S.IconSection copy={showToast} />
          <S.DataVizSection />
          <S.ButtonsSection />
          <S.InputsSection />
          <S.BadgesSection />
          <S.PillsSection />
          <S.CardsSection />
          <S.TablesSection />
          <S.NavigationSection />
          <S.OverlaysSection />
          <S.FeedbackSection />
          <S.VoiceSection />
          <S.ImplementationSection />
        </div>
      </main>

      {/* Copy toast */}
      <div className={`ds-copytoast${toast ? ' is-shown' : ''}`}>
        <span className="ok">✓</span>
        <span>Copied <span className="ds-mono">{toast}</span></span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DesignSystemApp />);
