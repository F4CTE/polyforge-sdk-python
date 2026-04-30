/* Forgot password */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');

  return (
    <AuthShell>
      <span className="auth-eyebrow">PASSWORD RESET</span>
      <h1 className="auth-title">Forgot your password?</h1>
      <p className="auth-subtitle">
        Happens to everyone. Drop your email and we'll send you a link to reset it.
      </p>

      <form onSubmit={e => { e.preventDefault(); window.location.href = 'Check Email.html'; }}>
        <Field label="Email">
          <input
            type="email"
            className="auth-input"
            placeholder="you@work.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
        </Field>

        <button type="submit" className="auth-submit" disabled={!email}>
          Send reset link
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 6l-10 7L2 6"/><path d="M2 6h20v12H2z"/></svg>
        </button>
      </form>

      <p className="auth-footnote">
        Remembered it? <a href="Login.html">Back to sign in</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<ForgotPasswordPage />);
