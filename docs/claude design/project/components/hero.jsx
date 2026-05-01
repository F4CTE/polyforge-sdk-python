function Hero() {
  const [variant] = useTweak('heroVariant');
  const copy = HEADLINES[variant] || HEADLINES.terminal;
  const visual = variant === 'builder' ? <BuilderCanvas/> : <DashboardMock/>;

  return (
    <section className="hero-wrap" id="top">
      <div className="hero-glow" aria-hidden="true"/>
      <div className="hero-grid-bg" aria-hidden="true"/>
      <div className="container hero-container">
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">
              <span className="dot dot-pulse"/>
              early access · cohort 04
            </div>
            <h1 className="t-hero">{copy.h}</h1>
            <p className="hero-sub">{copy.sub}</p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="Sign Up.html">start free <Icon name="arrow-right" size={14}/></a>
              <a className="btn btn-secondary btn-lg" href="Docs.html">read the docs</a>
            </div>
            <div className="hero-microbar">
              <div className="hero-microbar-cell">
                <span className="hero-microbar-k">No card</span>
                <span className="hero-microbar-v">free forever for paper</span>
              </div>
              <div className="hero-microbar-cell">
                <span className="hero-microbar-k">Paper</span>
                <span className="hero-microbar-v">unlimited backtests</span>
              </div>
              <div className="hero-microbar-cell">
                <span className="hero-microbar-k">Builder</span>
                <span className="hero-microbar-v">Polymarket program member</span>
              </div>
            </div>
          </div>
          <div>{visual}</div>
        </div>
      </div>
    </section>
  );
}
window.Hero = Hero;

function MetricsStrip() {
  const items = [
    ['12,400+', 'Traders building'],
    ['847', 'Live strategies'],
    ['$2.3M', 'Monthly volume'],
    ['200ms', 'Median tick latency'],
  ];
  return (
    <section className="metrics">
      <div className="container metrics-inner">
        {items.map(([v, l], i) => (
          <React.Fragment key={l}>
            <div className="metric">
              <div className="metric-value tabnum">{v}</div>
              <div className="metric-label">{l}</div>
            </div>
            {i < items.length - 1 && <span className="metric-sep"/>}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
window.MetricsStrip = MetricsStrip;
