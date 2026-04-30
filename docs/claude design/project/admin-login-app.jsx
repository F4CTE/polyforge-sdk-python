/* Polyforge — Admin Login
   Single-screen sign-in for admin console. SSO + WebAuthn + IP allow-list note. */

function App() {
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const [stage, setStage] = React.useState('cred'); // cred | mfa
  const refs = React.useRef([]);

  function setDigit(i, v) {
    const next = [...code];
    next[i] = v.replace(/[^0-9]/g, '').slice(0, 1);
    setCode(next);
    if (next[i] && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-canvas)',display:'grid',gridTemplateColumns:'1fr 1fr'}}>
      {/* Left: form */}
      <div style={{display:'flex',flexDirection:'column',padding:'40px 56px',gap:32}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,borderRadius:7,background:'var(--accent-default)',display:'grid',placeItems:'center',color:'#fff'}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 11L7 2L12 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.5 7H9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </div>
          <span style={{fontSize:15,fontWeight:600,letterSpacing:'-0.01em',color:'var(--text-primary)'}}>polyforge</span>
          <span style={{fontSize:11,padding:'2px 7px',borderRadius:3,background:'var(--bg-elevated)',color:'var(--accent-text)',border:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontWeight:600,letterSpacing:'0.04em'}}>ADMIN</span>
        </div>

        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:'100%',maxWidth:380}}>
            {stage === 'cred' ? (
              <>
                <h1 style={{fontSize:26,fontWeight:600,letterSpacing:'-0.02em',color:'var(--text-primary)',margin:'0 0 8px'}}>Sign in to admin console</h1>
                <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 32px',lineHeight:1.5}}>This console is restricted to internal staff. Access is logged and audited.</p>

                <div style={{display:'grid',gap:14}}>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Email</label>
                    <input type="email" defaultValue="priya@polyforge.app" autoComplete="email" style={{width:'100%',padding:'11px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:7,fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--text-primary)',outline:'none'}} />
                  </div>
                  <div>
                    <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Password</label>
                    <input type="password" defaultValue="••••••••••••" autoComplete="current-password" style={{width:'100%',padding:'11px 14px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:7,fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--text-primary)',outline:'none',letterSpacing:'0.1em'}} />
                  </div>
                  <button onClick={() => setStage('mfa')} className="adm-btn adm-btn-primary" style={{padding:'11px 14px',fontSize:13,marginTop:6,justifyContent:'center'}}>Continue →</button>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:10,margin:'24px 0',color:'var(--text-tertiary)',fontSize:11}}>
                  <div style={{flex:1,height:1,background:'var(--border-subtle)'}} /> or <div style={{flex:1,height:1,background:'var(--border-subtle)'}} />
                </div>

                <div style={{display:'grid',gap:8}}>
                  <button className="adm-btn adm-btn-secondary" style={{padding:'11px 14px',fontSize:12.5,justifyContent:'center'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z" /></svg>
                    Continue with SSO · Okta
                  </button>
                  <button className="adm-btn adm-btn-secondary" style={{padding:'11px 14px',fontSize:12.5,justifyContent:'center'}}>
                    <AdmIcon name="key" size={13} />
                    Use security key (WebAuthn)
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 style={{fontSize:26,fontWeight:600,letterSpacing:'-0.02em',color:'var(--text-primary)',margin:'0 0 8px'}}>Two-factor</h1>
                <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 32px',lineHeight:1.5}}>Enter the 6-digit code from your authenticator. Codes refresh every 30 seconds.</p>
                <div style={{display:'flex',gap:8,marginBottom:18}}>
                  {code.map((d, i) => (
                    <input key={i} ref={el => refs.current[i] = el} value={d} onChange={e => setDigit(i, e.target.value)} maxLength={1} style={{width:48,height:56,textAlign:'center',background:'var(--bg-elevated)',border:`1px solid ${d ? 'var(--accent-default)' : 'var(--border-subtle)'}`,borderRadius:7,fontFamily:'Geist Mono, monospace',fontSize:22,fontWeight:600,color:'var(--text-primary)',outline:'none'}} />
                  ))}
                </div>
                <a href="Admin.html" className="adm-btn adm-btn-primary" style={{padding:'11px 14px',fontSize:13,justifyContent:'center',width:'100%',textDecoration:'none'}}>Verify & sign in →</a>
                <button onClick={() => setStage('cred')} style={{marginTop:14,background:'transparent',border:'none',color:'var(--text-tertiary)',fontSize:11,cursor:'pointer'}}>← Back</button>
                <div style={{marginTop:24,padding:12,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontSize:11,color:'var(--text-secondary)',lineHeight:1.6}}>
                  Lost access? <a href="#" style={{color:'var(--accent-text)',textDecoration:'none'}}>Use a backup code</a> or <a href="#" style={{color:'var(--accent-text)',textDecoration:'none'}}>contact #admin-help</a>.
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:14,fontSize:10.5,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>
          <span><AdmIcon name="shield" size={11} /> Audited & logged</span>
          <span>·</span>
          <span>Session 30 min idle</span>
          <span>·</span>
          <span>v8.4.2</span>
          <div style={{flex:1}} />
          <a href="App-Index.html" style={{color:'var(--text-tertiary)',textDecoration:'none'}}>← Back to consumer app</a>
        </div>
      </div>

      {/* Right: status panel */}
      <div style={{background:'linear-gradient(135deg, color-mix(in srgb, var(--accent-default) 8%, var(--bg-canvas)) 0%, var(--bg-canvas) 60%)',display:'flex',flexDirection:'column',padding:'40px 48px',borderLeft:'1px solid var(--border-subtle)'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:18}}>
          <div style={{maxWidth:420}}>
            <div style={{fontSize:11,color:'var(--accent-text)',fontFamily:'Geist Mono, monospace',marginBottom:10,letterSpacing:'0.08em'}}>SYSTEM STATUS · LIVE</div>
            <h2 style={{fontSize:22,fontWeight:600,letterSpacing:'-0.01em',color:'var(--text-primary)',margin:'0 0 20px',lineHeight:1.3}}>1 active incident, 4 services degraded.</h2>

            <div className="adm-card" style={{padding:0,overflow:'hidden'}}>
              {[
                { svc: 'Edge / API gateway',     state: 'op',   meta: 'p99 122ms',  c: 'var(--gain)' },
                { svc: 'Order router · primary', state: 'op',   meta: '14,820 rps', c: 'var(--gain)' },
                { svc: 'Polymarket CLOB',        state: 'down', meta: 'INC-2014',   c: 'var(--loss)' },
                { svc: 'Backtest fleet',          state: 'deg',  meta: 'p95 4.8s',   c: 'var(--warning)' },
                { svc: 'Resolution oracle',      state: 'deg',  meta: 'UMA lag',    c: 'var(--warning)' },
                { svc: 'Postgres · primary',     state: 'op',   meta: 'lag 0.2s',   c: 'var(--gain)' },
                { svc: 'Webhook delivery',       state: 'op',   meta: '99.94%',     c: 'var(--gain)' },
                { svc: 'Auth · WebAuthn',        state: 'op',   meta: '—',          c: 'var(--gain)' },
              ].map((s, i) => (
                <div key={s.svc} style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:s.c,boxShadow: s.state === 'down' ? '0 0 0 3px color-mix(in srgb, var(--loss) 24%, transparent)' : 'none'}} />
                  <span style={{flex:1,fontSize:12,color:'var(--text-primary)'}}>{s.svc}</span>
                  <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{s.meta}</span>
                  <span className="mono" style={{fontSize:10,padding:'1px 6px',borderRadius:3,background: s.state === 'down' ? 'color-mix(in srgb, var(--loss) 25%, transparent)' : s.state === 'deg' ? 'color-mix(in srgb, var(--warning) 25%, transparent)' : 'color-mix(in srgb, var(--gain) 25%, transparent)',color: s.state === 'down' ? 'var(--loss-text)' : s.state === 'deg' ? 'var(--warn-text)' : 'var(--gain-text)',fontWeight:600,letterSpacing:'0.04em'}}>{s.state.toUpperCase()}</span>
                </div>
              ))}
            </div>

            <div style={{marginTop:20,fontSize:11.5,color:'var(--text-tertiary)',lineHeight:1.7}}>
              Sign-in continues to work during incidents. Read-only views are still available — write actions on affected services are gated.
            </div>
          </div>
        </div>

        <div style={{paddingTop:20,borderTop:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:14,fontSize:10.5,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--loss)'}} />
          <span>Restricted network · admin.polyforge.app</span>
          <div style={{flex:1}} />
          <span>IP allow-list · ✓ matched</span>
        </div>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
