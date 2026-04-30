/* Polyforge — Admin team management */

const ADMINS = [
  { id: 'adm_01', name: 'Maya Chen',         email: 'maya@polyforge.io',     role: 'Root',         twofa: 'Yubikey', last: 'now',      ip: '198.51.100.4', sessions: 2, joined: 'Aug 2023', actions7d: 184, you: true },
  { id: 'adm_02', name: 'Kenji Tanaka',      email: 'kenji@polyforge.io',    role: 'Compliance',   twofa: 'TOTP',    last: '4m ago',   ip: '198.51.100.7', sessions: 1, joined: 'Sep 2023', actions7d: 142 },
  { id: 'adm_03', name: 'Aria Patel',        email: 'aria@polyforge.io',     role: 'Trust & Safety', twofa: 'Yubikey', last: '12m ago', ip: '203.0.113.18', sessions: 1, joined: 'Nov 2023', actions7d: 98 },
  { id: 'adm_04', name: 'Sven Volkov',       email: 'sven@polyforge.io',     role: 'Engineering',  twofa: 'Yubikey', last: '1h ago',   ip: '198.51.100.11', sessions: 3, joined: 'Aug 2023', actions7d: 67 },
  { id: 'adm_05', name: 'Linnea Bergquist',  email: 'linnea@polyforge.io',   role: 'Support',      twofa: 'TOTP',    last: '2h ago',   ip: '198.51.100.4', sessions: 1, joined: 'Feb 2024', actions7d: 312 },
  { id: 'adm_06', name: 'Owen Mbeki',        email: 'owen@polyforge.io',     role: 'Support',      twofa: 'TOTP',    last: '6h ago',   ip: '203.0.113.22', sessions: 0, joined: 'May 2024', actions7d: 248 },
  { id: 'adm_07', name: 'Chiara Rossi',      email: 'chiara@polyforge.io',   role: 'Finance',      twofa: 'TOTP',    last: '1d ago',   ip: '198.51.100.4', sessions: 0, joined: 'Mar 2024', actions7d: 41 },
  { id: 'adm_08', name: 'Diego Silva',       email: 'diego@polyforge.io',    role: 'Read-only',    twofa: 'Email',   last: '4d ago',   ip: '203.0.113.40', sessions: 0, joined: 'Jan 2025', actions7d: 0, weak: true },
];

const ROLES = [
  { name: 'Root',           desc: 'Full access including admin team & infra', count: 1, perms: ['users:*','finance:*','infra:*','admin:*'], color: 'loss' },
  { name: 'Compliance',     desc: 'KYC, sanctions, account suspension',       count: 1, perms: ['users:read','approvals:*','flags:*','reports:read'], color: 'info' },
  { name: 'Trust & Safety', desc: 'Risk flags, abuse queue, broadcasts',      count: 1, perms: ['users:read','flags:*','abuse:*','broadcasts:*'], color: 'warn' },
  { name: 'Engineering',    desc: 'Infra, feature flags, audit log',          count: 1, perms: ['health:*','config:*','logs:read','venues:*'], color: 'accent' },
  { name: 'Support',        desc: 'Tickets, basic user actions, refunds',     count: 2, perms: ['users:read','tickets:*','refunds:write'], color: '' },
  { name: 'Finance',        desc: 'Revenue, billing, invoices, refunds',      count: 1, perms: ['revenue:*','billing:*','refunds:*'], color: 'gain' },
  { name: 'Read-only',      desc: 'View-only across all surfaces',            count: 1, perms: ['*:read'], color: '' },
];

const RECENT_ACTIONS = [
  { t: '00:02:14', who: 'Maya Chen',        action: 'suspended',   target: <span className="mono">usr_4a91</span>, reason: 'wash trading' },
  { t: '00:08:42', who: 'Kenji Tanaka',     action: 'approved KYC tier 3 for', target: <span className="mono">usr_71c2</span>, reason: '' },
  { t: '00:14:18', who: 'Aria Patel',       action: 'closed flag', target: <span className="mono">flg_882a</span>, reason: 'false positive' },
  { t: '00:22:09', who: 'Linnea Bergquist', action: 'refunded',    target: '$199.00', reason: 'tkt_4187' },
  { t: '00:38:51', who: 'Sven Volkov',      action: 'rolled feature flag', target: <span className="mono">use_v2_orderbook</span>, reason: '25% → 50%' },
  { t: '01:04:22', who: 'Maya Chen',        action: 'invited',     target: <span className="mono">finance@…</span>, reason: 'role: Finance' },
];

