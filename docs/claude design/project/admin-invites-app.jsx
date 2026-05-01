/* Polyforge — Admin Invites
   Beta invite codes, referral chains, attribution */

const CODES = [
  { code: 'POLYBETA',     owner: '—',           kind: 'public', uses: 8420, cap: 10000, conv: 0.42, mrr: '$22.4K', exp: '2024-12-31', state: 'active' },
  { code: 'YAMAMOTO50',   owner: 'k. yamamoto', kind: 'creator',uses: 412,  cap: 500,   conv: 0.68, mrr: '$8.4K',  exp: '∞',          state: 'active' },
  { code: 'ARIANNE',      owner: 'arianne.dev', kind: 'creator',uses: 184,  cap: 500,   conv: 0.54, mrr: '$2.4K',  exp: '∞',          state: 'active' },
  { code: 'TPGCAP',       owner: 'priya.io',    kind: 'partner',uses: 38,   cap: 50,    conv: 0.92, mrr: '$8.4K',  exp: '2024-06-30', state: 'active' },
  { code: 'POLYCHAIN',    owner: 'priya.io',    kind: 'partner',uses: 14,   cap: 100,   conv: 0.78, mrr: '$3.2K',  exp: '2024-09-30', state: 'active' },
  { code: 'STRATOS22',    owner: 'priya.io',    kind: 'partner',uses: 12,   cap: 25,    conv: 0.84, mrr: '$4.2K',  exp: '2024-12-31', state: 'active' },
  { code: 'HACKERNEWS',   owner: 'growth',      kind: 'public', uses: 3284, cap: 5000,  conv: 0.18, mrr: '$1.8K',  exp: '2024-04-30', state: 'active' },
  { code: 'PRODUCTHUNT',  owner: 'growth',      kind: 'public', uses: 1842, cap: 3000,  conv: 0.14, mrr: '$0.8K',  exp: '2024-04-30', state: 'expiring' },
  { code: 'EARLYBIRD',    owner: 'growth',      kind: 'public', uses: 4820, cap: 4820,  conv: 0.34, mrr: '$11.4K', exp: 'reached',    state: 'exhausted' },
  { code: 'TWITTER22',    owner: 'growth',      kind: 'public', uses: 184,  cap: 500,   conv: 0.04, mrr: '$0.0K',  exp: '2024-05-22', state: 'paused' },
];

