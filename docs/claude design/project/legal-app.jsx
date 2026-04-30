// Legal page boot — reads window.__LEGAL_PAGE__ and renders <LegalPage>.
(function () {
  const page = window.__LEGAL_PAGE__;
  if (!page) { console.error('[legal] __LEGAL_PAGE__ not set'); return; }

  function Boot() {
    const [source, setSource] = React.useState(null);
    const [err, setErr] = React.useState(null);

    React.useEffect(() => {
      fetch(page.source)
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + page.source); return r.text(); })
        .then(setSource)
        .catch((e) => setErr(String(e.message || e)));
    }, []);

    if (err) {
      return (
        <>
          <Nav />
          <main className="legal-main">
            <div className="container legal-container" style={{ paddingTop: 96 }}>
              <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
                <h1 style={{ fontSize: 28, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>
                  Couldn't load document
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
                  {err}
                </p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 28 }}>
                  These pages fetch the source markdown at runtime. If you're opening via
                  <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, margin: '0 4px' }}>file://</code>,
                  serve the project over HTTP instead.
                </p>
                <a href="Landing Page.html" className="btn btn-primary btn-sm">Back to home</a>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }

    if (!source) {
      return (
        <>
          <Nav />
          <main className="legal-main">
            <div className="container legal-container" style={{ paddingTop: 120, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Loading…
            </div>
          </main>
        </>
      );
    }

    return (
      <LegalPage
        docKey={page.slug}
        kind={page.kind}
        title={page.title}
        effective={page.effective}
        lastUpdated={page.lastUpdated}
        callout={page.callout}
        source={source}
      >
        {page.slug === 'cookies' ? <CookiePreferences /> : null}
      </LegalPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<Boot />);
})();
