/* Polyforge — Admin Feature flags / Config
   Toggle features per cohort, gradual rollouts, kill switches */

const FLAGS = [
  { key: 'agent_v3',                 label: 'Agent · v3 model',         desc: 'Switch agent gateway to anthropic-haiku-4-5', kind: 'rollout', val: 100, prev: 25, owner: 'priya.io',   updated: '14:21:14', state: 'on',  cohort: 'all',         tags: ['agent','model'] },
  { key: 'sentiment_polysent_v32',   label: 'Sentiment · polysent v3.2',desc: 'New roberta-large fine-tune in production',   kind: 'rollout', val: 100, prev: 50,  owner: 'arianne.dev', updated: '8d ago',   state: 'on',  cohort: 'all',         tags: ['ml','sentiment'] },
  { key: 'whale_alerts_realtime',    label: 'Whale alerts · realtime',  desc: 'Sub-second propagation for top-30 wallets',   kind: 'rollout', val: 25,  prev: 0,   owner: 'k. yamamoto', updated: '2d ago',   state: 'on',  cohort: 'pro+',        tags: ['whales','realtime'] },
  { key: 'predictit_connector',     label: 'PredictIt connector',      desc: 'Route orders through PredictIt (currently down)', kind: 'kill', val: 0,   prev: 100, owner: 'sre',         updated: '14m ago',  state: 'kill', cohort: 'all',        tags: ['venue','kill-switch'] },
  { key: 'global_kill_trading',      label: 'Global kill · trading',    desc: 'Halt all order routing platform-wide',        kind: 'kill',    val: 0,   prev: 0,   owner: 'oliver.cho',  updated: '14d ago',  state: 'safe',cohort: 'all',        tags: ['kill-switch','trading'] },
  { key: 'quant_block_orders',       label: 'Block orders · quant tier', desc: 'Allow >$50k single-shot YES/NO blocks for quant users', kind: 'cohort', val: 100, prev: 0,   owner: 'maria.f',     updated: '12d ago',  state: 'on',  cohort: 'pro+',        tags: ['perpetuals','tier'] },
  { key: 'sub_invites_only',         label: 'Sign-ups · invite only',   desc: 'Restrict registration to invite codes',       kind: 'kill',    val: 1,   prev: 0,   owner: 'priya.io',    updated: '38d ago',  state: 'on',  cohort: 'all',        tags: ['signup','growth'] },
  { key: 'mcp_python_runtime',       label: 'MCP · Python runtime',     desc: 'Server-side Python runtime for MCP tools',    kind: 'rollout', val: 50,  prev: 25,  owner: 'tess.k',      updated: '4d ago',   state: 'on',  cohort: 'beta_testers',tags: ['mcp','runtime'] },
  { key: 'new_dashboard',            label: 'New trader dashboard',     desc: 'Redesigned dashboard with quick actions',     kind: 'rollout', val: 14,  prev: 5,   owner: 'priya.io',    updated: '1d ago',   state: 'on',  cohort: 'all',         tags: ['ui','redesign'] },
  { key: 'agent_streaming_tokens',   label: 'Agent · stream tokens',    desc: 'Server-sent events for agent responses',      kind: 'rollout', val: 100, prev: 100, owner: 'priya.io',    updated: '24d ago',  state: 'on',  cohort: 'all',         tags: ['agent','streaming'] },
  { key: 'ftx_data_replay',          label: 'FTX historical replay',    desc: 'Allow backtests on FTX archive (paywalled)',  kind: 'cohort',  val: 100, prev: 0,   owner: 'tess.k',      updated: '94d ago',  state: 'on',  cohort: 'enterprise', tags: ['data','enterprise'] },
  { key: 'experimental_options',     label: 'Options trading',          desc: 'Beta of options market on Deribit',           kind: 'cohort',  val: 100, prev: 0,   owner: 'k. yamamoto', updated: '14d ago',  state: 'on',  cohort: 'internal',   tags: ['options','beta'] },
];

