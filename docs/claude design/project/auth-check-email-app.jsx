/* Check your email (post-signup / post-forgot) */
function CheckEmailPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthShell>
      <div className="auth-success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />
          <polyline points="22 6 12 13 2 6" />
        </svg>
      </div>
      <span className="auth-eyebrow">CHECK YOUR INBOX</span>
      <h1 className="auth-title">We just sent you a link.</h1>
      <p className="auth-subtitle">
        Sent to <strong style={{color:'var(--text-primary)'}}>ada@lovelace.co</strong>. Click the link to finish signing in. It expires in 15 minutes.
      </p>

      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        fontSize: 12.5,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        marginBottom: 18,
      }}>
        <strong style={{color:'var(--text-primary)',display:'block',marginBottom:4}}>Didn't see it?</strong>
        Check your spam folder. Our emails come from <code style={{fontFamily:"'Geist Mono',monospace",fontSize:11,background:'var(--bg-elevated)',padding:'1px 5px',borderRadius:3}}>hello@polyforge.app</code>.
      </div>

      <button
        className="auth-resend-btn"
        onClick={() => setSent(true)}
        disabled={sent}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        {sent ? 'Resent — check again in a moment' : 'Resend the email'}
      </button>

      <p className="auth-footnote" style={{marginTop: 32}}>
        Wrong email? <a href="Sign Up.html">Start over →</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<CheckEmailPage />);
