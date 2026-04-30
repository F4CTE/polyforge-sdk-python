/* Docs landing page — hero + search + card grid + popular */

function DocsLanding() {
  useEffect(() => { document.body.classList.add('docs-body'); }, []);

  const cards = [
    { icon: 'rocket', title: 'Quickstart', desc: 'Install the SDK, connect a venue, and run your first strategy in under five minutes.', href: 'Docs-Quickstart.html',
      links: ['Install the SDK', 'Connect a venue', 'Run a paper trade'] },
    { icon: 'code', title: 'SDK Reference', desc: 'Every class, method, and type — in TypeScript, Python, and Rust. Synced across the page.', href: 'Docs-SDK.html',
      links: ['Client', 'Strategy', 'whales.subscribe'] },
    { icon: 'terminal', title: 'REST API', desc: 'Everything the SDK does, over HTTPS. For webhooks, custom integrations, and non-supported languages.', href: 'Docs-API.html',
      links: ['POST /strategies', 'POST /orders', 'GET /markets'] },
    { icon: 'cpu', title: 'MCP server', desc: 'Plug Polyforge into Claude, Cursor, or any MCP-capable client. Natural-language strategy building.', href: 'Docs-MCP.html',
      links: ['Claude Desktop', 'Cursor', 'Available tools'] },
    { icon: 'layers', title: 'Guides', desc: 'Narrative walkthroughs for backtesting, going live, alerts, and copy-trading whales.', href: 'Docs-Quickstart.html#backtesting',
      links: ['Backtesting', 'Going live', 'Alerts & webhooks'] },
    { icon: 'file-text', title: 'Concepts', desc: 'The mental model behind Polyforge — strategies, blocks, venues, and the order lifecycle.', href: 'Docs-Quickstart.html#concepts',
      links: ['Strategy', 'Block', 'Venue'] },
  ];

  const popular = [
    { label: 'Install the SDK', section: 'Quickstart', href: 'Docs-Quickstart.html#install', count: '01' },
    { label: 'Connect Kalshi + Polymarket', section: 'Guides',     href: 'Docs-Quickstart.html#venues',  count: '02' },
    { label: 'Your first EMA-cross strategy', section: 'Tutorial', href: 'Docs-Quickstart.html#first-strategy', count: '03' },
    { label: 'Going live without losing your shirt', section: 'Guides', href: 'Docs-Quickstart.html#live', count: '04' },
    { label: 'Copy-trade a whale wallet', section: 'SDK',          href: 'Docs-SDK.html#whales', count: '05' },
    { label: 'Webhook alert to Discord', section: 'API',           href: 'Docs-API.html#webhooks', count: '06' },
  ];

  return (
    <>
      <DocsTopbar section="docs" variant="docs" />
      <main>
        <div className="docs-hero">
          <span className="eyebrow" style={{color: 'var(--text-tertiary)', justifyContent: 'center', display: 'inline-flex'}}>
            <span className="dot" style={{background: 'var(--accent-default)'}}></span>
            POLYFORGE DOCS · v1.4
          </span>
          <h1>Build, test, and ship prediction-market strategies.</h1>
          <p>Everything you need to go from <code style={{fontFamily: "'Geist Mono', monospace", fontSize: 14, background: 'var(--bg-surface)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)'}}>npm install</code> to live capital — SDK, REST, CLI, and MCP references, plus narrative guides for every step.</p>
          <DocsSearch hero placeholder="Search docs, endpoints, SDK methods…" />
        </div>

        <div className="docs-card-grid">
          {cards.map((c, i) => (
            <a key={i} href={c.href} className="docs-card">
              <div className="docs-card-icon"><Icon name={c.icon} size={18} /></div>
              <h3 className="docs-card-title">{c.title}</h3>
              <p className="docs-card-desc">{c.desc}</p>
              <div className="docs-card-links">
                {c.links.map((l, j) => (
                  <span key={j}><Icon name="chevron-right" size={10} />{l}</span>
                ))}
              </div>
            </a>
          ))}
        </div>

        <div className="docs-popular">
          <div className="docs-popular-title">Popular this week</div>
          <div className="docs-popular-list">
            {popular.map((p, i) => (
              <a key={i} href={p.href} className="docs-popular-item">
                <span className="count">{p.count}</span>
                <span className="label">{p.label}</span>
                <span className="section">{p.section}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DocsLanding />);
