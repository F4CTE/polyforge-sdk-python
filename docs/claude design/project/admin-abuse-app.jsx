/* Polyforge — Admin Abuse queue
   T&S triage: manipulative strategies, account abuse, content reports */

const CASES = [
  { id: 'AB-2014', kind: 'strategy_abuse',  pattern: 'rumor_frontrun',    subject: 'usr_4a91 / rumor-fader-pre',evidence: 'mean tweet→fill: 4.2s · 38 markets · win rate 92%', priority: 'p0', state: 'open',     assigned: 'oliver.cho', age: '2h',  signals: 14 },
  { id: 'AB-2013', kind: 'strategy_abuse',  pattern: 'wash_trade',        subject: 'usr_8a4f / multiple',       evidence: '3 accounts · same KYC · self-trade 84%',                  priority: 'p0', state: 'open',     assigned: 'oliver.cho', age: '4h',  signals: 22 },
  { id: 'AB-2012', kind: 'account_abuse',   pattern: 'multi_account',     subject: 'usr_72c1 + 4 linked',       evidence: 'shared device · IP cluster · referral chain',             priority: 'p1', state: 'open',     assigned: 'maria.f',    age: '8h',  signals: 8 },
  { id: 'AB-2011', kind: 'content_report',  pattern: 'misleading_returns',subject: 'lst_4f26 · rumor-fader-pre',evidence: 'description claims 92% win · backtest cherry-picked 7d',  priority: 'p1', state: 'review',   assigned: 'maria.f',    age: '12h', signals: 4 },
  { id: 'AB-2010', kind: 'strategy_abuse',  pattern: 'spoof_layer',       subject: 'usr_5b18 / book-imbalance',  evidence: 'cancel rate 94% · large orders @ ±0.4¢',                priority: 'p2', state: 'review',   assigned: 'oliver.cho', age: '1d',  signals: 6 },
  { id: 'AB-2009', kind: 'account_abuse',   pattern: 'kyc_mismatch',      subject: 'usr_92ff',                  evidence: 'doc face score 0.42 · selfie liveness fail · 3rd attempt',priority: 'p2', state: 'review',   assigned: 'maria.f',    age: '1d',  signals: 3 },
  { id: 'AB-2008', kind: 'content_report',  pattern: 'impersonation',     subject: 'usr_yamamoto_alt',          evidence: 'username similar to k. yamamoto · marketed clone strategy',priority: 'p2', state: 'open',     assigned: '—',          age: '2d',  signals: 2 },
  { id: 'AB-2007', kind: 'strategy_abuse',  pattern: 'resolution_gaming', subject: 'usr_dmitri.q',              evidence: 'coordinated activity to bias UMA oracle vote on 2 markets',priority:'p1',state: 'closed',  assigned: 'oliver.cho', age: '3d',  signals: 12, resolution: 'banned' },
  { id: 'AB-2006', kind: 'content_report',  pattern: 'spam_dms',          subject: 'usr_anon_2814',             evidence: 'sent 142 referral DMs / hour to non-followers',           priority: 'p2', state: 'closed',   assigned: 'maria.f',    age: '4d',  signals: 1, resolution: 'rate_limited' },
];

function P({ p }) {
  if (p === 'p0') return <AdmPill kind="loss">P0</AdmPill>;
  if (p === 'p1') return <AdmPill kind="warn">P1</AdmPill>;
  if (p === 'p2') return <AdmPill kind="info">P2</AdmPill>;
  return <AdmPill>{p}</AdmPill>;
}
function St({ s }) {
  if (s === 'open')   return <AdmPill kind="warn">OPEN</AdmPill>;
  if (s === 'review') return <AdmPill kind="info">IN REVIEW</AdmPill>;
  if (s === 'closed') return <AdmPill kind="gain">RESOLVED</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}
function K({ k }) {
  const map = { strategy_abuse: 'strategy', account_abuse: 'account', content_report: 'content' };
  return <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{map[k]}</span>;
}

