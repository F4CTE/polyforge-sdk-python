/* Polyforge — Admin Builder Telemetry
   Visual strategy builder: block usage, funnel, errors, agent assists */

function App() {
  return (
    <AdmShell active="builder" title="Builder telemetry" crumbs={[{ label: 'Trading' }]}>
      <AdmPageHead
        title="Builder telemetry"
        sub={<>Visual strategy builder · 12,840 sessions · 2,841 strategies created · last 30d</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export CSV</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />30 days</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Builder sessions" value="12,840" delta="+18.4% MoM" deltaKind="gain" icon="hammer" iconKind="is-info" />
        <AdmStat label="Strategies created" value="2,841" delta="22.1% conversion" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="Agent assists" value="8,124" delta="63.3% of sessions" icon="bot" iconKind="is-info" />
        <AdmStat label="Avg time to build" value="14m 22s" delta="−2m vs last month" deltaKind="gain" icon="clock" iconKind="is-gain" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="layers" size={14} /></div>
            <h3 className="adm-card-title">Build → publish funnel · 30d</h3>
          </div>
          {[
            { step: 'Opened builder',          n: 12840, pct: 100,  drop: null,  c: 'var(--accent-default)' },
            { step: 'Placed first block',      n: 9420,  pct: 73.4, drop: 26.6, c: 'var(--accent-default)' },
            { step: 'Connected ≥3 blocks',     n: 6840,  pct: 53.3, drop: 27.4, c: 'var(--info)' },
            { step: 'Ran first backtest',      n: 4810,  pct: 37.5, drop: 29.7, c: 'var(--info)' },
            { step: 'Saved strategy',          n: 3284,  pct: 25.6, drop: 31.7, c: 'var(--gain)' },
            { step: 'Published / went live',   n: 2841,  pct: 22.1, drop: 13.5, c: 'var(--gain)' },
          ].map((r, i) => (
            <div key={r.step} style={{padding:'12px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                <span style={{fontSize:11,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',width:18}}>{i+1}</span>
                <span style={{fontSize:13,color:'var(--text-primary)'}}>{r.step}</span>
                {r.drop != null && <span className="adm-pill is-loss" style={{marginLeft:8,fontSize:9.5}}>−{r.drop}%</span>}
                <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--text-secondary)',fontWeight:600}}>{r.n.toLocaleString()}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-tertiary)',minWidth:48,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar"><span style={{width:`${r.pct}%`,background:r.c}} /></div>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="blocks" size={14} /></div>
            <h3 className="adm-card-title">Top blocks · 30d</h3>
          </div>
          {[
            { k: 'Price · candle',     n: 8420, pct: 96 },
            { k: 'RSI',                n: 6210, pct: 71 },
            { k: 'Moving average',     n: 5810, pct: 66 },
            { k: 'Order · market',     n: 4920, pct: 56 },
            { k: 'Bollinger bands',    n: 3284, pct: 37 },
            { k: 'Sentiment score',    n: 2810, pct: 32 },
            { k: 'Volume profile',     n: 2418, pct: 28 },
            { k: 'Position sizing',    n: 2210, pct: 25 },
            { k: 'Order · limit',      n: 1944, pct: 22 },
            { k: 'Stop loss · trail',  n: 1611, pct: 18 },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'7px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{r.n.toLocaleString()}</span>
              </div>
              <div className="adm-bar"><span style={{width:`${r.pct}%`}} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-loss"><AdmIcon name="circle-x" size={14} /></div>
            <h3 className="adm-card-title">Top validation errors · 30d</h3>
          </div>
          {[
            { e: 'unconnected output port',   n: 4218 },
            { e: 'circular reference',        n: 1840 },
            { e: 'type mismatch',             n: 1620 },
            { e: 'missing required input',    n: 920 },
            { e: 'order without sizing',      n: 612 },
            { e: 'no exit condition',         n: 488 },
          ].map((r, i) => (
            <div key={r.e} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:8}}>
              <span className="mono" style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{r.e}</span>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--loss-text)',fontWeight:600}}>{r.n.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="bot" size={14} /></div>
            <h3 className="adm-card-title">Agent assist actions</h3>
          </div>
          {[
            { k: 'Suggest next block',  n: 3284, pct: 40 },
            { k: 'Explain a block',     n: 2210, pct: 27 },
            { k: 'Fix validation error',n: 1611, pct: 20 },
            { k: 'Generate from prompt',n: 588,  pct: 7  },
            { k: 'Convert from code',   n: 412,  pct: 5  },
            { k: 'Optimize parameters', n: 19,   pct: 1  },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{r.n.toLocaleString()}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)',minWidth:30,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar"><span style={{width:`${r.pct*2.4}%`,background:'var(--info)'}} /></div>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="layers" size={14} /></div>
            <h3 className="adm-card-title">Strategy complexity</h3>
          </div>
          <div style={{display:'flex',gap:4,alignItems:'flex-end',height:120,marginBottom:8}}>
            {[ {n:'1-3', p:14}, {n:'4-6', p:48}, {n:'7-10', p:78}, {n:'11-15', p:96}, {n:'16-20', p:62}, {n:'21-30', p:34}, {n:'31+', p:12} ].map(b => (
              <div key={b.n} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{width:'100%',height:`${b.p}%`,background:'var(--accent-default)',borderRadius:'2px 2px 0 0',minHeight:2}} />
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:4,fontSize:10,fontFamily:'Geist Mono, monospace',color:'var(--text-tertiary)'}}>
            {['1-3','4-6','7-10','11-15','16-20','21-30','31+'].map(n => <div key={n} style={{flex:1,textAlign:'center'}}>{n}</div>)}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:14,paddingTop:14,borderTop:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontSize:11}}>
            <div><span style={{color:'var(--text-tertiary)'}}>median</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:6}}>11 blocks</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>most</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:6}}>184 blocks</span></div>
          </div>
        </div>
      </div>

      <AdmSectionHead title="Sessions · last 24h" />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>User</th>
              <th>Started</th>
              <th className="col-num">Duration</th>
              <th className="col-num">Blocks</th>
              <th className="col-num">Edits</th>
              <th className="col-num">Agent calls</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'sess_4f2a', user: 'usr_71c2', started: '14:22:08', dur: '18m 42s', blocks: 14, edits: 84,  agent: 6,  out: 'published' },
              { id: 'sess_4f29', user: 'usr_8a1d', started: '14:18:14', dur: '8m 12s',  blocks: 6,  edits: 22,  agent: 2,  out: 'saved' },
              { id: 'sess_4f28', user: 'usr_55a3', started: '14:12:48', dur: '32m 04s', blocks: 22, edits: 184, agent: 12, out: 'published' },
              { id: 'sess_4f27', user: 'usr_92ff', started: '14:08:22', dur: '4m 18s',  blocks: 3,  edits: 8,   agent: 1,  out: 'abandoned' },
              { id: 'sess_4f26', user: 'usr_44d8', started: '14:02:12', dur: '24m 18s', blocks: 18, edits: 112, agent: 9,  out: 'backtested' },
              { id: 'sess_4f25', user: 'usr_4a91', started: '13:58:44', dur: '12m 02s', blocks: 9,  edits: 44,  agent: 4,  out: 'saved' },
              { id: 'sess_4f24', user: 'usr_3b22', started: '13:52:11', dur: '2m 14s',  blocks: 1,  edits: 2,   agent: 0,  out: 'abandoned' },
              { id: 'sess_4f23', user: 'usr_77c5', started: '13:48:18', dur: '14m 28s', blocks: 11, edits: 62,  agent: 5,  out: 'published' },
            ].map(s => (
              <tr key={s.id}>
                <td className="mono col-id">{s.id}</td>
                <td><a className="mono" href="Admin-User-Detail.html" style={{color:'var(--accent-text)',fontSize:11,textDecoration:'none'}}>{s.user}</a></td>
                <td className="col-mono col-tertiary" style={{fontSize:11}}>{s.started}</td>
                <td className="col-num col-secondary">{s.dur}</td>
                <td className="col-num">{s.blocks}</td>
                <td className="col-num col-secondary">{s.edits}</td>
                <td className="col-num col-secondary">{s.agent}</td>
                <td>
                  {s.out === 'published'  && <AdmPill kind="gain">PUBLISHED</AdmPill>}
                  {s.out === 'backtested' && <AdmPill kind="info">BACKTESTED</AdmPill>}
                  {s.out === 'saved'      && <AdmPill kind="info">SAVED</AdmPill>}
                  {s.out === 'abandoned'  && <AdmPill kind="loss">ABANDONED</AdmPill>}
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
