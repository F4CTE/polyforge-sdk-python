/* Login page */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  return (
    <AuthShell>
      <span className="auth-eyebrow">LOG IN</span>
      <h1 className="auth-title">Welcome back.</h1>
      <p className="auth-subtitle">
        Don't have an account? <a href="Sign Up.html">Sign up free →</a>
      </p>

      <Providers labelPrefix="Sign in" />

      <div className="auth-divider">or with email</div>

      <form onSubmit={e => { e.preventDefault(); window.location.href = '#'; }}>
        <Field label="Email">
          <input
            type="email"
            className="auth-input"
            placeholder="you@work.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>

        <Field
          label="Password"
          rightLabel={<a href="Forgot Password.html">Forgot?</a>}
        >
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </Field>

        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <span>Stay signed in on this device</span>
        </label>

        <button type="submit" className="auth-submit">
          Sign in
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>

      <p className="auth-footnote">
        Trouble signing in? <a href="Contact.html">Get help →</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<LoginPage />);
