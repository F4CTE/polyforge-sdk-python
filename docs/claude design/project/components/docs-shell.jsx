/* Shared Docs shell: topbar with search, sidebar, main layout, code blocks, callouts, TOC */

const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

// ---------- User Guide sidebar (non-dev) ----------
const GUIDE_NAV = [
  { title: 'Get started', links: [
    ['Welcome', 'Guide.html', 'welcome'],
    ['5-minute quickstart', 'Guide-Quickstart.html', 'quickstart'],
    ['Glossary', 'Guide-Glossary.html', 'glossary'],
  ]},
  { title: 'Using Polyforge', links: [
    ['Strategy builder', 'Guide-Strategy-Builder.html', 'builder'],
    ['Whale dashboard', 'Guide-Whales.html', 'whales'],
    ['Backtesting', 'Guide-Backtest.html', 'backtest'],
    ['Paper → live', 'Guide-Going-Live.html', 'live'],
  ]},
  { title: 'Your account', links: [
    ['Account & billing', 'Guide-Account-Billing.html', 'billing'],
    ['Security & 2FA', 'Guide-Security.html', 'security'],
  ]},
  { title: 'Help', links: [
    ['FAQ', 'Guide-FAQ.html', 'faq'],
    ['Contact support', 'Contact.html', 'support'],
    ['Status', 'Status.html', 'status'],
  ]},
];

const GUIDE_SEARCH = [
  { title: 'Welcome', section: 'Get started', href: 'Guide.html', kw: 'guide intro start' },
  { title: 'Quickstart', section: 'Get started', href: 'Guide-Quickstart.html', kw: 'quickstart first' },
  { title: 'Glossary', section: 'Get started', href: 'Guide-Glossary.html', kw: 'glossary terms' },
  { title: 'Strategy builder', section: 'Using Polyforge', href: 'Guide-Strategy-Builder.html', kw: 'builder drag drop blocks no-code' },
  { title: 'Whale dashboard', section: 'Using Polyforge', href: 'Guide-Whales.html', kw: 'whales wallet copy trade' },
  { title: 'Backtesting', section: 'Using Polyforge', href: 'Guide-Backtest.html', kw: 'backtest history replay' },
  { title: 'Going live', section: 'Using Polyforge', href: 'Guide-Going-Live.html', kw: 'paper live real money' },
  { title: 'Account & billing', section: 'Your account', href: 'Guide-Account-Billing.html', kw: 'billing plan invoice seat' },
  { title: 'Security & 2FA', section: 'Your account', href: 'Guide-Security.html', kw: 'security 2fa password device' },
  { title: 'FAQ', section: 'Help', href: 'Guide-FAQ.html', kw: 'faq question help' },
];

// ---------- Sidebar nav structure (kept in one place) ----------
const DOCS_NAV = [
  { title: 'Getting started', links: [
    ['Introduction', 'Docs.html', 'intro'],
    ['Quickstart', 'Docs-Quickstart.html', 'quickstart'],
    ['Core concepts', 'Docs-Quickstart.html#concepts', 'concepts'],
    ['First strategy', 'Docs-Quickstart.html#first-strategy', 'first-strategy'],
  ]},
  { title: 'Guides', links: [
    ['Backtesting', 'Docs-Quickstart.html#backtesting', 'backtesting'],
    ['Paper trading', 'Docs-Quickstart.html#paper', 'paper'],
    ['Going live', 'Docs-Quickstart.html#live', 'live'],
    ['Alerts & webhooks', 'Docs-Quickstart.html#alerts', 'alerts'],
  ]},
  { title: 'Reference', links: [
    ['SDK (TS / Py / Rust)', 'Docs-SDK.html', 'sdk'],
    ['REST API', 'Docs-API.html', 'api'],
    ['MCP server', 'Docs-MCP.html', 'mcp'],
    ['CLI', 'Docs-SDK.html#cli', 'cli'],
  ]},
  { title: 'Resources', links: [
    ['Changelog', 'Changelog.html', 'changelog'],
    ['Status', 'Status.html', 'status'],
    ['Support', 'Contact.html', 'support'],
  ]},
];

