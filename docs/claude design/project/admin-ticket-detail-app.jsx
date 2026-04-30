/* Polyforge — Admin Ticket detail
   Two-column: conversation thread + context sidebar (user, related orders, AI suggestions) */

const MSGS = [
  { id: 1, kind: 'user',     who: 'Aaron Chen', whoMeta: 'usr_71c2 · Pro · since Q4 2023', t: 'Apr 30, 14:18',
    body: <>Hey — placing live orders on <span className="mono">FED-MAR-CUT</span> through fed-rate-cut-tracker since 13:50, every order rejects with <span className="mono" style={{padding:'1px 4px',background:'var(--bg-elevated)',borderRadius:3,fontSize:11.5}}>insufficient_collateral</span>. But account dashboard shows $14,821.42 free USDC and I'm sizing 8,400 YES @ 0.42¢ ($3,528 notional). The strategy ran fine yesterday with the same config. Already restarted the worker.</>,
    attached: ['error.log · 14KB', 'screenshot · 2.4MB'] },
  { id: 2, kind: 'system',   t: 'Apr 30, 14:18',
    body: <>Auto-tagged: <span className="mono">orders · collateral</span> · routed to <span className="mono">oliver.cho</span> (orders-incident on-call · 14:00–22:00 UTC).</> },
  { id: 3, kind: 'agent_suggest', t: 'Apr 30, 14:18',
    body: <><strong>Agent suggestion · 92% confidence</strong> — Looks like the PredictIt connector failed at 14:22 (currently down). Order router moved Aaron's open exposure to fall-back venue Kalshi, but his risk model is checking collateral against the original venue's per-market cap (Polymarket allows $50k single-market; Kalshi defaults him to $5k Tier-1 until KYC re-attest). Suggested fix: reissue with Kalshi venue in payload, or wait for PredictIt recovery.</> },
  { id: 4, kind: 'admin',    who: 'oliver.cho', whoMeta: 'admin · orders-incident on-call', t: 'Apr 30, 14:21',
    body: <>Hey Aaron, taking a look. The agent flagged this as related to the PredictIt outage — your strategy was venue-pinned to PredictIt and we re-routed your open exposure to Kalshi at 14:22. Kalshi defaults you to a $5k single-market cap until KYC re-attest, which is why the collateral check is rejecting orders that would push you over. Working on it.</> },
  { id: 5, kind: 'admin',    who: 'oliver.cho', whoMeta: 'admin', t: 'Apr 30, 14:23',
    body: <>For the next ~10–15 min while PredictIt is reconnecting, I've temporarily lifted your Kalshi single-market cap to $50k to match your Polymarket tier. Try a fresh order — should go through. We'll revert automatically when PredictIt is healthy.</> },
  { id: 6, kind: 'note',     who: 'oliver.cho', whoMeta: 'internal note · not visible to user', t: 'Apr 30, 14:24',
    body: <>Manually applied <span className="mono">single_market_cap_override:50000</span> for usr_71c2 on Kalshi. Audit logged. Will revert when PredictIt state=op. Also flagging this as a class issue — we should propagate per-venue caps correctly during automatic failover. Filing eng ticket.</> },
];

