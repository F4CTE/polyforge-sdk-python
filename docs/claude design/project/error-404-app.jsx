/* eslint-disable */
/* 404 — Market not found */

(() => {
  const { useState, useEffect, useMemo } = React;

  // Pseudo-market lookalikes — the "market" the user tried to find.
  const TICKER_POOL = [
    'WILL-CLAUDE-WIN-2025',
    'BTC-ABOVE-100K-EOY',
    'NFL-CHIEFS-SBLIX',
    'FED-CUT-MAY-2026',
    'OSCAR-BEST-PICTURE',
    'GPT-6-RELEASE-Q3',
    'LON-MAYOR-2028',
    'OPENAI-IPO-2027',
  ];

  const PROBES = [
    { ts: '14:32:07.412', host: 'edge-lhr-04', code: 404, msg: 'no route matches' },
    { ts: '14:32:07.414', host: 'gamma-cache', code: 404, msg: 'condition_id not in registry' },
    { ts: '14:32:07.418', host: 'kalshi-mux',  code: 404, msg: 'ticker not found in /events' },
    { ts: '14:32:07.421', host: 'opinion-mux', code: 404, msg: 'series unavailable' },
    { ts: '14:32:07.426', host: 'orderbook',   code: '—',  msg: 'nothing to subscribe to' },
  ];

  const SHORTCUTS = [
    { kbd: ['G', 'H'], label: 'Go to home',         href: 'Landing Page.html', icon: 'layout-grid' },
    { kbd: ['G', 'D'], label: 'Open the docs',      href: 'Docs.html',         icon: 'terminal' },
    { kbd: ['G', 'S'], label: 'Strategy guide',     href: 'Guide.html',        icon: 'zap'  },
    { kbd: ['G', 'C'], label: 'Contact support',    href: 'Contact.html',      icon: 'message' },
  ];

  const POPULAR = [
    { label: 'Quickstart',          href: 'Guide-Quickstart.html' },
    { label: 'Whale tracker guide', href: 'Guide-Whales.html' },
    { label: 'API reference',       href: 'Docs-API.html' },
    { label: 'Pricing',             href: 'Pricing.html' },
    { label: 'System status',       href: 'Status.html' },
    { label: 'Changelog',           href: 'Changelog.html' },
  ];

  function useTicker() {
    // Pick a deterministic ticker per page load (so it stays stable when re-rendering)
    return useMemo(() => TICKER_POOL[Math.floor(Math.random() * TICKER_POOL.length)], []);
  }

  function App() {
    const ticker = useTicker();
    const [path, setPath] = useState('/markets/' + ticker.toLowerCase());
    const [search, setSearch] = useState('');

    // Read the actual attempted URL if present
    useEffect(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tried = params.get('path') || params.get('p');
        if (tried) setPath(tried);
      } catch {}
    }, []);

    return (
      <>
        <Nav />
        <main className="err-main">
          <div className="err-container">

            {/* Header strip — looks like a failed market lookup */}
            <div className="err-strip">
              <span className="err-strip-dot" />
              <span className="err-strip-label">PROBE</span>
              <span className="err-strip-path mono">GET {path}</span>
              <span className="err-strip-status">404</span>
              <span className="err-strip-time mono">~ 12ms</span>
            </div>

            <div className="err-grid">
              {/* LEFT — display */}
              <div className="err-display">
                <div className="err-eyebrow">
                  <span className="dot dot-pulse" style={{ background: 'var(--warning)' }} />
                  <span>Market not found</span>
                </div>

                <h1 className="err-code">
                  <span className="err-code-digit">4</span>
                  <span className="err-code-digit err-code-zero">0</span>
                  <span className="err-code-digit">4</span>
                </h1>

                <p className="err-lede">
                  We routed your request to every venue we know — Polymarket, Kalshi, our own
                  cache — and none of them have <span className="mono err-ticker">{ticker}</span>.
                  Either the page moved, the link is stale, or this market never existed.
                </p>

                {/* Search — looks like the in-app omnibox */}
                <form
                  className="err-search"
                  onSubmit={(e) => { e.preventDefault(); if (search.trim()) window.location.href = 'Docs.html'; }}
                >
                  <Icon name="search" size={14} />
                  <input
                    type="text"
                    placeholder="Search docs, guides, or markets…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search"
                  />
                  <kbd className="err-kbd">⏎</kbd>
                </form>

                <div className="err-cta-row">
                  <a href="Landing Page.html" className="btn btn-primary btn-lg">
                    Back to home
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-lg"
                    onClick={() => { try { history.back(); } catch {} }}
                  >
                    <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrow-right" size={13} /></span> Go back
                  </button>
                </div>

                <div className="err-shortcuts">
                  {SHORTCUTS.map((s) => (
                    <a key={s.label} href={s.href} className="err-shortcut">
                      <span className="err-shortcut-icon"><Icon name={s.icon} size={14} /></span>
                      <span className="err-shortcut-label">{s.label}</span>
                      <span className="err-shortcut-kbd">
                        {s.kbd.map((k, i) => <kbd key={i}>{k}</kbd>)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* RIGHT — log panel */}
              <aside className="err-panel">
                <div className="err-panel-head">
                  <div className="err-panel-title">router.log</div>
                  <div className="err-panel-meta mono">
                    <span>req-7f3a91c8</span>
                    <span className="sep">·</span>
                    <span>14:32:07 UTC</span>
                  </div>
                </div>

                <div className="err-panel-body">
                  {PROBES.map((p, i) => (
                    <div key={i} className="err-log-row">
                      <span className="err-log-ts mono">{p.ts}</span>
                      <span className="err-log-host">{p.host}</span>
                      <span className={`err-log-code ${p.code === 404 ? 'is-err' : ''}`}>{p.code}</span>
                      <span className="err-log-msg">{p.msg}</span>
                    </div>
                  ))}

                  <div className="err-log-row err-log-final">
                    <span className="err-log-ts mono">14:32:07.430</span>
                    <span className="err-log-host">router</span>
                    <span className="err-log-code is-err">FAIL</span>
                    <span className="err-log-msg">all upstreams returned 404 — surfacing /404</span>
                  </div>
                </div>

                <div className="err-panel-foot">
                  <Icon name="info" size={12} />
                  <span>If a link from our docs sent you here, please <a href="Contact.html">tell us</a>.</span>
                </div>
              </aside>
            </div>

            {/* Popular destinations */}
            <div className="err-popular">
              <div className="err-popular-label">Popular destinations</div>
              <div className="err-popular-list">
                {POPULAR.map((p) => (
                  <a key={p.label} href={p.href} className="err-popular-item">
                    <span>{p.label}</span>
                    <Icon name="arrow-up-right" size={11} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