// Flattened pages for search
const SEARCH_INDEX = [
  { title: 'Introduction', section: 'Getting started', href: 'Docs.html', kw: 'polyforge overview what' },
  { title: 'Quickstart', section: 'Getting started', href: 'Docs-Quickstart.html', kw: 'install setup begin hello' },
  { title: 'Core concepts', section: 'Getting started', href: 'Docs-Quickstart.html#concepts', kw: 'strategy block venue signal order' },
  { title: 'Your first strategy', section: 'Getting started', href: 'Docs-Quickstart.html#first-strategy', kw: 'tutorial example ema cross' },
  { title: 'Backtesting', section: 'Guides', href: 'Docs-Quickstart.html#backtesting', kw: 'backtest historical simulation' },
  { title: 'Paper trading', section: 'Guides', href: 'Docs-Quickstart.html#paper', kw: 'paper simulate live-ish' },
  { title: 'Going live', section: 'Guides', href: 'Docs-Quickstart.html#live', kw: 'live production deploy real money' },
  { title: 'Alerts & webhooks', section: 'Guides', href: 'Docs-Quickstart.html#alerts', kw: 'webhook discord telegram notification' },
  { title: 'SDK Reference', section: 'Reference', href: 'Docs-SDK.html', kw: 'sdk typescript python rust install' },
  { title: 'Client.connect', section: 'SDK', href: 'Docs-SDK.html#connect', kw: 'connect client authenticate' },
  { title: 'Strategy.run', section: 'SDK', href: 'Docs-SDK.html#strategy-run', kw: 'run strategy live' },
  { title: 'Strategy.backtest', section: 'SDK', href: 'Docs-SDK.html#backtest', kw: 'backtest historical' },
  { title: 'whales.subscribe', section: 'SDK', href: 'Docs-SDK.html#whales', kw: 'whale wallet follow feed' },
  { title: 'REST API', section: 'Reference', href: 'Docs-API.html', kw: 'rest api http endpoint' },
  { title: 'POST /strategies', section: 'API', href: 'Docs-API.html#create-strategy', kw: 'create strategy post' },
  { title: 'GET /strategies/{id}', section: 'API', href: 'Docs-API.html#get-strategy', kw: 'get strategy fetch' },
  { title: 'POST /orders', section: 'API', href: 'Docs-API.html#place-order', kw: 'place order post execute' },
  { title: 'GET /markets', section: 'API', href: 'Docs-API.html#markets', kw: 'markets list venue kalshi polymarket' },
  { title: 'MCP server', section: 'Reference', href: 'Docs-MCP.html', kw: 'mcp claude cursor llm model context protocol' },
  { title: 'MCP install', section: 'MCP', href: 'Docs-MCP.html#install', kw: 'install setup mcp claude cursor' },
  { title: 'MCP tools', section: 'MCP', href: 'Docs-MCP.html#tools', kw: 'tools available list' },
  { title: 'CLI reference', section: 'Reference', href: 'Docs-SDK.html#cli', kw: 'cli command-line polyforge' },
];

// Landing-page introduction target — sidebar matches it to 'intro'
const PAGE_ALIASES = {
  'Docs.html': 'intro',
  'Docs-Quickstart.html': 'quickstart',
  'Docs-SDK.html': 'sdk',
  'Docs-API.html': 'api',
  'Docs-MCP.html': 'mcp',
};