function App() {
  return (
    <AdmShell active="tickets" title="Tickets" crumbs={[{ label: 'Trust & Safety', href: 'Admin-Tickets.html' }, { label: 'Tickets', href: 'Admin-Tickets.html' }, { label: '#4214' }]}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,alignItems:'start'}}>
        {/* main */}
        <div>
          <div style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:18}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span className="mono" style={{fontSize:13,color:'var(--accent-text)',fontWeight:600}}>#4214</span>
                <AdmPill kind="warn">P1</AdmPill>
                <AdmPill kind="warn"><span className="adm-dot is-warn" />open</AdmPill>
                <span style={{fontSize:11,color:'var(--text-tertiary)'}}>created 14:18 · last activity 2m ago</span>
              </div>
              <h1 style={{fontSize:22,fontWeight:600,letterSpacing:'-0.01em',color:'var(--text-primary)',margin:0,lineHeight:1.3}}>Live order rejected — insufficient_collateral loop</h1>
              <div style={{display:'flex',gap:5,marginTop:8}}>
                {['orders','collateral','predictit-outage','enterprise-pattern'].map(t => <span key={t} style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:'var(--bg-elevated)',color:'var(--text-secondary)',fontFamily:'Geist Mono, monospace',border:'1px solid var(--border-subtle)'}}>{t}</span>)}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="adm-btn adm-btn-secondary"><AdmIcon name="bot" size={12} />Suggest reply</button>
              <button className="adm-btn adm-btn-secondary is-loss">Escalate to P0</button>
              <button className="adm-btn adm-btn-primary">Resolve</button>
            </div>
          </div>

          {/* messages */}
          <div className="adm-card" style={{padding:0,overflow:'hidden'}}>
            {MSGS.map((m, i) => {
              if (m.kind === 'system') {
                return (
                  <div key={m.id} style={{padding:'8px 18px',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:8,fontSize:11,color:'var(--text-tertiary)'}}>
                    <AdmIcon name="bot" size={12} />
                    <span style={{flex:1,fontStyle:'italic'}}>{m.body}</span>
                    <span className="mono" style={{fontSize:10}}>{m.t}</span>
                  </div>
                );
              }
              if (m.kind === 'agent_suggest') {
                return (
                  <div key={m.id} style={{margin:'12px 18px',padding:14,borderRadius:8,background:'color-mix(in srgb, var(--accent-default) 8%, transparent)',border:'1px solid color-mix(in srgb, var(--accent-default) 40%, var(--border-subtle))'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <div style={{width:24,height:24,borderRadius:6,background:'var(--accent-default)',display:'grid',placeItems:'center',color:'#fff'}}><AdmIcon name="bot" size={13} /></div>
                      <div style={{flex:1,fontSize:11.5,fontWeight:600,color:'var(--accent-text)'}}>Polysupport agent</div>
                      <span className="mono" style={{fontSize:10,color:'var(--text-tertiary)'}}>{m.t}</span>
                    </div>
                    <div style={{fontSize:12.5,color:'var(--text-primary)',lineHeight:1.6}}>{m.body}</div>
                    <div style={{display:'flex',gap:6,marginTop:10}}>
                      <button className="adm-btn adm-btn-secondary" style={{fontSize:10}}><AdmIcon name="check" size={11} />Send to user</button>
                      <button className="adm-btn adm-btn-secondary" style={{fontSize:10}}>Investigate</button>
                      <button className="adm-btn adm-btn-secondary" style={{fontSize:10}}>Dismiss</button>
                    </div>
                  </div>
                );
              }
              if (m.kind === 'note') {
                return (
                  <div key={m.id} style={{padding:'14px 18px',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',background:'color-mix(in srgb, var(--warning) 6%, transparent)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:'var(--bg-elevated)',display:'grid',placeItems:'center',fontSize:10,fontWeight:600,color:'var(--accent-text)'}}>OC</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{m.who}</div>
                        <div style={{fontSize:10.5,color:'var(--warning)'}}>{m.whoMeta}</div>
                      </div>
                      <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{m.t}</span>
                    </div>
                    <div style={{fontSize:12.5,color:'var(--text-primary)',lineHeight:1.6}}>{m.body}</div>
                  </div>
                );
              }
              const isAdmin = m.kind === 'admin';
              return (
                <div key={m.id} style={{padding:'16px 18px',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background: isAdmin ? 'var(--accent-default)' : 'var(--bg-elevated)',display:'grid',placeItems:'center',fontSize:10,fontWeight:600,color: isAdmin ? '#fff' : 'var(--text-secondary)'}}>{m.who.split(' ').map(n => n[0]).join('')}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{m.who}</div>
                      <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{m.whoMeta}</div>
                    </div>
                    <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{m.t}</span>
                  </div>
                  <div style={{fontSize:13,color:'var(--text-primary)',lineHeight:1.65}}>{m.body}</div>
                  {m.attached && (
                    <div style={{display:'flex',gap:6,marginTop:10}}>
                      {m.attached.map(a => (
                        <div key={a} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 9px',borderRadius:5,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',fontSize:11,color:'var(--text-secondary)'}}>
                          <AdmIcon name="paperclip" size={11} /><span className="mono" style={{fontSize:10.5}}>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* compose */}
            <div style={{borderTop:'1px solid var(--border-default)',padding:14,background:'var(--bg-elevated)'}}>
              <textarea placeholder="Reply to Aaron…" rows={3} style={{width:'100%',fontFamily:'Geist, sans-serif',fontSize:12.5,padding:10,background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-primary)',resize:'vertical',outline:'none'}} />
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
                <div style={{display:'flex',gap:4}}>
                  <button className="adm-icon-btn" title="Attach"><AdmIcon name="paperclip" size={13} /></button>
                  <button className="adm-icon-btn" title="Macro / template"><AdmIcon name="hammer" size={13} /></button>
                  <button className="adm-icon-btn" title="Snippet from KB"><AdmIcon name="newspaper" size={13} /></button>
                </div>
                <span style={{fontSize:11,color:'var(--text-tertiary)',marginLeft:8}}>Reply will be sent to <span className="mono">aaron@mountfair.com</span></span>
                <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                  <button className="adm-btn adm-btn-secondary">Save as note</button>
                  <button className="adm-btn adm-btn-primary"><AdmIcon name="check" size={12} />Send & resolve</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* sidebar */}
        <div style={{display:'flex',flexDirection:'column',gap:14,position:'sticky',top:72}}>
          <div className="adm-card">
            <div className="adm-card-head">
              <div className="adm-card-icon"><AdmIcon name="user-check" size={14} /></div>
              <h3 className="adm-card-title">User</h3>
              <a href="Admin-User-Detail.html" style={{marginLeft:'auto',fontSize:11,color:'var(--accent-text)',textDecoration:'none'}}>Open profile →</a>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'var(--bg-elevated)',display:'grid',placeItems:'center',fontSize:12,fontWeight:600,color:'var(--accent-text)'}}>AC</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>Aaron Chen</div>
                <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>usr_71c2 · aaron@mountfair.com</div>
              </div>
            </div>
            <div style={{display:'grid',gap:6,fontSize:11,color:'var(--text-secondary)'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>Plan</span><AdmPill kind="info">Pro</AdmPill></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>Member since</span><span className="mono">Q4 2023</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>Lifetime fees</span><span className="mono">$1,284</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>Linked venues</span><span className="mono">Polymarket, Kalshi, PredictIt</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>2FA</span><span style={{color:'var(--gain-text)'}}>webauthn</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-tertiary)'}}>Risk flags</span><span style={{color:'var(--gain-text)'}}>none</span></div>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-head">
              <div className="adm-card-icon is-loss"><AdmIcon name="dollar" size={14} /></div>
              <h3 className="adm-card-title">Recent rejected orders</h3>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:11}}>
              {[
                { t: '14:24:08', sym: 'FED-MAR-CUT', side: 'YES', size: '8,400 sh', err: 'insufficient_collateral' },
                { t: '14:23:42', sym: 'FED-MAR-CUT', side: 'YES', size: '8,400 sh', err: 'insufficient_collateral' },
                { t: '14:22:18', sym: 'FED-MAR-CUT', side: 'YES', size: '8,400 sh', err: 'insufficient_collateral' },
                { t: '14:21:48', sym: 'FED-MAR-CUT', side: 'YES', size: '8,400 sh', err: 'insufficient_collateral' },
                { t: '14:21:14', sym: 'FED-MAR-CUT', side: 'YES', size: '8,400 sh', err: 'insufficient_collateral' },
              ].map((o, i) => (
                <div key={i} style={{padding:'7px 10px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:5}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span className="mono" style={{fontSize:10,color:'var(--text-tertiary)'}}>{o.t}</span>
                    <span className="mono" style={{fontSize:10.5,fontWeight:600,color:'var(--text-primary)'}}>{o.sym}</span>
                    <span className="mono" style={{fontSize:10.5,color: o.side === 'YES' ? 'var(--gain-text)' : 'var(--loss-text)'}}>{o.side}</span>
                    <span className="mono" style={{fontSize:10.5,color:'var(--text-secondary)',marginLeft:'auto'}}>{o.size}</span>
                  </div>
                  <div className="mono" style={{fontSize:10,color:'var(--loss-text)',marginTop:3}}>{o.err}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-head">
              <div className="adm-card-icon is-info"><AdmIcon name="newspaper" size={14} /></div>
              <h3 className="adm-card-title">Likely related</h3>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <a href="Admin-Venues.html" style={{textDecoration:'none',padding:9,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,display:'block'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <span className="adm-dot is-loss" />
                  <span className="mono" style={{fontSize:11,color:'var(--text-primary)',fontWeight:500}}>PredictIt connector · DOWN</span>
                </div>
                <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>Active incident INC-2014 · 14m</div>
              </a>
              <a href="Admin-Tickets.html" style={{textDecoration:'none',padding:9,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,display:'block'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <AdmPill kind="warn">P1</AdmPill>
                  <span className="mono" style={{fontSize:11,color:'var(--text-primary)',fontWeight:500}}>#4209</span>
                </div>
                <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>Same root cause · enterprise · open</div>
              </a>
              <a href="#" style={{textDecoration:'none',padding:9,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,display:'block'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <AdmIcon name="newspaper" size={11} />
                  <span style={{fontSize:11,color:'var(--text-primary)',fontWeight:500}}>KB · Venue cap failover</span>
                </div>
                <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>Internal runbook · sre/VENUE-CAP-FAILOVER</div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