function FlagToggle({ on }) {
  return (
    <div style={{position:'relative',width:32,height:18,borderRadius:9,background: on ? 'var(--accent-default)' : 'var(--bg-elevated)',border:'1px solid var(--border-subtle)',transition:'background 120ms'}}>
      <div style={{position:'absolute',top:1,left:on?15:1,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 120ms',boxShadow:'0 1px 2px rgba(0,0,0,0.3)'}} />
    </div>
  );
}
function K({ k }) {
  if (k === 'rollout') return <AdmPill kind="info">rollout</AdmPill>;
  if (k === 'kill')    return <AdmPill kind="loss">kill-switch</AdmPill>;
  if (k === 'cohort')  return <AdmPill kind="warn">cohort</AdmPill>;
  return <AdmPill>{k}</AdmPill>;
}

function App() {
  const [filter, setFilter] = React.useState('all');
  const filtered = filter === 'all' ? FLAGS : FLAGS.filter(f => f.kind === filter);

  return (
    <AdmShell active="config" title="Feature flags" crumbs={[{ label: 'Trust & Safety' }]}>
      <AdmPageHead
        title="Feature flags"
        sub={<>{FLAGS.length} flags · 2 kill-switches armed · changes mirrored to <span className="mono" style={{color:'var(--text-secondary)'}}>config.prod</span> in &lt;2s</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="scroll" size={12} />History</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New flag</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Active flags" value={FLAGS.filter(f=>f.state==='on').length} delta="9 enabled · 3 partial" deltaKind="gain" icon="settings" iconKind="is-info" />
        <AdmStat label="Kill switches" value="2 / 2" delta="PredictIt armed · global safe" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
        <AdmStat label="Pending rollouts" value="3" delta="agent_v3 · sentiment · MCP" icon="trending" iconKind="is-info" />
        <AdmStat label="Changes · 24h" value="14" delta="14 by admins · 0 auto" icon="scroll" iconKind="is-info" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-loss"><AdmIcon name="shield-alert" size={14} /></div>
            <h3 className="adm-card-title">Kill switches</h3>
            <div style={{marginLeft:'auto'}}><AdmPill kind="loss">1 armed</AdmPill></div>
          </div>
          {FLAGS.filter(f => f.kind === 'kill').map((f, i) => (
            <div key={f.key} style={{padding:'14px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:8,height:8,borderRadius:'50%',background: f.state === 'kill' ? 'var(--loss)' : 'var(--gain)',flexShrink:0}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{f.label}</span>
                  {f.state === 'kill'
                    ? <AdmPill kind="loss">armed</AdmPill>
                    : <AdmPill kind="gain">safe</AdmPill>}
                </div>
                <div style={{fontSize:11.5,color:'var(--text-secondary)',marginTop:3}}>{f.desc}</div>
                <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:4}}>{f.key} · last touched {f.updated} by {f.owner}</div>
              </div>
              <button className={`adm-btn ${f.state === 'kill' ? 'adm-btn-secondary' : 'adm-btn-danger'}`}>
                {f.state === 'kill' ? 'Disarm' : 'Arm'}
              </button>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">Active rollouts</h3>
          </div>
          {FLAGS.filter(f => f.kind === 'rollout' && f.val < 100).map((f, i) => (
            <div key={f.key} style={{padding:'12px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                <span style={{fontSize:12.5,color:'var(--text-primary)',fontWeight:500,flex:1}}>{f.label}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--accent-text)',fontWeight:600}}>{f.val}%</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)'}}>was {f.prev}%</span>
              </div>
              <div className="adm-bar" style={{height:6}}><span style={{width:`${f.val}%`,background:'var(--accent-default)'}} /></div>
              <div style={{display:'flex',gap:6,marginTop:8}}>
                <button className="adm-btn adm-btn-secondary" style={{flex:1,padding:'4px 8px',fontSize:10}}>+10%</button>
                <button className="adm-btn adm-btn-secondary" style={{flex:1,padding:'4px 8px',fontSize:10}}>+25%</button>
                <button className="adm-btn adm-btn-secondary" style={{flex:1,padding:'4px 8px',fontSize:10}}>100%</button>
                <button className="adm-btn adm-btn-danger" style={{flex:1,padding:'4px 8px',fontSize:10}}>rollback</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="All flags" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Flag key, owner, tag…" />
          </div>
          <AdmFilter active={filter==='all'}     count={FLAGS.length} onClick={()=>setFilter('all')}>All</AdmFilter>
          <AdmFilter active={filter==='rollout'} count={FLAGS.filter(f=>f.kind==='rollout').length} onClick={()=>setFilter('rollout')}>Rollouts</AdmFilter>
          <AdmFilter active={filter==='kill'}    count={FLAGS.filter(f=>f.kind==='kill').length} onClick={()=>setFilter('kill')}>Kill</AdmFilter>
          <AdmFilter active={filter==='cohort'}  count={FLAGS.filter(f=>f.kind==='cohort').length} onClick={()=>setFilter('cohort')}>Cohort</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Flag</th>
              <th>Kind</th>
              <th>State</th>
              <th>Cohort</th>
              <th className="col-num">Rollout</th>
              <th>Owner</th>
              <th>Updated</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.key}>
                <td>
                  <div style={{fontWeight:500}}>{f.label}</div>
                  <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{f.key}</div>
                </td>
                <td><K k={f.kind} /></td>
                <td>
                  {f.kind === 'kill' && f.state === 'kill' ? <FlagToggle on={false} /> : <FlagToggle on={f.val > 0} />}
                </td>
                <td className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{f.cohort}</td>
                <td className="col-num">
                  {f.kind === 'kill' ? (
                    <span style={{color:f.state==='kill' ? 'var(--loss-text)' : 'var(--gain-text)',fontWeight:600,fontFamily:'Geist Mono, monospace'}}>{f.state==='kill' ? 'ARMED' : 'safe'}</span>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                      <div className="adm-bar" style={{width:60}}><span style={{width:`${f.val}%`}} /></div>
                      <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,minWidth:36,textAlign:'right',fontWeight:600}}>{f.val}%</span>
                    </div>
                  )}
                </td>
                <td><a href="Admin-Admins.html" className="mono" style={{fontSize:11,color:'var(--accent-text)',textDecoration:'none'}}>{f.owner}</a></td>
                <td className="col-tertiary" style={{fontSize:11}}>{f.updated}</td>
                <td>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {f.tags.slice(0, 2).map(t => <span key={t} style={{fontSize:9.5,padding:'2px 5px',borderRadius:3,background:'var(--bg-elevated)',color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',border:'1px solid var(--border-subtle)'}}>{t}</span>)}
                  </div>
                </td>
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
