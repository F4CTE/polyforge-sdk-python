// Interactive cookie preference widget for the Cookies page.
// Categories: Strictly Necessary (always on), Analytics, Marketing.
// Polyforge currently sets no analytics/marketing — this is forward-looking UX.

(function () {
  const { useState, useEffect } = React;

  const CATEGORIES = [
    {
      key: 'necessary',
      title: 'Strictly necessary',
      desc: 'Authentication session, CSRF protection, load-balancer routing. Required for the app to function — cannot be disabled.',
      required: true,
      cookies: [
        { name: 'pf_session',       purpose: 'Authenticated session',       retention: '30 days' },
        { name: 'pf_csrf',          purpose: 'CSRF protection',              retention: 'Session' },
        { name: 'pf_lb',            purpose: 'Load-balancer routing',        retention: 'Session' },
      ],
    },
    {
      key: 'analytics',
      title: 'Analytics',
      desc: 'Product usage metrics so we can improve the platform. Aggregated and anonymised. First-party only.',
      required: false,
      cookies: [
        { name: '— none currently set —', purpose: 'Reserved for future self-hosted Plausible-style analytics', retention: '—' },
      ],
    },
    {
      key: 'marketing',
      title: 'Marketing',
      desc: 'Attribution for ad campaigns and newsletter tracking. Off by default. Polyforge sets none today.',
      required: false,
      cookies: [
        { name: '— none currently set —', purpose: 'Reserved for future referral & attribution cookies', retention: '—' },
      ],
    },
  ];

  const STORAGE_KEY = 'pf_cookie_prefs_v1';
  const DEFAULT = { necessary: true, analytics: false, marketing: false, savedAt: null };

  function CookiePreferences() {
    const [prefs, setPrefs] = useState(DEFAULT);
    const [expanded, setExpanded] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
      } catch (e) {}
    }, []);

    const set = (key, val) => setPrefs((p) => ({ ...p, [key]: val }));

    const save = (next) => {
      const final = { ...next, savedAt: new Date().toISOString() };
      setPrefs(final);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(final)); } catch (e) {}
      setToast('Preferences saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setToast(null), 2600);
    };

    const acceptAll = () => save({ necessary: true, analytics: true, marketing: true });
    const rejectAll = () => save({ necessary: true, analytics: false, marketing: false });
    const saveSelection = () => save(prefs);

    const savedAgo = prefs.savedAt ? new Date(prefs.savedAt).toLocaleString() : null;

    return (
      <section className="cookie-widget" aria-labelledby="cookie-widget-title">
        <div className="cookie-widget-head">
          <div className="cookie-widget-kicker mono">
            <span className="dot dot-pulse" /> live preference center
          </div>
          <h2 id="cookie-widget-title">Your cookie preferences</h2>
          <p>
            Polyforge sets only strictly-necessary cookies today. This panel lets
            you review every cookie we could set, toggle optional categories, and
            save a preference that persists in your browser. Changes apply instantly
            on this site.
          </p>
        </div>

        <div className="cookie-widget-rows">
          {CATEGORIES.map((c) => {
            const isOn = prefs[c.key];
            const isOpen = expanded === c.key;
            return (
              <div key={c.key} className={'cookie-cat' + (isOn ? ' on' : '')}>
                <div className="cookie-cat-row">
                  <div className="cookie-cat-main">
                    <div className="cookie-cat-title-row">
                      <span className="cookie-cat-title">{c.title}</span>
                      {c.required && <span className="chip" style={{ height: 20, fontSize: 10 }}>required</span>}
                      <span className="cookie-cat-count mono">
                        {c.cookies.filter((k) => !k.name.includes('none')).length} cookie{c.cookies.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="cookie-cat-desc">{c.desc}</p>
                    <button
                      className="cookie-cat-expand"
                      onClick={() => setExpanded(isOpen ? null : c.key)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide details' : 'Show cookies in this category'}
                      <span className={'cookie-caret' + (isOpen ? ' open' : '')}>↓</span>
                    </button>
                  </div>
                  <label className={'cookie-toggle' + (c.required ? ' disabled' : '')}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      disabled={c.required}
                      onChange={(e) => !c.required && set(c.key, e.target.checked)}
                    />
                    <span className="cookie-toggle-track">
                      <span className="cookie-toggle-thumb" />
                    </span>
                    <span className="cookie-toggle-state mono">{isOn ? 'ON' : 'OFF'}</span>
                  </label>
                </div>
                {isOpen && (
                  <div className="cookie-cat-detail">
                    <table className="cookie-table">
                      <thead>
                        <tr><th>Cookie</th><th>Purpose</th><th>Retention</th></tr>
                      </thead>
                      <tbody>
                        {c.cookies.map((k, i) => (
                          <tr key={i}>
                            <td className="mono">{k.name}</td>
                            <td>{k.purpose}</td>
                            <td className="mono tabnum">{k.retention}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cookie-widget-actions">
          <div className="cookie-widget-meta mono">
            {savedAgo ? <>Last saved: <span>{savedAgo}</span></> : 'No preference saved yet — defaults apply.'}
          </div>
          <div className="cookie-widget-btns">
            <button className="btn btn-ghost btn-sm" onClick={rejectAll}>Reject optional</button>
            <button className="btn btn-secondary btn-sm" onClick={saveSelection}>Save selection</button>
            <button className="btn btn-primary btn-sm" onClick={acceptAll}>Accept all</button>
          </div>
        </div>

        {toast && <div className="cookie-toast slide-in">{toast}</div>}
      </section>
    );
  }

  window.CookiePreferences = CookiePreferences;
})();