function App() {
  return (
    <AdmShell active="abuse" title="Abuse queue" crumbs={[{ label: 'Trust & Safety' }]}>
      <AdmPageHead
        title="Abuse queue"
        sub={<>23 open cases · auto-detected by 14 signal pipelines · feeds into Risk flags + Approvals</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Detection rules</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />File case</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Open · P0" value="2" delta="< 4h SLA" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
        <AdmStat label="Open · P1+P2" value="21" delta="−4 from yesterday" deltaKind="gain" icon="flag" iconKind="is-warn" />
        <AdmStat label="Auto-actioned · 24h" value="142" delta="rate-limit · 84 · soft-ban · 22" icon="bot" iconKind="is-info" />
        <AdmStat label="Avg time to close" value="14h" delta="P0 · 2h · P2 · 38h" icon="clock" iconKind="is-info" />
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-loss"><AdmIcon name="shield-alert" size={14} /></div>
            <h3 className="adm-card-title">Top patterns · 30d</h3>
          </div>
          {[
            { k: 'rumor_frontrun',    n: 38, c: 'var(--loss)' },
            { k: 'wash_trade',        n: 24, c: 'var(--loss)' },
            { k: 'multi_account',     n: 18, c: 'var(--warning)' },
            { k: 'spoof_layer',       n: 14, c: 'var(--warning)' },
            { k: 'misleading_returns',n: 12, c: 'var(--warning)' },
            { k: 'kyc_mismatch',      n: 9,  c: 'var(--info)' },
            { k: 'spam_dms',          n: 84, c: 'var(--text-tertiary)' },
            { k: 'impersonation',     n: 4,  c: 'var(--text-tertiary)' },
          ].map((p, i) => (
            <div key={p.k} style={{padding:'7px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:11,color:'var(--text-primary)',flex:1}}>{p.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:p.c,fontWeight:600}}>{p.n}</span>
              </div>
              <div className="adm-bar"><span style={{width:`${Math.min(p.n*2.4, 100)}%`,background:p.c}} /></div>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-warn"><AdmIcon name="bot" size={14} /></div>
            <h3 className="adm-card-title">Auto-actions · 24h</h3>
          </div>
          {[
            { k: 'rate_limited',     n: 84, kind: 'reversible'  },
            { k: 'soft_banned',      n: 22, kind: 'reversible'  },
            { k: 'kyc_re-required',  n: 18, kind: 'reversible'  },
            { k: 'strategy_paused',  n: 8,  kind: 'reversible'  },
            { k: 'withdrawal_held',  n: 6,  kind: 'reversible'  },
            { k: 'session_killed',   n: 4,  kind: 'reversible'  },
          ].map((a, i) => (
            <div key={a.k} style={{padding:'10px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:8}}>
              <span className="mono" style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{a.k}</span>
              <span style={{fontSize:10,color:'var(--text-tertiary)',fontStyle:'italic'}}>{a.kind}</span>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--accent-text)',fontWeight:600,minWidth:30,textAlign:'right'}}>{a.n}</span>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="users" size={14} /></div>
            <h3 className="adm-card-title">Reviewer load · this week</h3>
          </div>
          {[
            { name: 'Oliver Cho',       open: 8,  closed: 22, sla: 92 },
            { name: 'Maria Fernandes',  open: 6,  closed: 18, sla: 96 },
            { name: 'Priya Iyengar',    open: 2,  closed: 4,  sla: 100 },
            { name: 'Tess Karadzic',    open: 4,  closed: 12, sla: 88 },
            { name: 'Unassigned',       open: 3,  closed: 0,  sla: 0  },
          ].map((r, i) => (
            <div key={r.name} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11.5,color: r.name === 'Unassigned' ? 'var(--warning)' : 'var(--text-primary)',fontWeight: r.name === 'Unassigned' ? 600 : 400,flex:1}}>{r.name}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)'}}>{r.open} open · {r.closed} closed</span>
              </div>
              {r.sla > 0 && <div className="adm-bar" style={{height:5}}><span style={{width:`${r.sla}%`,background: r.sla > 95 ? 'var(--gain)' : r.sla > 90 ? 'var(--info)' : 'var(--warning)'}} /></div>}
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Cases" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Case, user, pattern, signal…" />
          </div>
          <AdmFilter active count="23">Open</AdmFilter>
          <AdmFilter count="2">P0</AdmFilter>
          <AdmFilter count="9">P1</AdmFilter>
          <AdmFilter count="12">P2</AdmFilter>
          <AdmFilter count="38">Closed · 30d</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Priority</th>
              <th>State</th>
              <th>Pattern</th>
              <th>Subject</th>
              <th>Evidence</th>
              <th className="col-num">Signals</th>
              <th>Assigned</th>
              <th>Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {CASES.map(c => (
              <tr key={c.id}>
                <td>
                  <span className="mono" style={{color:'var(--accent-text)',fontSize:11.5,fontWeight:500}}>{c.id}</span>
                  <div style={{marginTop:2}}><K k={c.kind} /></div>
                </td>
                <td><P p={c.priority} /></td>
                <td><St s={c.state} /></td>
                <td className="mono" style={{fontSize:11,color:'var(--text-primary)'}}>{c.pattern}</td>
                <td><span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{c.subject}</span></td>
                <td style={{fontSize:11,color:'var(--text-secondary)',maxWidth:280}}>{c.evidence}</td>
                <td className="col-num" style={{color: c.signals > 10 ? 'var(--loss-text)' : 'var(--text-secondary)',fontWeight: c.signals > 10 ? 600 : 400}}>{c.signals}</td>
                <td>{c.assigned === '—' ? <span style={{color:'var(--warning)',fontSize:11}}>unassigned</span> : <span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{c.assigned}</span>}</td>
                <td className="col-tertiary" style={{fontSize:11}}>{c.age}{c.resolution && <div style={{fontSize:10,color:'var(--gain-text)',marginTop:2}}>{c.resolution}</div>}</td>
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
