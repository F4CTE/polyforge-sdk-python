/* Polyforge — Admin Broadcasts
   Compose & schedule announcements: in-app banner, push, email, system message.
   Audience targeting + recent broadcasts list. */

function App() {
  const [tab, setTab] = React.useState('compose');
  const [channels, setChannels] = React.useState({ banner: true, push: true, email: false, sys: false });
  const [aud, setAud] = React.useState('pro_quant');

  return (
    <AdmShell active="broadcasts" title="Broadcasts" crumbs={[{ label: 'Comms' }]}>
      <AdmPageHead
        title="Broadcasts"
        sub={<>Compose announcements · in-app banners, push, email · 4 sent this week · last <span className="mono">2h ago</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary" onClick={() => setTab('history')}>History</button>
          <button className="adm-btn adm-btn-primary" onClick={() => setTab('compose')}><AdmIcon name="plus" size={12} />New broadcast</button>
        </>}
      />

      {tab === 'compose' && (
        <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:20,alignItems:'start'}}>
          {/* Compose */}
          <div className="adm-card">
            <div className="adm-card-head">
              <div className="adm-card-icon"><AdmIcon name="newspaper" size={14} /></div>
              <h3 className="adm-card-title">Compose</h3>
              <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-tertiary)'}}>draft · auto-saved 14:24</span>
            </div>

            <div style={{display:'grid',gap:14}}>
              <div>
                <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Title</label>
                <input defaultValue="PredictIt maintenance window — Apr 30, 22:00 UTC" style={{width:'100%',padding:'9px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontFamily:'Geist, sans-serif',fontSize:13,color:'var(--text-primary)',outline:'none'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Body · markdown ok</label>
                <textarea rows={7} defaultValue={`Heads up — PredictIt has scheduled maintenance from 22:00–22:30 UTC tonight.\n\nDuring the window:\n• Live order routing to PredictIt will pause.\n• Open exposure will be re-routed to Polymarket / Kalshi automatically.\n• Sentiment, market data, and backtests are unaffected.\n\nWe'll lift this banner once PredictIt is healthy. Track status: status.polyforge.app`} style={{width:'100%',padding:'10px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontFamily:'Geist, sans-serif',fontSize:12.5,color:'var(--text-primary)',outline:'none',resize:'vertical',lineHeight:1.6}} />
              </div>

              <div>
                <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:8}}>Channels</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    { k: 'banner', name: 'In-app banner', sub: 'Shown on next page load · dismissable',  ic: 'bell' },
                    { k: 'push',   name: 'Push notification', sub: 'iOS + Android · ~3,420 devices',     ic: 'zap' },
                    { k: 'email',  name: 'Email', sub: '8,164 recipients matching audience',              ic: 'message' },
                    { k: 'sys',    name: 'System message', sub: 'Persisted in /messages tab',             ic: 'newspaper' },
                  ].map(c => {
                    const on = channels[c.k];
                    return (
                      <button key={c.k} onClick={() => setChannels({...channels, [c.k]: !on})} style={{textAlign:'left',padding:11,borderRadius:7,border:`1px solid ${on ? 'var(--accent-default)' : 'var(--border-subtle)'}`,background: on ? 'color-mix(in srgb, var(--accent-default) 8%, transparent)' : 'var(--bg-elevated)',cursor:'pointer',display:'flex',gap:10,alignItems:'flex-start'}}>
                        <div style={{width:24,height:24,borderRadius:5,background: on ? 'var(--accent-default)' : 'var(--bg-surface)',display:'grid',placeItems:'center',color: on ? '#fff' : 'var(--text-secondary)',flexShrink:0,marginTop:1}}><AdmIcon name={c.ic} size={12} /></div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{c.name}</div>
                          <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{c.sub}</div>
                        </div>
                        {on && <div style={{width:14,height:14,borderRadius:3,background:'var(--accent-default)',display:'grid',placeItems:'center',color:'#fff',marginTop:2}}><AdmIcon name="check" size={9} /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Severity</label>
                  <select defaultValue="info" style={{width:'100%',padding:'8px 10px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontSize:12,color:'var(--text-primary)',outline:'none'}}>
                    <option>info</option><option>warning</option><option>critical</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Send</label>
                  <select defaultValue="now" style={{width:'100%',padding:'8px 10px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontSize:12,color:'var(--text-primary)',outline:'none'}}>
                    <option value="now">Now</option><option>Schedule…</option><option>2024-04-30 21:50 UTC</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:6}}>Auto-dismiss after</label>
                  <select defaultValue="48h" style={{width:'100%',padding:'8px 10px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:6,fontSize:12,color:'var(--text-primary)',outline:'none'}}>
                    <option>1h</option><option>24h</option><option>48h</option><option>7d</option><option>Never</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:8,marginTop:18,paddingTop:14,borderTop:'1px solid var(--border-subtle)'}}>
              <button className="adm-btn adm-btn-secondary"><AdmIcon name="bot" size={12} />Tone check</button>
              <button className="adm-btn adm-btn-secondary">Test send to me</button>
              <button className="adm-btn adm-btn-secondary">Save draft</button>
              <div style={{flex:1}} />
              <button className="adm-btn adm-btn-primary"><AdmIcon name="zap" size={12} />Send to ~2,266 users</button>
            </div>
          </div>

          {/* Sidebar: audience + preview */}
          <div style={{display:'flex',flexDirection:'column',gap:14,position:'sticky',top:72}}>
            <div className="adm-card">
              <div className="adm-card-head">
                <div className="adm-card-icon is-info"><AdmIcon name="users" size={14} /></div>
                <h3 className="adm-card-title">Audience</h3>
              </div>
              {[
                { k: 'all',         label: 'All users',                  count: 8164 },
                { k: 'active30',    label: 'Active in last 30d',         count: 6420 },
                { k: 'paying',      label: 'Paying customers',           count: 2274 },
                { k: 'pro_quant',   label: 'Pro + Quant + Enterprise',   count: 1034 },
                { k: 'predictit_users', label: 'Linked PredictIt account',  count: 1248 },
                { k: 'live_now',    label: 'Live trading right now',     count: 142 },
              ].map(a => {
                const on = aud === a.k;
                return (
                  <label key={a.k} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 6px',borderRadius:5,cursor:'pointer',background: on ? 'color-mix(in srgb, var(--accent-default) 8%, transparent)' : 'transparent'}}>
                    <input type="radio" name="aud" checked={on} onChange={() => setAud(a.k)} style={{accentColor:'var(--accent-default)'}} />
                    <span style={{fontSize:12,color:'var(--text-primary)',flex:1}}>{a.label}</span>
                    <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-tertiary)'}}>{a.count.toLocaleString()}</span>
                  </label>
                );
              })}
              <button style={{width:'100%',marginTop:8,padding:'7px 10px',fontSize:11,background:'var(--bg-elevated)',border:'1px dashed var(--border-default)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer'}}>+ Custom segment…</button>
              <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border-subtle)',fontSize:11,color:'var(--text-secondary)',lineHeight:1.6}}>
                Estimated reach: <span style={{fontFamily:'Geist Mono, monospace',color:'var(--accent-text)',fontWeight:600}}>~2,266</span> users<br />
                Push-eligible: <span className="mono">1,820</span> · email: <span className="mono">2,266</span>
              </div>
            </div>

            <div className="adm-card">
              <div className="adm-card-head">
                <div className="adm-card-icon"><AdmIcon name="bell" size={14} /></div>
                <h3 className="adm-card-title">Preview · in-app banner</h3>
              </div>
              <div style={{padding:14,background:'#1A1A1A',borderRadius:8,border:'1px solid var(--border-subtle)'}}>
                <div style={{padding:11,background:'color-mix(in srgb, var(--info) 15%, var(--bg-elevated))',border:'1px solid color-mix(in srgb, var(--info) 50%, var(--border-default))',borderRadius:6,display:'flex',gap:10}}>
                  <AdmIcon name="bell" size={14} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',marginBottom:3}}>PredictIt maintenance window — Apr 30, 22:00 UTC</div>
                    <div style={{fontSize:11,color:'var(--text-secondary)',lineHeight:1.5}}>Order routing to PredictIt will pause from 22:00–22:30 UTC. Open exposure moves to Polymarket / Kalshi fallback. Sentiment, data, backtests unaffected.</div>
                  </div>
                  <button style={{background:'transparent',border:'none',color:'var(--text-tertiary)',cursor:'pointer',padding:0}}><AdmIcon name="circle-x" size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Channels</th>
                <th>Audience</th>
                <th className="col-num">Reached</th>
                <th className="col-num">Open / dismiss</th>
                <th>Sent by</th>
                <th>Sent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: 'Sentiment scoring v3.1 — improved $SOL coverage',  sev: 'info',  ch: ['banner','sys'], aud: 'All users',   reach: 7980, opn: '64%', dis: '4%',  by: 'arianne.dev', sent: '2h ago' },
                { t: 'Maintenance: 02:00 UTC, ~10 min',                   sev: 'warn',  ch: ['banner','push','email'], aud: 'Active in 30d', reach: 6248, opn: '78%', dis: '12%', by: 'priya.io',    sent: '14h ago' },
                { t: 'New: portfolio-level whale alerts (beta)',          sev: 'info',  ch: ['banner','push','email'], aud: 'Pro+Quant+Ent', reach: 1024, opn: '52%', dis: '8%',  by: 'noah.q',     sent: '2d ago' },
                { t: 'Venue cap failover hotfix deployed',               sev: 'crit',  ch: ['banner','sys','email'], aud: 'Linked PredictIt',reach: 1248, opn: '88%', dis: '2%',  by: 'oliver.cho',  sent: '3d ago' },
                { t: 'Marketplace fees reduced from 25% → 20%',           sev: 'info',  ch: ['banner','email'], aud: 'Strategy authors', reach: 412, opn: '94%', dis: '0%',  by: 'maria.f',    sent: '6d ago' },
              ].map((b, i) => (
                <tr key={i}>
                  <td style={{maxWidth:340,fontSize:12.5}}>{b.t}</td>
                  <td>{b.sev === 'crit' ? <AdmPill kind="loss">critical</AdmPill> : b.sev === 'warn' ? <AdmPill kind="warn">warning</AdmPill> : <AdmPill kind="info">info</AdmPill>}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      {b.ch.map(c => <span key={c} className="mono" style={{fontSize:9.5,padding:'1px 5px',background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-secondary)'}}>{c}</span>)}
                    </div>
                  </td>
                  <td className="col-secondary" style={{fontSize:11}}>{b.aud}</td>
                  <td className="col-num">{b.reach.toLocaleString()}</td>
                  <td className="col-num"><span style={{color:'var(--gain-text)'}}>{b.opn}</span> <span style={{color:'var(--text-tertiary)'}}> / {b.dis}</span></td>
                  <td><span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{b.by}</span></td>
                  <td className="col-tertiary" style={{fontSize:11}}>{b.sent}</td>
                  <td className="col-actions"><button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
