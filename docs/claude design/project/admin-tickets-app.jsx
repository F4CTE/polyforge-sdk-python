/* Polyforge — Admin Support tickets list */

const TICKETS = [
  { id: '#4214', subj: 'Live order rejected — insufficient_collateral loop',  user: 'usr_71c2',   plan: 'Pro',        priority: 'p1', state: 'open',     assigned: 'oliver.cho', last: '2m ago',  msgs: 4,  tags: ['orders','collateral'] },
  { id: '#4213', subj: 'Backtest worker timed out at 12% on 5y election dataset',user: 'usr_8a1d', plan: 'Quant',      priority: 'p1', state: 'open',     assigned: 'tess.k',     last: '14m ago', msgs: 6,  tags: ['backtest'] },
  { id: '#4212', subj: 'Whale alert push — silent on iOS 18 lock screen',      user: 'usr_55a3',   plan: 'Pro',        priority: 'p2', state: 'open',     assigned: '—',          last: '38m ago', msgs: 1,  tags: ['mobile','notifications'] },
  { id: '#4211', subj: 'Strategy publish: validation says circular ref',        user: 'usr_92ff',   plan: 'Free',       priority: 'p2', state: 'pending',  assigned: 'maria.f',    last: '1h ago',  msgs: 3,  tags: ['builder'] },
  { id: '#4210', subj: '2FA recovery — lost authenticator',                   user: 'usr_44d8',   plan: 'Starter',    priority: 'p1', state: 'pending',  assigned: 'oliver.cho', last: '2h ago',  msgs: 5,  tags: ['auth','security'] },
  { id: '#4209', subj: 'API key 401 after rotation despite 24h grace',          user: 'arc_142',    plan: 'Enterprise', priority: 'p0', state: 'open',     assigned: 'priya.io',   last: '14m ago', msgs: 8,  tags: ['api','enterprise'] },
  { id: '#4208', subj: 'Marketplace listing rejected · cherry-picked backtest', user: 'usr_4a91',   plan: 'Pro',        priority: 'p2', state: 'pending',  assigned: 'maria.f',    last: '4h ago',  msgs: 2,  tags: ['marketplace','t&s'] },
  { id: '#4207', subj: 'Refund — pro plan auto-renewed after cancel',           user: 'usr_3b22',   plan: 'Pro',        priority: 'p2', state: 'pending',  assigned: 'maria.f',    last: '5h ago',  msgs: 4,  tags: ['billing'] },
  { id: '#4206', subj: 'Sentiment score frozen for SCOTUS-TIKTOK since 14:08', user: 'arc_184',    plan: 'Enterprise', priority: 'p1', state: 'pending',  assigned: 'arianne.dev',last: '6h ago',  msgs: 6,  tags: ['sentiment','enterprise'] },
  { id: '#4205', subj: 'How to express a YES/NO ladder in builder?',            user: 'usr_77c5',   plan: 'Quant',      priority: 'p3', state: 'pending',  assigned: 'tess.k',     last: '8h ago',  msgs: 3,  tags: ['help','builder'] },
  { id: '#4204', subj: 'Webhook delivery 500s after 14:18 deploy',              user: 'usr_8a4f',   plan: 'Pro',        priority: 'p1', state: 'closed',   assigned: 'priya.io',   last: '6h ago',  msgs: 12, tags: ['api','webhooks'] },
  { id: '#4203', subj: 'Mobile widget stuck on connecting…',                    user: 'usr_5b18',   plan: 'Starter',    priority: 'p2', state: 'closed',   assigned: 'oliver.cho', last: '12h ago', msgs: 4,  tags: ['mobile'] },
];

