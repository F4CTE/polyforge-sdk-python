/* Reset password (with token) */
function ResetPasswordPage() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const match = pw && pw === pw2;
  const longEnough = pw.length >= 8;

  return (
    <AuthShell>
      <span className="auth-eyebrow">PASSWORD RESET</span>
      <h1 className="auth-title">Pick a new password.</h1>
      <p className="auth-subtitle">
        Resetting password for <strong style={{color:'var(--text-primary)'}}>ada@lovelace.co</strong>. Choose something you haven't used here before.
      </p>

      <form onSubmit={e => { e.preventDefault(); window.location.href = 'Login.html'; }}>
        <Field
          label="New password"
          hint="At least 8 characters. A mix of letters, numbers, and a symbol is best."
        >
          <PasswordInput
            value={pw}
            onChange={setPw}
            autoComplete="new-password"
            placeholder="New password"
          />
        </Field>
        {pw && <Strength value={pw} />}

        <div style={{height: 8}} />

        <Field
          label="Confirm new password"
          error={pw2 && !match ? 'Passwords don\'t match yet.' : null}
        >
          <PasswordInput
            value={pw2}
            onChange={setPw2}
            autoComplete="new-password"
            placeholder="Type it again"
          />
        </Field>

        <button type="submit" className="auth-submit" disabled={!longEnough || !match}>
          Save new password
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </form>

      <p className="auth-footnote">
        Didn't request this? <a href="Contact.html">Let us know →</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<ResetPasswordPage />);
