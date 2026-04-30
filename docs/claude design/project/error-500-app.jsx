/* eslint-disable */
/* 500 — Circuit breaker tripped */

(() => {
  const { useState, useEffect, useMemo } = React;

  // Trace lines — looks like the strategy runtime tripped its kill-switch
  const TRACE = [
    { ts: '14:32:07.412', svc: 'router',         lvl: 'info',  msg: 'inbound GET /strategies/sb_4f7a' },
    { ts: '14:32:07.418', svc: 'runtime',        lvl: 'warn',  msg: 'upstream latency 2.4s · sla 0.8s' },
    { ts: '14:32:07.421', svc: 'runtime',        lvl: 'warn',  msg: 'retry budget exhausted (3/3)' },
    { ts: '14:32:07.430', svc: 'risk-engine',    lvl: 'error', msg: 'circuit breaker tripped · sb_4f7a' },
    { ts: '14:32:07.431', svc: 'kill-switch',    lvl: 'error', msg: 'open positions safe · no orders sent' },
    { ts: '14:32:07.433', svc: 'pager',          lvl: 'info',  msg: 'on-call notified · ack expected < 5m' },
  ];

  function useIncidentId() {
    return useMemo(() => {
      const n = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
      return 'INC-2604-' + n.toUpperCase();
    }, []);
  }

  function App() {
    const incidentId = useIncidentId();
    const [secs, setSecs] = useState(0);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
      const t = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => clearInterval(t);
    }, []);

    const onRetry = () => {
      setRetrying(true);
      // simulate a retry — then reload
      setTimeout(() => {
        try { window.location.reload(); } catch {}
        setRetrying(false);
      }, 1200);
    };

    const copyId = async () => {
      try { await navigator.clipboard.writeText(incidentId); } catch {}
    };

    return (
      <>
        <Nav />
        <main className="err-main err-main-500">
          <div className="err-container">

            {/* Header strip — incident banner */}
            <div className="err-strip err-strip-500">
              <span className="err-strip-dot err-strip-dot-error" />
              <span className="err-strip-label">INCIDENT</span>
              <span className="err-strip-path mono">{incidentId}</span>
              <span className="err-strip-status is-err">5xx</span>
              <span className="err-strip-time mono">elapsed {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</span>
            </div>

            <div className="err-grid">
              {/* LEFT — display */}
              <div className="err-display">
                <div className="err-eyebrow">
                  <span className="dot dot-pulse" style={{ background: 'var(--loss)' }} />
                  <span>Server error</span>
                </div>

                <h1 className="err-code">
                  <span className="err-code-digit">5</span>
                  <span className="err-code-digit err-code-zero">0</span>
                  <span className="err-code-digit">0</span>
                </h1>

                <p className="err-lede">
                  Something on our side tripped a circuit breaker. Your session is safe and any open
                  strategies are paused — <strong>no orders were sent in error</strong>. The on-call
                  engineer has been paged.
                </p>

                <div className="err-safe-grid">
                  <div className="err-safe-item">
                    <Icon name="shield" size={14} />
                    <div>
                      <div className="err-safe-title">Positions safe</div>
                      <div className="err-safe-sub">Kill-switch engaged · 0 orders sent</div>
                    </div>
                  </div>
                  <div className="err-safe-item">
                    <Icon name="lock" size={14} />
                    <div>
                      <div className="err-safe-title">Funds untouched</div>
                      <div className="err-safe-sub">Wallet remains under your custody</div>
                    </div>
                  </div>
                  <div className="err-safe-item">
                    <Icon name="bell" size={14} />
                    <div>
                      <div className="err-safe-title">On-call paged</div>
                      <div className="err-safe-sub">ETA &lt; 5m · auto-recover if possible</div>
                    </div>
                  </div>
                </div>

                <div className="err-cta-row">
                  <button className="btn btn-primary btn-lg" onClick={onRetry} disabled={retrying}>
                    {retrying ? (
                      <><span className="err-spinner" /> Retrying…</>
                    ) : (
                      <>Try again</>
                    )}
                  </button>
                  <a href="Status.html" className="btn btn-secondary btn-lg">
                    <span className="dot dot-pulse" style={{ background: 'var(--gain)' }} /> System status
                  </a>
                  <a href="Landing Page.html" className="btn btn-ghost btn-lg">Back to home</a>
                </div>

                <div className="err-incident-card">
                  <div>
                    <div className="err-incident-label">Incident reference</div>
                    <div className="err-incident-id mono">{incidentId}</div>
                  </div>
                  <button className="btn btn-ghost" onClick={copyId} aria-label="Copy incident ID">
                    <Icon name="copy" size={13} /> Copy
                  </button>
                </div>

                <p className="err-fineprint">
                  Include this ID if you <a href="Contact.html">contact support</a>. We log every request
                  with a 90-day retention so we can replay exactly what happened.
                </p>
              </div>

              {/* RIGHT — trace panel */}
              <aside className="err-panel">
                <div className="err-panel-head">
                  <div className="err-panel-title">trace.log</div>
                  <div className="err-panel-meta mono">
                    <span>{incidentId}</span>
                    <span className="sep">·</span>
                    <span>region eu-west-2</span>
                  </div>
                </div>

                <div className="err-panel-body">
                  {TRACE.map((t, i) => (
                    <div key={i} className="err-log-row">
                      <span className="err-log-ts mono">{t.ts}</span>
                      <span className="err-log-host">{t.svc}</span>
                      <span className={`err-log-code is-${t.lvl}`}>{t.lvl}</span>
                      <span className="err-log-msg">{t.msg}</span>
                    </div>
                  ))}

                  <div className="err-log-row err-log-final">
                    <span className="err-log-ts mono">14:32:07.500</span>
                    <span className="err-log-host">edge</span>
                    <span className="err-log-code is-err">FAIL</span>
                    <span className="err-log-msg">surfacing /500 to user · graceful degrade</span>
                  </div>
                </div>

                <div className="err-panel-foot">
                  <Icon name="info" size={12} />
                  <span>Live updates on <a href="Status.html">status.polyforge.app</a> as we work.</span>
                </div>
              </aside>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