const ROLE_TONE = { Root: 'loss', Compliance: 'info', 'Trust & Safety': 'warn', Engineering: 'accent', Support: '', Finance: 'gain', 'Read-only': '' };

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <AdmShell active="admins" title="Admin team" crumbs={[{ label: 'People' }]} actions={
      <button className="adm-btn adm-btn-primary" onClick={()=>setDrawerOpen(true)}><AdmIcon name="plus" size={12} />Invite admin</button>
    }>
      <AdmPageHead
        title="Admin team"
        sub={<>{ADMINS.length} members across 7 roles · all activity logged to <a href="Admin-Logs.html" style={{color:'var(--accent-text)'}}>audit</a></>}
      />

      {/* Stats */}
      <div className="adm-stat-grid">
        <AdmStat label="Total admins" value="8" delta="+1 this month" deltaKind="gain" icon="lock" iconKind="is-info" />
        <AdmStat label="Active sessions" value="8" delta="across 5 admins" icon="server" />
        <AdmStat label="Yubikey enrolled" value="3 / 8" delta="63% need upgrade" deltaKind="loss" icon="shield-check" iconKind="is-warn" />
        <AdmStat label="Actions · 24h" value="1,092" delta="+18% vs avg" deltaKind="gain" icon="activity" />
      </div>

      <div className="adm-grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        {/* Admins table */}
        <div>
          <AdmSectionHead title="Admins" />
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>2FA</th>
                  <th className="col-num">Actions · 7d</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ADMINS.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AdmAvatar name={a.name} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {a.name}
                            {a.you && <span style={{fontSize:9,fontFamily:'Geist Mono, monospace',background:'var(--accent-subtle)',color:'var(--accent-text)',padding:'1px 5px',borderRadius:3,fontWeight:700,letterSpacing:'0.08em'}}>YOU</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><AdmPill kind={ROLE_TONE[a.role]}>{a.role}</AdmPill></td>
                    <td>
                      {a.twofa === 'Yubikey' && <span style={{fontSize:11.5,color:'var(--gain-text)',display:'inline-flex',alignItems:'center',gap:4}}><AdmIcon name="shield-check" size={12} />Yubikey</span>}
                      {a.twofa === 'TOTP' && <span style={{fontSize:11.5,color:'var(--text-secondary)',display:'inline-flex',alignItems:'center',gap:4}}><AdmIcon name="lock" size={12} />TOTP</span>}
                      {a.twofa === 'Email' && <span style={{fontSize:11.5,color:'var(--warning)',display:'inline-flex',alignItems:'center',gap:4}} title="Weak — upgrade required"><AdmIcon name="alert" size={12} />Email</span>}
                    </td>
                    <td className="col-num">{a.actions7d.toLocaleString()}</td>
                    <td className="col-mono col-tertiary">
                      {a.last}
                      <div style={{fontSize:10,marginTop:1}}>{a.ip}</div>
                    </td>
                    <td style={{ width: 32 }}><button className="row-action"><AdmIcon name="more" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent admin actions */}
          <AdmSectionHead title="Recent admin actions" action={<a href="Admin-Logs.html" style={{fontSize:11,color:'var(--accent-text)',textDecoration:'none'}}>Full audit log →</a>} />
          <div className="adm-card" style={{padding:0}}>
            {RECENT_ACTIONS.map((r, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom: i < RECENT_ACTIONS.length-1 ? '1px solid var(--border-subtle)' : 'none'}}>
                <AdmAvatar name={r.who} />
                <div style={{flex:1,minWidth:0,fontSize:12.5,color:'var(--text-secondary)'}}>
                  <span style={{color:'var(--text-primary)',fontWeight:500}}>{r.who}</span>{' '}{r.action}{' '}{r.target}
                  {r.reason && <span style={{color:'var(--text-tertiary)',marginLeft:6,fontFamily:'Geist Mono, monospace',fontSize:11}}>· {r.reason}</span>}
                </div>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)'}}>{r.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Roles */}
        <div>
          <AdmSectionHead title="Roles & permissions" action={<button className="adm-btn adm-btn-sm adm-btn-ghost"><AdmIcon name="plus" size={11} />Custom role</button>} />
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {ROLES.map((r) => (
              <div key={r.name} className="adm-card" style={{padding:14}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <AdmPill kind={r.color}>{r.name}</AdmPill>
                  <span style={{fontSize:11,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>{r.count} {r.count === 1 ? 'member' : 'members'}</span>
                  <button className="row-action" style={{marginLeft:'auto'}}><AdmIcon name="edit" size={12} /></button>
                </div>
                <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8,lineHeight:1.4}}>{r.desc}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {r.perms.map((p) => (
                    <span key={p} className="mono" style={{fontSize:10,padding:'2px 6px',background:'var(--bg-app)',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-tertiary)'}}>{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite drawer */}
      <div className={`adm-drawer-scrim${drawerOpen ? ' is-open' : ''}`} onClick={()=>setDrawerOpen(false)} />
      <div className={`adm-drawer${drawerOpen ? ' is-open' : ''}`}>
        <div className="adm-drawer-head">
          <div className="adm-card-icon"><AdmIcon name="mail" size={14} /></div>
          <h3 className="adm-drawer-title">Invite admin</h3>
          <button className="adm-icon-btn" style={{marginLeft:'auto'}} onClick={()=>setDrawerOpen(false)}><AdmIcon name="x" size={13} /></button>
        </div>
        <div className="adm-drawer-body">
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.04em',textTransform:'uppercase',display:'block',marginBottom:6}}>Email</label>
            <input type="email" placeholder="name@polyforge.io" style={{width:'100%',background:'var(--bg-app)',border:'1px solid var(--border-default)',borderRadius:6,padding:'10px 12px',color:'var(--text-primary)',fontSize:13,fontFamily:'inherit'}} />
            <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:4}}>Must be on @polyforge.io · Google SSO required</div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.04em',textTransform:'uppercase',display:'block',marginBottom:6}}>Role</label>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {ROLES.filter(r => r.name !== 'Root').map((r, i) => (
                <label key={r.name} style={{display:'flex',alignItems:'center',gap:10,padding:10,border:'1px solid var(--border-subtle)',borderRadius:8,cursor:'pointer',background: i === 1 ? 'var(--accent-subtle)' : 'transparent', borderColor: i === 1 ? 'var(--accent-border)' : 'var(--border-subtle)'}}>
                  <input type="radio" name="role" defaultChecked={i === 1} style={{accentColor:'var(--accent-default)'}} />
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                      <AdmPill kind={r.color}>{r.name}</AdmPill>
                    </div>
                    <div style={{fontSize:11.5,color:'var(--text-tertiary)'}}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{marginBottom:14,padding:12,background:'var(--bg-app)',border:'1px solid var(--border-subtle)',borderRadius:8}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--text-primary)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              <AdmIcon name="shield-check" size={12} /> Required of every admin
            </div>
            {[
              'Hardware key (Yubikey) for 2FA',
              'IP allow-list enforced for /admin',
              'Session expires after 12h idle',
              'All actions logged to immutable audit',
            ].map((t) => (
              <div key={t} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',fontSize:11.5,color:'var(--text-secondary)'}}>
                <AdmIcon name="check" size={11} />{t}
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:8}}>
            <button className="adm-btn adm-btn-ghost" style={{flex:1}} onClick={()=>setDrawerOpen(false)}>Cancel</button>
            <button className="adm-btn adm-btn-primary" style={{flex:1}}><AdmIcon name="mail" size={12} />Send invite</button>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
