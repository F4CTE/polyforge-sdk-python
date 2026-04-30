/* Sign up page */
function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <AuthShell>
      <span className="auth-eyebrow">SIGN UP</span>
      <h1 className="auth-title">Start trading smarter.</h1>
      <p className="auth-subtitle">
        Free forever for paper trading. No credit card.{' '}
        <a href="Login.html">Already have an account?</a>
      </p>

      <Providers labelPrefix="Sign up" />

      <div className="auth-divider">or with email</div>

      <form onSubmit={e => { e.preventDefault(); window.location.href = 'Check Email.html'; }}>
        <Field label="Full name">
          <input
            type="text"
            className="auth-input"
            placeholder="Ada Lovelace"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <Field
          label="Work email"
          error={email && !emailValid ? 'That doesn\'t look like a valid email.' : null}
        >
          <input
            type="email"
            className={`auth-input${email && !emailValid ? ' error' : ''}`}
            placeholder="you@work.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>

        <Field
          label="Password"
          hint="At least 8 characters. Mix of letters, numbers, and a symbol is ideal."
        >
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="Something only you know"
          />
        </Field>
        {password && <Strength value={password} />}

        <label className="auth-check">
          <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} />
          <span>
            I agree to the <a href="Terms.html">Terms of Service</a>, <a href="Privacy.html">Privacy Policy</a>, and acknowledge the <a href="Risk Disclosure.html">Risk Disclosure</a>.
          </span>
        </label>

        <label className="auth-check">
          <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} />
          <span>Send me the weekly whale report and product updates. Unsubscribe anytime.</span>
        </label>

        <button type="submit" className="auth-submit" disabled={!accept || !emailValid || !email || password.length < 8}>
          Create account
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>

      <p className="auth-footnote">
        We never touch your trading capital. Ever. <a href="Guide-Security.html">How that works →</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<SignupPage />);
