/* Polyforge — Admin Login
   Single-screen sign-in for admin console.
   Uses auth.css design language with admin-specific status panel + restricted-network footer. */

const { useState, useRef } = React;

function AdminLogin() {
  const [stage, setStage] = useState('cred'); // cred | mfa
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const refs = useRef([]);

  function setDigit(i, v) {
    const next = [...code];
    next[i] = v.replace(/[^0-9]/g, '').slice(0, 1);
    setCode(next);
    if (next[i] && i < 5) refs.current[i + 1]?.focus();
  }
  function onKey(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  }

  return (
    <div className="auth-shell split">
      {/* ---- Left: form pane ---- */}
      <div className="auth-form-pane">
        <a href="App-Index.html" className="auth-wordmark" onClick={e => { e.preventDefault(); window.location.href = 'App-Index.html'; }}>
          <span className="auth-wordmark-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
          <path d="M12 11.7 L4.5 8 M12 11.7 L19.5 8 M12 11.7 V22" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 5.5v3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              <path d="M6.15 15.25l2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              <path d="M17.85 15.25l-2.7-1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
            </svg>
          </span>
          polyforge
          <span className="admlog-tag">ADMIN</span>
        </a>

        <div className="auth-form-inner">
          {stage === 'cred' ? (
            <>
              <span className="auth-eyebrow">SIGN IN</span>
              <h1 className="auth-title">Admin console.</h1>
              <p className="auth-subtitle">
                Restricted to internal staff. Every action is logged and audited. Trouble? <a href="#">#admin-help</a>
              </p>

              <form onSubmit={e => { e.preventDefault(); setStage('mfa'); }}>
                <div className="auth-field">
                  <div className="auth-field-label"><span>Work email</span></div>
                  <div className="auth-input-wrap">
                    <input
                      type="email"
                      className="auth-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      style={{fontFamily: 'Geist Mono, monospace'}}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <div className="auth-field-label">
                    <span>Password</span>
                    <a href="#">Forgot?</a>
                  </div>
                  <div className="auth-input-wrap">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="auth-input has-icon"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{fontFamily: 'Geist Mono, monospace', letterSpacing: showPw ? 0 : '0.1em'}}
                    />
                    <button type="button" className="auth-input-btn" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw(!showPw)}>
                      {showPw
                        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-submit">
                  Continue
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </form>

              <div className="auth-divider">or</div>

              <div className="auth-providers">
                <button type="button" className="auth-provider wide" onClick={e => e.preventDefault()}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L2 7v10c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z" /></svg>
                  Continue with Okta SSO
                </button>
                <button type="button" className="auth-provider wide" onClick={e => e.preventDefault()}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="8" r="4" /><path d="M10.3 14H10a7 7 0 0 0-7 7h9" /><circle cx="18" cy="17" r="3" /><path d="M18 20v2M18 14v-1" /></svg>
                  Use security key (WebAuthn)
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="auth-eyebrow">TWO-FACTOR</span>
              <h1 className="auth-title">Verify your identity.</h1>
              <p className="auth-subtitle">
                Enter the 6-digit code from your authenticator app. Codes refresh every 30 seconds.
              </p>

              <div className="auth-otp">
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={el => refs.current[i] = el}
                    value={d}
                    onChange={e => setDigit(i, e.target.value)}
                    onKeyDown={e => onKey(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <a href="Admin.html" className="auth-submit" style={{textDecoration: 'none'}}>
                Verify & sign in
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </a>

              <div style={{display: 'flex', justifyContent: 'center', marginTop: 14}}>
                <button type="button" onClick={() => setStage('cred')} style={{background: 'none', border: 0, color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', padding: 4}}>
                  ← Use a different account
                </button>
              </div>

              <div className="admlog-callout">
                <strong style={{color: 'var(--text-primary)', fontWeight: 500}}>Lost access?</strong> Use a <a href="#">backup code</a> or ping <a href="#">#admin-help</a>. Backup-code use is paged to the security on-call.
              </div>
            </>
          )}
        </div>

        <div className="auth-trust" style={{marginTop: 24}}>
          <span className="auth-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Audited &amp; logged
          </span>
          <span className="auth-trust-item" style={{color: 'var(--text-tertiary)'}}>30 min idle timeout</span>
          <span className="auth-trust-item" style={{color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace'}}>v8.4.2</span>
          <span style={{flex: 1}} />
          <a href="App-Index.html" className="admlog-foot-link">← Consumer app</a>
        </div>
      </div>

      {/* ---- Right: status panel ---- */}
      <aside className="auth-brand-pane grid-bg admlog-brand-pane">
        <div className="admlog-brand-inner">
          <div className="admlog-status-headline">
            <div className="admlog-status-headline-row">
              <span className="auth-brand-eyebrow">
                <span className="auth-brand-eyebrow-dot" style={{background: 'var(--loss)'}} />
                SYSTEM STATUS · LIVE
              </span>
              <a href="#" className="admlog-status-link">status.polyforge.app ↗</a>
            </div>
            <h2 className="auth-brand-title" style={{margin: 0}}>1 active incident · 2 services degraded.</h2>
            <p className="auth-brand-sub" style={{margin: 0}}>
              <span className="admlog-status-incident">INC-2014</span> &nbsp;·&nbsp; Polymarket CLOB connection unstable since 14:32 UTC. Order routing failing over to Kalshi automatically; reads unaffected.
            </p>
          </div>

          <div className="admlog-status-card">
            {[
              { svc: 'Edge / API gateway',     state: 'op',   meta: 'p99 122ms' },
              { svc: 'Order router · primary', state: 'op',   meta: '14,820 rps' },
              { svc: 'Polymarket CLOB',        state: 'down', meta: 'INC-2014' },
              { svc: 'Backtest fleet',         state: 'deg',  meta: 'p95 4.8s' },
              { svc: 'Resolution oracle',      state: 'deg',  meta: 'UMA lag' },
              { svc: 'Postgres · primary',     state: 'op',   meta: 'lag 0.2s' },
              { svc: 'Webhook delivery',       state: 'op',   meta: '99.94%' },
              { svc: 'Auth · WebAuthn',        state: 'op',   meta: '—' },
            ].map(s => (
              <div key={s.svc} className="admlog-status-row">
                <span className={`admlog-status-dot is-${s.state}`} />
                <span className="admlog-status-svc">{s.svc}</span>
                <span className="admlog-status-meta">{s.meta}</span>
                <span className={`admlog-status-pill is-${s.state}`}>{s.state.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <div className="admlog-status-foot">
            Sign-in stays available during incidents. Read-only views are still served — write actions on affected services are gated.
          </div>
        </div>

        <div className="admlog-ip-strip">
          <span className="admlog-ip-host">admin.polyforge.app</span>
          <span>·</span>
          <span>restricted network</span>
          <span className="admlog-ip-ok">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            IP allow-list matched
          </span>
        </div>
      </aside>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminLogin />);
