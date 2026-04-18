// App entry — apply tweaks on mount, then render
(function applyInitial() {
  const t = window.__TWEAKS__;
  document.documentElement.setAttribute('data-theme', t.theme || 'dark');
  if (t.accent && t.accent !== 'electric-blue') document.documentElement.setAttribute('data-accent', t.accent);
})();

function App() {
  return (
    <>
      <Nav/>
      <main>
        <Hero/>
        <MetricsStrip/>
        <TrustStrip/>
        <Tape/>
        <BuilderSection/>
        <WhaleSection/>
        <BacktestSection/>
        <SmartExecutionSection/>
        <Registry/>
        <DeveloperSection/>
        <FeatureMatrix/>
        <Testimonials/>
        <CTA/>
      </main>
      <Footer/>
      <Tweaks/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
