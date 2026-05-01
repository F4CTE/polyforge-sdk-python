/* Polyforge — Admin Retention
   Cohort retention grid, DAU/MAU stickiness, expansion, key activation events */

function CohortCell({ pct }) {
  if (pct == null) return <td style={{ padding: '6px 4px' }}></td>;
  const color = pct >= 80 ? 'var(--gain-text)'
              : pct >= 50 ? 'var(--info-text, var(--accent-text))'
              : pct >= 25 ? 'var(--text-secondary)'
              :             'var(--text-tertiary)';
  const weight = pct >= 80 ? 700 : pct >= 50 ? 600 : 500;
  return (
    <td className="mono tabnum" style={{
      textAlign: 'center',
      fontSize: 11.5,
      fontWeight: weight,
      color,
      padding: '7px 4px',
    }}>{pct}%</td>
  );
}

const COHORTS = [
  { m: 'May 2023', size: 184, vals: [100, 62, 48, 38, 32, 28, 24, 22, 22, 20, 18, 18, 18] },
  { m: 'Jun 2023', size: 220, vals: [100, 64, 50, 41, 34, 30, 26, 24, 22, 20, 19, 19] },
  { m: 'Jul 2023', size: 282, vals: [100, 68, 54, 44, 36, 31, 28, 26, 24, 22, 22] },
  { m: 'Aug 2023', size: 318, vals: [100, 71, 56, 46, 38, 33, 30, 28, 26, 24] },
  { m: 'Sep 2023', size: 412, vals: [100, 74, 58, 49, 42, 36, 32, 30, 28] },
  { m: 'Oct 2023', size: 488, vals: [100, 76, 62, 51, 44, 38, 34, 32] },
  { m: 'Nov 2023', size: 624, vals: [100, 78, 64, 54, 46, 41, 36] },
  { m: 'Dec 2023', size: 712, vals: [100, 81, 67, 58, 49, 44] },
  { m: 'Jan 2024', size: 884, vals: [100, 84, 71, 62, 54] },
  { m: 'Feb 2024', size: 1042, vals: [100, 86, 74, 64] },
  { m: 'Mar 2024', size: 1284, vals: [100, 88, 76] },
  { m: 'Apr 2024', size: 1620, vals: [100, 92] },
];

