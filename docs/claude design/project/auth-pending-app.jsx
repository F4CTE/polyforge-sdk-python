/* Pending approval — post-signup, awaiting beta access */
function PendingApprovalPage() {
  return (
    <AuthShell>
      <div className="auth-success-icon" style={{
        background: 'color-mix(in oklch, var(--warning) 14%, transparent)',
        color: 'var(--warning)',
        borderColor: 'color-mix(in oklch, var(--warning) 35%, transparent)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      </div>
      <span className="auth-eyebrow">YOU'RE ON THE LIST</span>
      <h1 className="auth-title">Account pending approval.</h1>
      <p className="auth-subtitle">
        Your account is awaiting beta access. We'll email <strong style={{color:'var(--text-primary)'}}>ada@lovelace.co</strong> the moment a seat opens.
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
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2,color:'var(--accent-text)'}}>
          <path d="M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />
          <polyline points="22 6 12 13 2 6" />
        </svg>
        <span>
          <strong style={{color:'var(--text-primary)',display:'block',marginBottom:4}}>While you wait</strong>
          We've sent a confirmation to your inbox so you can verify your address. The clock starts the moment a reviewer approves your account.
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 22,
      }}>
        <div style={{
          padding: '12px 12px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
        }}>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:18,color:'var(--text-primary)',fontWeight:500,letterSpacing:'-0.02em',marginBottom:2}}>1,247</div>
          <div style={{fontSize:11,color:'var(--text-tertiary)',letterSpacing:'0.02em'}}>ahead of you</div>
        </div>
        <div style={{
          padding: '12px 12px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
        }}>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:18,color:'var(--text-primary)',fontWeight:500,letterSpacing:'-0.02em',marginBottom:2}}>~5d</div>
          <div style={{fontSize:11,color:'var(--text-tertiary)',letterSpacing:'0.02em'}}>typical wait</div>
        </div>
        <div style={{
          padding: '12px 12px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
        }}>
          <div style={{fontFamily:"'Geist Mono',monospace",fontSize:18,color:'var(--text-primary)',fontWeight:500,letterSpacing:'-0.02em',marginBottom:2}}>43</div>
          <div style={{fontSize:11,color:'var(--text-tertiary)',letterSpacing:'0.02em'}}>seats this week</div>
        </div>
      </div>

      <p style={{
        fontSize: 12,
        color: 'var(--text-tertiary)',
        lineHeight: 1.55,
        marginBottom: 18,
        padding: '10px 12px',
        background: 'var(--bg-elevated)',
        border: '1px dashed var(--border-subtle)',
        borderRadius: 6,
      }}>
        <strong style={{color:'var(--text-secondary)'}}>Tip ·</strong> Have an invite code? <a href="Sign Up.html" style={{color:'var(--accent-text)'}}>Skip the line →</a>
      </p>

      <p className="auth-footnote">
        Wrong email? <a href="mailto:hello@polyforge.app">Reach the team</a> · <a href="Login.html">Back to sign in</a>
      </p>
    </AuthShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<PendingApprovalPage />);
