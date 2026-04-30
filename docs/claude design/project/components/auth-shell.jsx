/* Polyforge Auth Shell — shared components for login/signup/password/2fa pages */
/* eslint-disable */

const { useState, useEffect, useRef, useMemo } = React;

// ---------- Tweak defaults (editable via host) ----------
const AUTH_TWEAKS = /*EDITMODE-BEGIN*/{
  "layout": "split",
  "brandMode": "dashboard"
}/*EDITMODE-END*/;

// ---------- Wordmark ----------
function Wordmark() {
  return (
    <a
      href="Landing Page.html"
      className="auth-wordmark"
      aria-label="Polyforge home"
      onClick={(e) => {
        e.preventDefault();
        try { window.top.location.href = 'Landing Page.html'; }
        catch (_) { window.location.href = 'Landing Page.html'; }
      }}
    >
      <span className="auth-wordmark-mark" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.5"/>
          <path d="m3 7 9 5 9-5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 12v10" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      </span>
      polyforge
    </a>
  );
}

// ---------- Provider buttons ----------
const PROVIDER_ICONS = {
  google: (
    <svg viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.91 6.91 0 0 1 5.5 12c0-.72.12-1.43.34-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.25 9.27 7.76 10.77.57.1.77-.25.77-.55v-1.94c-3.16.69-3.83-1.52-3.83-1.52-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.72-1.54-2.52-.29-5.18-1.26-5.18-5.61 0-1.24.44-2.26 1.17-3.05-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.17A10.96 10.96 0 0 1 12 6.1c.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.62 1.57.23 2.73.11 3.02.73.79 1.17 1.81 1.17 3.05 0 4.36-2.67 5.31-5.2 5.6.41.35.77 1.05.77 2.12v3.15c0 .31.2.66.78.55 4.5-1.5 7.75-5.75 7.75-10.77C23.33 5.56 18.27.5 12 .5z"/>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  ),
  passkey: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M10.3 14H10a7 7 0 0 0-7 7h9" />
      <circle cx="18" cy="17" r="3" />
      <path d="M18 20v2M18 14v-1" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  ),
  polymarket: (
    <span className="auth-venue-mark auth-venue-mark-poly" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18 L10 6 L16 18 L10 14 Z" fill="currentColor" />
        <path d="M14 9 L20 9" />
      </svg>
    </span>
  ),
  kalshi: (
    <span className="auth-venue-mark auth-venue-mark-kalshi" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4 L6 20" />
        <path d="M6 12 L16 4" />
        <path d="M6 12 L18 20" />
      </svg>
    </span>
  ),
};

