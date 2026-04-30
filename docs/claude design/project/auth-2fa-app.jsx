/* 2FA challenge */
function TwoFactorPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const refs = useRef([]);

  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code]; next[i] = v; setCode(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const t = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    const next = t.padEnd(6, ' ').slice(0, 6).split('').map(c => c === ' ' ? '' : c);
    setCode(next);
    refs.current[Math.min(t.length, 5)]?.focus();
  };

  const complete = code.every(d => d);

  return (
    <AuthShell>
      <span className="auth-eyebrow">TWO-FACTOR AUTH</span>
      <h1 className="auth-title">One more step.</h1>
      <p className="auth-subtitle">
        Enter the 6-digit code from your authenticator app. We won't ask again on this device for 30 days.
      </p>

      <form onSubmit={e => { e.preventDefault(); window.location.href = '#'; }}>
        <div className="auth-otp" onPaste={onPaste}>
          {code.map((d, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => setDigit(i, e.target.value)}
              onKeyDown={e => onKey(i, e)}
              aria-label={`Digit ${i + 1}`}
              autoFocus={i === 0}
            />
          ))}
        </div>

        <button type="submit" className="auth-submit" disabled={!complete}>
          Verify and sign in
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </form>

      <div style={{
        marginTop: 24,
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        <strong style={{color:'var(--text-primary)'}}>Lost your device?</strong>{' '}
        Use a <a href="#" style={{color:'var(--accent-text)',textDecoration:'none'}}>backup code</a> or{' '}
        <a href="Contact.html" style={{color:'var(--accent-text)',textDecoration:'none'}}>contact support</a>.
      </div>

      <p className="auth-footnote" style={{marginTop: 16}}>
        Not Ada? <a href="Login.html">Sign in as someone else →</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<TwoFactorPage />);
