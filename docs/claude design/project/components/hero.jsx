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
              now in early access · v6.32
            </div>
            <h1 className="t-hero">{copy.h}</h1>
            <p className="hero-sub">{copy.sub}</p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#">start free <Icon name="arrow-right" size={14}/></a>
              <a className="btn btn-secondary btn-lg" href="#">read the docs</a>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 20 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No credit card · Paper trade unlimited · Polymarket builder program</span>
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