function Providers({ include = ['google', 'github', 'passkey', 'venues'], labelPrefix = 'Continue' }) {
  const hasVenues = include.includes('venues');
  const hasOauth = include.some(x => ['google','github','apple','passkey'].includes(x));
  return (
    <>
      <div className="auth-providers">
        {include.includes('google') && (
          <button type="button" className="auth-provider" onClick={e => e.preventDefault()}>
            {PROVIDER_ICONS.google} Google
          </button>
        )}
        {include.includes('github') && (
          <button type="button" className="auth-provider" onClick={e => e.preventDefault()}>
            {PROVIDER_ICONS.github} GitHub
          </button>
        )}
        {include.includes('apple') && (
          <button type="button" className="auth-provider" onClick={e => e.preventDefault()}>
            {PROVIDER_ICONS.apple} Apple
          </button>
        )}
        {include.includes('passkey') && (
          <button type="button" className="auth-provider wide" onClick={e => e.preventDefault()}>
            {PROVIDER_ICONS.passkey} {labelPrefix} with passkey
          </button>
        )}
      </div>
      {hasVenues && (
        <>
          {hasOauth && <div className="auth-providers-label">OR WITH VENUE WALLET</div>}
          <div className="auth-providers">
            <button type="button" className="auth-provider" onClick={e => e.preventDefault()}>
              {PROVIDER_ICONS.polymarket} Polymarket
            </button>
            <button type="button" className="auth-provider" onClick={e => e.preventDefault()}>
              {PROVIDER_ICONS.kalshi} Kalshi
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ---------- Form field ----------
function Field({ label, hint, error, trailing, children, rightLabel }) {
  return (
    <div className="auth-field">
      {(label || rightLabel) && (
        <div className="auth-field-label">
          <span>{label}</span>
          {rightLabel}
        </div>
      )}
      <div className="auth-input-wrap">
        {children}
        {trailing}
      </div>
      {error ? (
        <div className="auth-field-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
          {error}
        </div>
      ) : hint ? (
        <div className="auth-field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = '••••••••', id, autoComplete = 'current-password', error }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`auth-input has-icon${error ? ' error' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="auth-input-btn"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow(!show)}
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </>
  );
}

// ---------- Password strength ----------
function scorePassword(pw) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { level: 0, label: '', cls: '' },
    { level: 1, label: 'Too short', cls: 'weak' },
    { level: 2, label: 'Weak', cls: 'weak' },
    { level: 3, label: 'Fair', cls: 'fair' },
    { level: 4, label: 'Good', cls: 'good' },
    { level: 5, label: 'Strong', cls: 'strong' },
  ];
  return levels[Math.min(5, score)];
}

function Strength({ value }) {
  const s = scorePassword(value);
  return (
    <>
      <div className="auth-strength">
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            className={`auth-strength-bar${s.level >= n ? ' on-' + s.cls : ''}`}
          />
        ))}
      </div>
      {s.label && <div className={`auth-strength-label ${s.cls}`}>{s.label}</div>}
    </>
  );
}

// ---------- Trust bar ----------
function TrustBar() {
  return (
    <div className="auth-trust">
      <span className="auth-trust-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        SOC 2 Type II
      </span>
      <span className="auth-trust-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        2FA + Passkeys
      </span>
      <span className="auth-trust-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Never holds your funds
      </span>
    </div>
  );
}

// ---------- Brand pane widgets ----------
function EquityCurve() {
  // Deterministic fake equity curve — monotonic overall, some noise
  const points = useMemo(() => {
    const n = 48;
    const pts = [];
    let v = 10;
    const seed = [0.1, -0.05, 0.2, 0.15, -0.1, 0.08, 0.22, 0.12, -0.15, 0.05, 0.18, 0.25, 0.1, -0.08, 0.2, 0.15, 0.3, 0.22, 0.18, 0.1, 0.25, -0.2, 0.15, 0.28];
    for (let i = 0; i < n; i++) {
      v += seed[i % seed.length] * 0.8 + (i * 0.02);
      pts.push(v);
    }
    return pts;
  }, []);
  const min = Math.min(...points), max = Math.max(...points);
  const W = 420, H = 84;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p - min) / (max - min || 1)) * (H - 8) - 4;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `${path} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="auth-equity-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--gain)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eqg)" />
      <path d={path} fill="none" stroke="var(--gain)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function WhaleFeed() {
  const rows = [
    { initials: '0xA1', name: 'snorkelman.eth', action: 'bought YES on', market: 'Fed May rate cut', size: '$24.8k' },
    { initials: 'kq', name: 'kelly-queen', action: 'sold NO on', market: 'BTC > $120k Jun 30', size: '$12.1k' },
    { initials: 'mx', name: 'mxbet.eth', action: 'bought YES on', market: 'Dem Senate 2026', size: '$8.4k' },
    { initials: 'pc', name: 'polycat', action: 'added to', market: 'Oscars Best Pic', size: '$5.2k' },
  ];
  return (
    <div className="auth-preview-card">
      <div className="auth-preview-head">
        <span className="auth-preview-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/></svg>
          Top whales · live
        </span>
        <span className="auth-preview-val">4 active</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="auth-whale-row">
          <div className="auth-whale-avatar">{r.initials}</div>
          <div>
            <span className="auth-whale-name">{r.name}</span>
            <span className="auth-whale-action">{r.action} {r.market}</span>
          </div>
          <div className="auth-whale-size">{r.size}</div>
        </div>
      ))}
    </div>
  );
}

function FillTicker() {
  const fills = [
    { side: 'buy', market: 'Fed cuts in May', price: '0.68', qty: '500' },
    { side: 'sell', market: 'Lakers make playoffs', price: '0.42', qty: '250' },
    { side: 'buy', market: 'ETH > $5k by Q3', price: '0.31', qty: '1,200' },
    { side: 'buy', market: 'Dem wins Senate', price: '0.55', qty: '800' },
    { side: 'sell', market: 'AAPL beats earnings', price: '0.73', qty: '320' },
  ];
  return (
    <div className="auth-preview-card">
      <div className="auth-preview-head">
        <span className="auth-preview-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 12 9 12 11 6 13 18 15 12 21 12"/></svg>
          Recent fills · my strategies
        </span>
        <span className="auth-preview-val gain">+4.2%</span>
      </div>
      {fills.map((f, i) => (
        <div key={i} className="auth-fill-row">
          <span className={`auth-fill-side ${f.side}`}>{f.side.toUpperCase()}</span>
          <span className="auth-fill-market">{f.market}</span>
          <span className="auth-fill-price">{f.qty} @ {f.price}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardBrand() {
  return (
    <>
      <span className="auth-brand-eyebrow">
        <span className="auth-brand-eyebrow-dot" />
        LIVE · MAINNET
      </span>
      <h2 className="auth-brand-title">Watch the market. Build the rule. Let it run.</h2>
      <p className="auth-brand-sub">What you'll see inside Polyforge — whale flow, live fills, and the equity curves of every strategy you build. Paper-trade free forever.</p>

      <div className="auth-preview-card">
        <div className="auth-preview-head">
          <span className="auth-preview-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 21 6"/></svg>
            EMA-crossover · paper
          </span>
          <span className="auth-preview-val gain">+$1,284.50</span>
        </div>
        <EquityCurve />
        <div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:11,color:'var(--text-tertiary)',fontFamily:"'Geist Mono',monospace"}}>
          <span>24 TRADES · 68% WIN</span>
          <span>SHARPE 1.34</span>
        </div>
      </div>
      <WhaleFeed />
      <FillTicker />
    </>
  );
}

function QuoteBrand() {
  return (
    <>
      <span className="auth-brand-eyebrow">
        <span className="auth-brand-eyebrow-dot" />
        WHY POLYFORGE
      </span>
      <h2 className="auth-brand-title">Built by and for people who actually trade these markets.</h2>
      <p className="auth-brand-sub">12,400+ traders use Polyforge to test ideas against years of real data, copy proven whales, and sleep through the night knowing their strategies have kill switches that work.</p>

      <div className="auth-quote-card">
        <div className="auth-quote-mark">"</div>
        <p className="auth-quote-body">I'd built the same mean-reversion bot four times in four different notebooks. Polyforge let me ship it properly in an afternoon, backtest it for real, and finally stop losing money on my off-by-one indexing.</p>
        <div className="auth-quote-who">
          <div className="auth-quote-avatar">DM</div>
          <div className="auth-quote-meta">
            <strong>Devin Mora</strong> · Independent trader · $2.4M AUM
          </div>
        </div>
      </div>
      <div className="auth-quote-card">
        <div className="auth-quote-mark">"</div>
        <p className="auth-quote-body">We replaced a pile of shell scripts with a single Polyforge workspace. The whale dashboard alone paid for itself in the first week.</p>
        <div className="auth-quote-who">
          <div className="auth-quote-avatar">JK</div>
          <div className="auth-quote-meta">
            <strong>Jess Kim</strong> · Eng lead · Artemis Research
          </div>
        </div>
      </div>
    </>
  );
}

function BrandPane({ mode = 'dashboard' }) {
  return (
    <aside className="auth-brand-pane grid-bg">
      {mode === 'quote' ? <QuoteBrand /> : <DashboardBrand />}
    </aside>
  );
}

// ---------- Tweaks panel ----------
function Tweaks({ state, setState }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (_) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const update = (patch) => {
    const next = { ...state, ...patch };
    setState(next);
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*'); } catch (_) {}
  };

  return (
    <div className={`auth-tweaks${open ? ' visible' : ''}`}>
      <div className="auth-tweaks-title">
        <span>Tweaks</span>
        <button onClick={() => setOpen(false)} style={{background:'none',border:0,color:'var(--text-tertiary)',cursor:'pointer',padding:0}}>✕</button>
      </div>
      <div>
        <label>Layout</label>
        <div className="auth-tweaks-seg">
          <button className={state.layout === 'split' ? 'active' : ''} onClick={() => update({ layout: 'split' })}>Split</button>
          <button className={state.layout === 'centered' ? 'active' : ''} onClick={() => update({ layout: 'centered' })}>Centered</button>
        </div>
      </div>
      <div>
        <label>Brand pane</label>
        <div className="auth-tweaks-seg">
          <button className={state.brandMode === 'dashboard' ? 'active' : ''} onClick={() => update({ brandMode: 'dashboard' })}>Dashboard</button>
          <button className={state.brandMode === 'quote' ? 'active' : ''} onClick={() => update({ brandMode: 'quote' })}>Quote</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Shell wrapper ----------
function AuthShell({ children }) {
  const [state, setState] = useState(AUTH_TWEAKS);

  useEffect(() => {
    document.body.classList.add('auth-body');
  }, []);

  const { layout, brandMode } = state;

  return (
    <>
      <div className={`auth-shell ${layout}`}>
        <section className="auth-form-pane">
          <Wordmark />
          <a
            href="Landing Page.html"
            className="auth-back-home"
            onClick={(e) => {
              // Bulletproof fallback for sandboxed iframes: force top-level nav
              e.preventDefault();
              try { window.top.location.href = 'Landing Page.html'; }
              catch (_) { window.location.href = 'Landing Page.html'; }
            }}
          >
            ← Back to site
          </a>
          <div className="auth-form-inner">
            {children}
          </div>
          <TrustBar />
        </section>
        {layout === 'split' && <BrandPane mode={brandMode} />}
      </div>
      <Tweaks state={state} setState={setState} />
    </>
  );
}

// Expose to other script files
Object.assign(window, {
  AuthShell, Wordmark, Providers, Field, PasswordInput, Strength, TrustBar, BrandPane,
  EquityCurve, WhaleFeed, FillTicker,
});