function P({ p }) {
  if (p === 'p0') return <AdmPill kind="loss">P0</AdmPill>;
  if (p === 'p1') return <AdmPill kind="warn">P1</AdmPill>;
  if (p === 'p2') return <AdmPill kind="info">P2</AdmPill>;
  return <AdmPill>{p.toUpperCase()}</AdmPill>;
}
function S({ s }) {
  if (s === 'open')    return <AdmPill kind="warn"><span className="adm-dot is-warn" />open</AdmPill>;
  if (s === 'pending') return <AdmPill kind="info">pending</AdmPill>;
  if (s === 'closed')  return <AdmPill kind="gain">closed</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="tickets" title="Support tickets" crumbs={[{ label: 'Trust & Safety' }]}>
      <AdmPageHead
        title="Support tickets"
        sub={<>{TICKETS.filter(t=>t.state!=='closed').length} open · 1 P0 · SLA breach risk: <span style={{color:'var(--warning)'}}>2 tickets</span> · all channels: email, in-app, X</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="bot" size={12} />Auto-triage rules</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New ticket</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Open" value="10" delta="+2 vs yesterday" deltaKind="warn" icon="message" iconKind="is-warn" />
        <AdmStat label="P0 / P1" value="1 / 4" delta="P0 · enterprise · 14m" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
        <AdmStat label="First-response · median" value="22m" delta="target 30m" deltaKind="gain" icon="clock" iconKind="is-gain" />
        <AdmStat label="CSAT · 30d" value="4.6 / 5" delta="284 surveys · 92% great" deltaKind="gain" icon="check" iconKind="is-gain" />
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="users" size={14} /></div>
            <h3 className="adm-card-title">By assignee · open</h3>
          </div>
          {[
            { u: 'oliver.cho',  open: 4, pending: 2, sla: 92 },
            { u: 'maria.f',     open: 3, pending: 4, sla: 96 },
            { u: 'priya.io',    open: 2, pending: 0, sla: 100 },
            { u: 'tess.k',      open: 1, pending: 1, sla: 88 },
            { u: 'arianne.dev', open: 1, pending: 0, sla: 100 },
            { u: 'unassigned',  open: 1, pending: 0, sla: 0   },
          ].map((r, i) => (
            <div key={r.u} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:11,color: r.u === 'unassigned' ? 'var(--warning)' : 'var(--text-primary)',flex:1,fontWeight: r.u === 'unassigned' ? 600 : 400}}>{r.u}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-tertiary)'}}>{r.open} / {r.pending}</span>
              </div>
              {r.sla > 0 && <div className="adm-bar" style={{height:4}}><span style={{width:`${r.sla}%`,background: r.sla > 95 ? 'var(--gain)' : r.sla > 90 ? 'var(--info)' : 'var(--warning)'}} /></div>}
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="layers" size={14} /></div>
            <h3 className="adm-card-title">By topic · 30d</h3>
          </div>
          {[
            { k: 'orders / fills',   n: 142 },
            { k: 'auth / security',  n: 88 },
            { k: 'billing',          n: 64 },
            { k: 'builder',          n: 54 },
            { k: 'backtest',         n: 38 },
            { k: 'api / webhooks',   n: 24 },
            { k: 'mobile',           n: 22 },
            { k: 'marketplace',      n: 18 },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'7px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:3}}>
                <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{r.n}</span>
              </div>
              <div className="adm-bar" style={{height:4}}><span style={{width:`${r.n*0.6}%`,background:'var(--info)'}} /></div>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-gain"><AdmIcon name="bot" size={14} /></div>
            <h3 className="adm-card-title">Agent deflection · 30d</h3>
          </div>
          <div style={{textAlign:'center',padding:'14px 0'}}>
            <div style={{fontFamily:'Geist Mono, monospace',fontSize:36,fontWeight:600,color:'var(--accent-text)',lineHeight:1}}>62%</div>
            <div style={{fontSize:11,color:'var(--text-tertiary)',marginTop:6}}>queries handled without human</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8}}>
            <div style={{padding:8,background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:9.5,color:'var(--text-tertiary)'}}>Resolved by AI</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:14,fontWeight:600,color:'var(--gain-text)'}}>3,184</div>
            </div>
            <div style={{padding:8,background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:9.5,color:'var(--text-tertiary)'}}>Escalated to human</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>1,948</div>
            </div>
          </div>
          <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginBottom:6}}>Top deflected topics</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {['password reset','plan change','API quickstart','symbol availability','exchange linking','docs lookup'].map(t => (
                <span key={t} style={{fontSize:9.5,padding:'3px 7px',borderRadius:3,background:'var(--bg-elevated)',color:'var(--text-secondary)',fontFamily:'Geist Mono, monospace',border:'1px solid var(--border-subtle)'}}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AdmSectionHead title="Tickets" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search"><AdmIcon name="search" size={13} /><input placeholder="Subject, user, tag, ticket id…" /></div>
          <AdmFilter active count={TICKETS.length}>All</AdmFilter>
          <AdmFilter count={5}>Open</AdmFilter>
          <AdmFilter count={5}>Pending</AdmFilter>
          <AdmFilter count={2}>Closed</AdmFilter>
          <AdmFilter count={1}>P0</AdmFilter>
          <AdmFilter count={4}>P1</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Priority</th>
              <th>State</th>
              <th>Subject</th>
              <th>User</th>
              <th>Plan</th>
              <th>Assigned</th>
              <th className="col-num">Msgs</th>
              <th>Last activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TICKETS.map(t => (
              <tr key={t.id}>
                <td><a href="Admin-Ticket-Detail.html" className="mono" style={{color:'var(--accent-text)',fontWeight:500,fontSize:11.5,textDecoration:'none'}}>{t.id}</a></td>
                <td><P p={t.priority} /></td>
                <td><S s={t.state} /></td>
                <td>
                  <div style={{maxWidth:340,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}}>{t.subj}</div>
                  <div style={{display:'flex',gap:3,marginTop:3}}>
                    {t.tags.map(tag => <span key={tag} style={{fontSize:9.5,padding:'1px 5px',borderRadius:3,background:'var(--bg-elevated)',color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',border:'1px solid var(--border-subtle)'}}>{tag}</span>)}
                  </div>
                </td>
                <td><span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{t.user}</span></td>
                <td><AdmPill kind={t.plan === 'Enterprise' ? 'warn' : t.plan === 'Quant' ? 'gain' : t.plan === 'Pro' ? 'info' : ''}>{t.plan}</AdmPill></td>
                <td>{t.assigned === '—' ? <span style={{color:'var(--warning)',fontSize:11}}>unassigned</span> : <span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{t.assigned}</span>}</td>
                <td className="col-num col-secondary">{t.msgs}</td>
                <td className="col-tertiary" style={{fontSize:11}}>{t.last}</td>
                <td className="col-actions"><button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