function K({ k }) {
  if (k === 'public')  return <AdmPill kind="info">public</AdmPill>;
  if (k === 'creator') return <AdmPill kind="gain">creator</AdmPill>;
  if (k === 'partner') return <AdmPill kind="warn">partner</AdmPill>;
  return <AdmPill>{k}</AdmPill>;
}
function S({ s }) {
  if (s === 'active')    return <AdmPill kind="gain"><span className="adm-dot is-gain" />active</AdmPill>;
  if (s === 'expiring')  return <AdmPill kind="warn">expiring</AdmPill>;
  if (s === 'exhausted') return <AdmPill kind="loss">exhausted</AdmPill>;
  if (s === 'paused')    return <AdmPill kind="loss">paused</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="invites" title="Invites & referrals" crumbs={[{ label: 'Overview' }]}>
      <AdmPageHead
        title="Invites & referrals"
        sub={<>10 active codes · 19,210 redemptions all-time · attribution to MRR <span className="mono" style={{color:'var(--text-secondary)'}}>$62.6K</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />30 days</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New code</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Redemptions · 30d" value="2,841" delta="+22% MoM" deltaKind="gain" icon="ticket" iconKind="is-gain" />
        <AdmStat label="Avg conversion" value="34%" delta="creators 68% · public 22%" deltaKind="gain" icon="check" iconKind="is-info" />
        <AdmStat label="MRR attributed" value="$62.6K" delta="34% of total MRR" deltaKind="gain" icon="cash" iconKind="is-gain" />
        <AdmStat label="Top referrer" value="k. yamamoto" delta="412 invites · $8.4K MRR" icon="users" iconKind="is-info" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">Redemptions · 30d</h3>
          </div>
          <svg viewBox="0 0 600 240" preserveAspectRatio="none" style={{width:'100%',flex:1,minHeight:200}}>
            {[40,100,160,200].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            {Array.from({length:30}).map((_, i) => {
              const h = 28 + Math.sin(i*0.4)*44 + Math.random()*60 + (i > 18 ? 36 : 0);
              return <rect key={i} x={i*20+2} y={210-h} width="14" height={h} fill="var(--accent-default)" rx="1.5" />;
            })}
            <text x="0"  y="232" fontSize="10" fill="var(--text-tertiary)" fontFamily="Geist Mono, monospace">−30d</text>
            <text x="280" y="232" fontSize="10" fill="var(--text-tertiary)" fontFamily="Geist Mono, monospace">−15d</text>
            <text x="580" y="232" fontSize="10" fill="var(--text-tertiary)" fontFamily="Geist Mono, monospace" textAnchor="end">today</text>
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:12,paddingTop:12,borderTop:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontSize:11}}>
            <div><span style={{color:'var(--text-tertiary)'}}>peak day</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>284</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>avg</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>95/day</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>conversion</span> <span style={{color:'var(--gain-text)',fontWeight:600,marginLeft:4}}>34%</span></div>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-gain"><AdmIcon name="users" size={14} /></div>
            <h3 className="adm-card-title">Top referrers · all-time</h3>
          </div>
          {[
            { u: 'k. yamamoto',  invites: 412, conv: 280, mrr: '$8.4K' },
            { u: 'arianne.dev',  invites: 184, conv: 99,  mrr: '$2.4K' },
            { u: 'maria.f',      invites: 142, conv: 84,  mrr: '$1.2K' },
            { u: 'tess.k',       invites: 88,  conv: 54,  mrr: '$0.8K' },
            { u: 'priya.io',     invites: 64,  conv: 49,  mrr: '$15.4K' },
            { u: 'noah.q',       invites: 38,  conv: 22,  mrr: '$0.4K' },
          ].map((r, i) => (
            <div key={r.u} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:'var(--bg-elevated)',display:'grid',placeItems:'center',fontSize:10,fontWeight:600,color:'var(--accent-text)'}}>{i+1}</div>
              <div style={{flex:1}}>
                <div className="mono" style={{fontSize:11.5,color:'var(--text-primary)',fontWeight:500}}>{r.u}</div>
                <div style={{fontSize:10,color:'var(--text-tertiary)'}}>{r.invites} invites · {r.conv} conv · {Math.round(r.conv/r.invites*100)}%</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'Geist Mono, monospace',fontSize:12,color:'var(--gain-text)',fontWeight:600}}>{r.mrr}</div>
                <div style={{fontSize:10,color:'var(--text-tertiary)'}}>MRR</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Invite codes" />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Kind</th>
              <th>State</th>
              <th>Owner</th>
              <th>Expires</th>
              <th className="col-num">Uses / cap</th>
              <th className="col-num">Conversion</th>
              <th className="col-num">MRR attrib.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {CODES.map(c => (
              <tr key={c.code}>
                <td><span className="mono" style={{fontWeight:600,color:'var(--accent-text)'}}>{c.code}</span></td>
                <td><K k={c.kind} /></td>
                <td><S s={c.state} /></td>
                <td>{c.owner === '—' ? <span style={{color:'var(--text-tertiary)'}}>—</span> : <span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{c.owner}</span>}</td>
                <td className="col-tertiary" style={{fontSize:11}}>{c.exp}</td>
                <td className="col-num">
                  <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                    <div className="adm-bar" style={{width:60}}><span style={{width:`${(c.uses/c.cap)*100}%`,background: c.uses/c.cap > 0.9 ? 'var(--warning)' : 'var(--accent-default)'}} /></div>
                    <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,minWidth:90,textAlign:'right'}}>{c.uses.toLocaleString()} / {c.cap.toLocaleString()}</span>
                  </div>
                </td>
                <td className="col-num" style={{color: c.conv > 0.5 ? 'var(--gain-text)' : c.conv > 0.3 ? 'var(--text-secondary)' : 'var(--warning)',fontWeight:600}}>{(c.conv*100).toFixed(0)}%</td>
                <td className="col-num">{c.mrr}</td>
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