// ---------- Search ----------
function DocsSearch({ hero = false, placeholder, index }) {
  const searchIndex = index || SEARCH_INDEX;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Cmd+K / Ctrl+K focus
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return searchIndex.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.section.toLowerCase().includes(needle) ||
      (r.kw && r.kw.toLowerCase().includes(needle))
    ).slice(0, 8);
  }, [q, searchIndex]);

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIdx]) { window.location.href = results[activeIdx].href; }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div className={`docs-search${hero ? ' docs-hero-search' : ''}`} ref={wrapRef}>
      <Icon name="search" size={14} className="docs-search-icon" />
      <input
        ref={inputRef}
        className="docs-search-input"
        type="text"
        placeholder={placeholder || 'Search the docs…'}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKey}
      />
      <span className="docs-search-kbd">⌘K</span>
      {open && q && (
        <div className="docs-search-results">
          {results.length === 0 ? (
            <div className="docs-search-empty">No results for "{q}"</div>
          ) : results.map((r, i) => (
            <a key={i} href={r.href} className={`docs-search-result${i === activeIdx ? ' active' : ''}`} onMouseEnter={() => setActiveIdx(i)}>
              <span className="docs-search-result-title">{r.title}</span>
              <span className="docs-search-result-meta">
                <Icon name="chevron-right" size={10} />
                {r.section}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Topbar ----------
function DocsTopbar({ section, variant = 'docs' }) {
  const isGuide = variant === 'guide';
  return (
    <header className="docs-topbar">
      <div className="docs-topbar-left">
        <a href="Landing Page.html" className="docs-topbar-brand" style={{ gap: 8 }}>
          <Logo size={22} />
          <span>polyforge</span>
        </a>
        <span className="docs-slash">/</span>
        <div className="docs-variant-tabs" role="tablist" aria-label="Documentation section">
          <a href="Guide.html" role="tab" aria-selected={isGuide} className={`docs-variant-tab${isGuide ? ' active' : ''}`}>
            User guide
          </a>
          <a href="Docs.html" role="tab" aria-selected={!isGuide} className={`docs-variant-tab${!isGuide ? ' active' : ''}`}>
            Developers
          </a>
        </div>
      </div>
      <DocsSearch
        index={isGuide ? GUIDE_SEARCH : SEARCH_INDEX}
        placeholder={isGuide ? 'Search the guide…' : 'Search the docs…'}
      />
      <div className="docs-topbar-right">
        <span className="docs-version">v1.4</span>
        <a href="Pricing.html" className="docs-topbar-link">Pricing</a>
        <a href="Changelog.html" className="docs-topbar-link">Changelog</a>
        <a href="Login.html" className="btn btn-secondary" style={{height: 32, padding: '0 14px', fontSize: 13}}>sign in</a>
      </div>
    </header>
  );
}

// ---------- Sidebar ----------
function DocsSidebar({ activeId, variant = 'docs' }) {
  const nav = variant === 'guide' ? GUIDE_NAV : DOCS_NAV;
  return (
    <aside className="docs-sidebar">
      {nav.map((section, si) => (
        <div key={si} className="docs-nav-section">
          <h4 className="docs-nav-section-title">{section.title}</h4>
          <ul className="docs-nav-list">
            {section.links.map(([label, href, id], li) => (
              <li key={li}>
                <a href={href} className={id === activeId ? 'active' : ''}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

// ---------- TOC (right column) — hydrated from h2/h3 in content ----------
function DocsTOC({ items }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  useEffect(() => {
    const headings = items.map(i => document.getElementById(i.id)).filter(Boolean);
    if (!headings.length) return;
    const onScroll = () => {
      let current = items[0]?.id;
      for (const h of headings) {
        const r = h.getBoundingClientRect();
        if (r.top < 120) current = h.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);
  if (!items?.length) return <aside className="docs-toc" />;
  return (
    <aside className="docs-toc">
      <div className="docs-toc-title">On this page</div>
      <ul className="docs-toc-list">
        {items.map(it => (
          <li key={it.id} className={it.level === 3 ? 'nested' : ''}>
            <a href={`#${it.id}`} className={it.id === activeId ? 'active' : ''}>{it.text}</a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ---------- Language switcher context ----------
const LangCtx = createContext({ lang: 'ts', setLang: () => {} });
const LANGUAGES = [
  { id: 'ts', label: 'TypeScript' },
  { id: 'py', label: 'Python' },
  { id: 'rs', label: 'Rust' },
  { id: 'sh', label: 'curl' },
];

function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('pf_docs_lang') || 'ts');
  useEffect(() => { localStorage.setItem('pf_docs_lang', lang); }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

// ---------- Code block ----------
/*
  Use: <CodeBlock snippets={{ ts: '...', py: '...' }} />
  or <CodeBlock code="..." lang="bash" /> for single-lang
*/
function CodeBlock({ snippets, code, lang: fixedLang, title }) {
  const { lang, setLang } = useContext(LangCtx);
  const [copied, setCopied] = useState(false);
  const tabs = snippets
    ? LANGUAGES.filter(l => snippets[l.id] != null)
    : null;

  const active = snippets
    ? (snippets[lang] != null ? lang : tabs[0].id)
    : null;

  const displayed = snippets ? snippets[active] : code;

  const copy = async () => {
    // Copy plain text (strip spans)
    const tmp = document.createElement('div');
    tmp.innerHTML = displayed;
    await navigator.clipboard.writeText(tmp.textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-block">
      <div className="code-block-head">
        <div className="code-block-tabs">
          {tabs ? tabs.map(t => (
            <button key={t.id} className={`code-block-tab${t.id === active ? ' active' : ''}`} onClick={() => setLang(t.id)}>{t.label}</button>
          )) : (
            <span className="code-block-tab active">{title || fixedLang || 'code'}</span>
          )}
        </div>
        <button className={`code-block-copy${copied ? ' copied' : ''}`} onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="code-block-body" dangerouslySetInnerHTML={{ __html: displayed }} />
    </div>
  );
}

// ---------- Callout ----------
function Callout({ type = 'info', children, title }) {
  const icon = type === 'warn' ? 'alert' : type === 'tip' ? 'check' : 'info';
  return (
    <div className={`callout ${type}`}>
      <Icon name={icon} size={14} />
      <div>
        {title && <strong style={{display: 'block', marginBottom: 4}}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

// ---------- Endpoint row ----------
function Endpoint({ method, path }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${method} https://api.polyforge.app/v1${path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  // Highlight :params in path
  const pathHtml = path.split(/(\{[^}]+\})/).map((p, i) =>
    p.startsWith('{') ? <span key={i} className="param">{p}</span> : <span key={i}>{p}</span>
  );
  return (
    <div className="endpoint">
      <span className={`endpoint-method ${method.toLowerCase()}`}>{method}</span>
      <span className="endpoint-path">{pathHtml}</span>
      <button className={`endpoint-copy${copied ? ' copied' : ''}`} onClick={copy}>
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  );
}

// ---------- Params table ----------
function ParamsTable({ rows }) {
  return (
    <table className="params-table">
      <thead>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="col-name">{r.name}{r.required && <span className="required">required</span>}</td>
            <td className="col-type">{r.type}</td>
            <td>{r.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Page footer (prev/next + feedback) ----------
function DocsPageFooter({ prev, next }) {
  const [vote, setVote] = useState(null); // 'up' | 'down' | null
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="docs-page-footer">
      {(prev || next) && (
        <div className="docs-prev-next">
          {prev ? (
            <a href={prev.href}>
              <span className="dir">← Previous</span>
              <span className="title">{prev.title}</span>
            </a>
          ) : <span />}
          {next ? (
            <a href={next.href} className="next">
              <span className="dir">Next →</span>
              <span className="title">{next.title}</span>
            </a>
          ) : <span />}
        </div>
      )}
      <div className="docs-feedback">
        <div className="docs-feedback-prompt">Was this page helpful?</div>
        {submitted ? (
          <div className="docs-feedback-thanks">
            <Icon name="check" size={14} />
            Thanks for the feedback.
          </div>
        ) : (
          <div className="docs-feedback-buttons">
            <button className={vote === 'up' ? 'selected' : ''} onClick={() => { setVote('up'); setTimeout(() => setSubmitted(true), 300); }}>
              <Icon name="chevron-up" size={12} /> Yes
            </button>
            <button className={vote === 'down' ? 'selected' : ''} onClick={() => { setVote('down'); setTimeout(() => setSubmitted(true), 300); }}>
              <Icon name="chevron-down" size={12} /> No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Docs layout wrapper ----------
function DocsLayout({ activeId, section, variant = 'docs', children, toc, breadcrumbs, prev, next }) {
  useEffect(() => { document.body.classList.add('docs-body'); }, []);
  return (
    <LangProvider>
      <DocsTopbar section={section} variant={variant} />
      <div className="docs-layout">
        <DocsSidebar activeId={activeId} variant={variant} />
        <main className="docs-main">
          {breadcrumbs && (
            <nav className="docs-breadcrumbs">
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="sep">/</span>}
                  {b.href ? <a href={b.href}>{b.label}</a> : <span>{b.label}</span>}
                </React.Fragment>
              ))}
            </nav>
          )}
          {children}
          <DocsPageFooter prev={prev} next={next} />
        </main>
        <DocsTOC items={toc || []} />
      </div>
    </LangProvider>
  );
}

// Expose globally for per-page apps
Object.assign(window, {
  DocsLayout, DocsTopbar, DocsSidebar, DocsTOC, DocsSearch,
  LangProvider, LangCtx, CodeBlock, Callout, Endpoint, ParamsTable,
  DOCS_NAV, SEARCH_INDEX, LANGUAGES, GUIDE_NAV, GUIDE_SEARCH,
});