function App() {
  return (
    <AdmShell active="retention" title="Retention" crumbs={[{ label: 'Overview' }]}>
      <AdmPageHead
        title="Retention"
        sub={<>Cohort grid · 12 monthly cohorts · 8,164 users tracked · activation = first published strategy</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />By cohort · monthly</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="W1 retention" value="92%" delta="+4pp YoY" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="W4 retention" value="74%" delta="+8pp YoY" deltaKind="gain" icon="trending" iconKind="is-gain" />
        <AdmStat label="M6 retention" value="34%" delta="+6pp YoY · Sep'23 cohort" deltaKind="gain" icon="users" iconKind="is-info" />
        <AdmStat label="DAU / MAU" value="62%" delta="stickiness · target 50%" deltaKind="gain" icon="activity" iconKind="is-gain" />
      </div>

      <div className="adm-card" style={{marginBottom:20}}>
        <div className="adm-card-head">
          <div className="adm-card-icon"><AdmIcon name="layers" size={14} /></div>
          <h3 className="adm-card-title">Cohort retention · monthly</h3>
          <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-tertiary)'}}>% of cohort still active in month N</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{textAlign:'left',padding:'8px 8px',fontSize:10,fontWeight:500,color:'var(--text-tertiary)',width:80,letterSpacing:'0.04em',textTransform:'uppercase'}}>Cohort</th>
                <th style={{textAlign:'right',padding:'8px 8px',fontSize:10,fontWeight:500,color:'var(--text-tertiary)',width:50,letterSpacing:'0.04em',textTransform:'uppercase'}}>Size</th>
                {Array.from({length:13}).map((_, i) => (
                  <th key={i} className="mono" style={{padding:'8px 4px',fontSize:10,fontWeight:500,color:'var(--text-tertiary)',textAlign:'center',letterSpacing:'0.04em'}}>M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COHORTS.map(c => (
                <tr key={c.m} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{padding:'7px 8px',color:'var(--text-secondary)',fontSize:11.5,whiteSpace:'nowrap'}}>{c.m}</td>
                  <td className="mono tabnum" style={{padding:'7px 8px',textAlign:'right',color:'var(--text-tertiary)',fontSize:11}}>{c.size.toLocaleString()}</td>
                  {Array.from({length:13}).map((_, i) => <CohortCell key={i} pct={c.vals[i]} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{display:'flex',gap:18,marginTop:12,paddingTop:12,borderTop:'1px solid var(--border-subtle)',fontSize:10.5,color:'var(--text-tertiary)',flexWrap:'wrap'}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{ color: 'var(--gain-text)', fontWeight: 700 }}>80%</span> ≥ strong</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{ color: 'var(--info-text, var(--accent-text))', fontWeight: 600 }}>60%</span> 50–79%</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>40%</span> 25–49%</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span className="mono" style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>15%</span> &lt;25%</span>
        </div>
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-gain"><AdmIcon name="check" size={14} /></div>
            <h3 className="adm-card-title">Activation funnel</h3>
          </div>
          {[
            { k: 'Signed up',                 n: 1620, pct: 100 },
            { k: 'Linked exchange',           n: 1418, pct: 87.5 },
            { k: 'Saved first strategy',      n: 1142, pct: 70.5 },
            { k: 'Ran first backtest',        n: 884,  pct: 54.6 },
            { k: 'First paper trade',         n: 612,  pct: 37.8 },
            { k: 'First live order',          n: 412,  pct: 25.4 },
            { k: 'Published to marketplace',  n: 142,  pct: 8.8  },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)',fontWeight:600}}>{r.n.toLocaleString()}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)',minWidth:42,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar" style={{height:5}}><span style={{width:`${r.pct}%`}} /></div>
            </div>
          ))}
          <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border-subtle)',fontSize:11,color:'var(--text-tertiary)'}}>
            Activated within 7d: <span style={{fontFamily:'Geist Mono, monospace',color:'var(--accent-text)',fontWeight:600,marginLeft:6}}>54.6%</span>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Engagement · Apr</h3>
          </div>
          <div style={{display:'flex',gap:10,marginBottom:14}}>
            <div style={{flex:1,padding:10,background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:10,color:'var(--text-tertiary)'}}>DAU</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:18,fontWeight:600,color:'var(--text-primary)'}}>5,148</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--gain-text)'}}>+14.2%</div>
            </div>
            <div style={{flex:1,padding:10,background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:10,color:'var(--text-tertiary)'}}>WAU</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:18,fontWeight:600,color:'var(--text-primary)'}}>7,820</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--gain-text)'}}>+12.8%</div>
            </div>
            <div style={{flex:1,padding:10,background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:10,color:'var(--text-tertiary)'}}>MAU</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:18,fontWeight:600,color:'var(--text-primary)'}}>8,304</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--gain-text)'}}>+18.4%</div>
            </div>
          </div>
          <div style={{fontSize:11,color:'var(--text-tertiary)',marginBottom:8}}>Sessions per active user · 30d</div>
          <svg viewBox="0 0 360 100" style={{width:'100%',height:100}}>
            {[20,50,80].map(y => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            <path d="M 0 60 L 30 56 L 60 50 L 90 54 L 120 44 L 150 48 L 180 38 L 210 42 L 240 32 L 270 36 L 300 28 L 330 30 L 360 22" stroke="var(--info)" strokeWidth="1.6" fill="none" />
            {[{x:0,y:60},{x:60,y:50},{x:120,y:44},{x:180,y:38},{x:240,y:32},{x:300,y:28},{x:360,y:22}].map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="var(--info)" />)}
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>
            <span>4.2 / day</span><span style={{color:'var(--gain-text)',fontWeight:600}}>↑ 6.8 / day</span>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">Most-retentive features</h3>
          </div>
          <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginBottom:10}}>M3 retention by power feature usage</div>
          {[
            { k: 'Whale alerts ·    +1 saved',   ret: 84, base: 34 },
            { k: 'Backtest ·       +5 runs/wk',  ret: 78, base: 34 },
            { k: 'Marketplace ·    purchased',   ret: 72, base: 34 },
            { k: 'Strategy ·       published',   ret: 88, base: 34 },
            { k: 'Agent ·          24+ msgs/wk', ret: 68, base: 34 },
            { k: 'API ·            integrated',  ret: 92, base: 34 },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:10.5,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--gain-text)',fontWeight:600}}>{r.ret}%</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10,color:'var(--text-tertiary)'}}>vs {r.base}%</span>
              </div>
              <div style={{position:'relative',height:5}}>
                <div style={{position:'absolute',left:0,top:0,height:5,width:`${r.base}%`,background:'var(--bg-elevated)',borderRadius:2}} />
                <div style={{position:'absolute',left:0,top:0,height:5,width:`${r.ret}%`,background:'var(--gain)',borderRadius:2,opacity:0.7}} />
                <div style={{position:'absolute',left:`${r.base}%`,top:-1,bottom:-1,width:1,background:'var(--text-primary)'}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
