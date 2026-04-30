/* Guide landing — welcoming hero, topic cards, popular questions */

function GuideLanding() {
  useEffect(() => { document.body.classList.add('docs-body'); }, []);

  const cards = [
    { icon: 'rocket', title: 'Quickstart', desc: 'Sign up, connect Polymarket, and place your first automated trade in five minutes — no code required.', href: 'Guide-Quickstart.html',
      links: ['Create an account', 'Link your wallet', 'Pick a template'] },
    { icon: 'layers', title: 'Strategy builder', desc: 'Drag blocks together to create trading rules. No coding, no spreadsheets — just click and connect.', href: 'Guide-Strategy-Builder.html',
      links: ['Blocks 101', 'Wiring a strategy', 'Save & reuse'] },
    { icon: 'users', title: 'Whale dashboard', desc: 'See what the best prediction-market traders are buying and selling. Follow one, copy many.', href: 'Guide-Whales.html',
      links: ['Finding whales', 'Copy trading', 'Filters & cohorts'] },
    { icon: 'clock', title: 'Backtesting', desc: 'Replay your strategy against real market history. See how it would have done — before risking a dollar.', href: 'Guide-Backtest.html',
      links: ['Running a backtest', 'Reading the report', 'Common pitfalls'] },
    { icon: 'shield', title: 'Paper → Live', desc: 'How to move from simulated trading to real money safely, with a checklist you can actually follow.', href: 'Guide-Going-Live.html',
      links: ['The 7-day rule', 'Risk limits', 'Going live checklist'] },
    { icon: 'book', title: 'Glossary', desc: 'Every term in Polyforge explained in plain English. Bookmark it — you\'ll come back.', href: 'Guide-Glossary.html',
      links: ['Block', 'Kelly', 'Slippage'] },
  ];

  const popular = [
    { label: 'How do I fund my account?', section: 'Account', href: 'Guide-Account-Billing.html#funding', count: '01' },
    { label: 'Can I start without any coding?', section: 'Quickstart', href: 'Guide-Quickstart.html#no-code', count: '02' },
    { label: 'How do I copy a whale?', section: 'Whales', href: 'Guide-Whales.html#copy', count: '03' },
    { label: 'What\'s the difference between paper and live?', section: 'Going live', href: 'Guide-Going-Live.html#modes', count: '04' },
    { label: 'How do I set a daily loss limit?', section: 'Going live', href: 'Guide-Going-Live.html#limits', count: '05' },
    { label: 'Where do I get an API key?', section: 'Security', href: 'Guide-Security.html#api-keys', count: '06' },
  ];

  return (
    <>
      <DocsTopbar section="guide" variant="guide" />
      <main>
        <div className="docs-hero">
          <span className="eyebrow" style={{color: 'var(--text-tertiary)', justifyContent: 'center', display: 'inline-flex'}}>
            <span className="dot" style={{background: 'var(--accent-default)'}}></span>
            POLYFORGE USER GUIDE
          </span>
          <h1>Everything you need to trade smarter — without writing code.</h1>
          <p>This is the no-code side of Polyforge. If you came here looking for the SDK, <a href="Docs.html" style={{color:'var(--accent-text)'}}>the developer docs are over here</a>. Otherwise: welcome. Let's get you trading.</p>
          <DocsSearch hero placeholder="Search the guide — 'how do I…'" index={GUIDE_SEARCH} />
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
          <div className="docs-popular-title">Most-asked questions</div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<GuideLanding />);
