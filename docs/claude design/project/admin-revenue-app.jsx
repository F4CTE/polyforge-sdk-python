/* Polyforge — Admin Revenue
   MRR, ARR, by tier, by stream (subs vs marketplace fees vs trading), churn $ */

function App() {
  return (
    <AdmShell active="revenue" title="Revenue" crumbs={[{ label: 'Overview' }]}>
      <AdmPageHead
        title="Revenue"
        sub={<>MRR <span className="mono" style={{color:'var(--text-secondary)'}}>$184.2K</span> · ARR <span className="mono" style={{color:'var(--text-secondary)'}}>$2.21M</span> · 4 streams · last close <span className="mono">2024-04-30</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />Apr 2024</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="newspaper" size={12} />Investor view</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="MRR" value="$184.2K" delta="+18.4% MoM" deltaKind="gain" icon="cash" iconKind="is-gain" />
        <AdmStat label="ARR" value="$2.21M" delta="+92% YoY" deltaKind="gain" icon="trending" iconKind="is-gain" />
        <AdmStat label="Net dollar retention" value="142%" delta="expansion > churn" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="Gross margin" value="78.4%" delta="infra 14% · model 6%" icon="pie" iconKind="is-info" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">MRR · 12 months</h3>
          </div>
          <svg viewBox="0 0 600 200" style={{width:'100%',height:200}}>
            <defs>
              <linearGradient id="rv-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[40,80,120,160].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            {[
              { x: 0,   y: 174 }, { x: 50,  y: 168 }, { x: 100, y: 158 },
              { x: 150, y: 148 }, { x: 200, y: 134 }, { x: 250, y: 122 },
              { x: 300, y: 108 }, { x: 350, y: 92 },  { x: 400, y: 84 },
              { x: 450, y: 68 },  { x: 500, y: 52 },  { x: 550, y: 38 }, { x: 600, y: 24 },
            ].reduce((acc, p, i, arr) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '').split('').length && null}
            <path d="M 0 174 L 50 168 L 100 158 L 150 148 L 200 134 L 250 122 L 300 108 L 350 92 L 400 84 L 450 68 L 500 52 L 550 38 L 600 24 L 600 200 L 0 200 Z" fill="url(#rv-area)" />
            <path d="M 0 174 L 50 168 L 100 158 L 150 148 L 200 134 L 250 122 L 300 108 L 350 92 L 400 84 L 450 68 L 500 52 L 550 38 L 600 24" stroke="var(--accent-default)" strokeWidth="2" fill="none" />
            {[
              { x: 0,   y: 174 }, { x: 50,  y: 168 }, { x: 100, y: 158 },
              { x: 150, y: 148 }, { x: 200, y: 134 }, { x: 250, y: 122 },
              { x: 300, y: 108 }, { x: 350, y: 92 },  { x: 400, y: 84 },
              { x: 450, y: 68 },  { x: 500, y: 52 },  { x: 550, y: 38 }, { x: 600, y: 24 },
            ].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--accent-default)" stroke="var(--bg-surface)" strokeWidth="1.5" />)}
            {['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'].map((m, i) => (
              <text key={m+i} x={i*50} y="195" fontSize="9" fill="var(--text-tertiary)" fontFamily="Geist Mono, monospace" textAnchor="middle">{m}</text>
            ))}
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:14,paddingTop:14,borderTop:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontSize:11}}>
            <div><span style={{color:'var(--text-tertiary)'}}>May'23</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>$22K</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>Apr'24</span> <span style={{color:'var(--accent-text)',fontWeight:600,marginLeft:4}}>$184K</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>CAGR</span> <span style={{color:'var(--gain-text)',fontWeight:600,marginLeft:4}}>+737%</span></div>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-gain"><AdmIcon name="pie" size={14} /></div>
            <h3 className="adm-card-title">Revenue mix · MTD</h3>
          </div>
          {[
            { k: 'Subscriptions',   v: 96400, pct: 52.3, c: 'var(--accent-default)' },
            { k: 'Trading fees',    v: 48200, pct: 26.2, c: 'var(--info)' },
            { k: 'Marketplace · 20%', v: 28100, pct: 15.3, c: 'var(--gain)' },
            { k: 'Enterprise contracts', v: 11500, pct: 6.2, c: 'var(--warning)' },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'12px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                <span style={{width:8,height:8,borderRadius:2,background:r.c,display:'inline-block'}} />
                <span style={{fontSize:12,color:'var(--text-primary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--text-primary)',fontWeight:600}}>${(r.v/1000).toFixed(1)}K</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-tertiary)',minWidth:42,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar" style={{height:6}}><span style={{width:`${r.pct*1.9}%`,background:r.c}} /></div>
            </div>
          ))}
          <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',fontSize:12}}>
            <span style={{color:'var(--text-tertiary)'}}>Total MTD</span>
            <span style={{fontFamily:'Geist Mono, monospace',fontWeight:700,color:'var(--text-primary)'}}>$184,200</span>
          </div>
        </div>
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="users" size={14} /></div>
            <h3 className="adm-card-title">Subscriptions by tier</h3>
          </div>
          {[
            { tier: 'Free',       count: 8420, mrr: 0,     color: 'var(--text-tertiary)' },
            { tier: 'Starter · $19/mo',  count: 1240, mrr: 23560, color: 'var(--info)' },
            { tier: 'Pro · $49/mo',      count: 884,  mrr: 43316, color: 'var(--accent-default)' },
            { tier: 'Quant · $149/mo',   count: 142,  mrr: 21158, color: 'var(--gain)' },
            { tier: 'Enterprise',  count: 8,    mrr: 8400,  color: 'var(--warning)' },
          ].map((t, i) => (
            <div key={t.tier} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'baseline',gap:8}}>
              <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{t.tier}</span>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-tertiary)'}}>{t.count.toLocaleString()}</span>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:12,color: t.mrr === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',fontWeight:600,minWidth:64,textAlign:'right'}}>${(t.mrr/1000).toFixed(1)}K</span>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-gain"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">MRR movement · MTD</h3>
          </div>
          {[
            { k: 'Starting MRR',     v: '+$155.6K', pos: false, c: 'var(--text-secondary)' },
            { k: 'New business',     v: '+$24.8K',  pos: true, c: 'var(--gain)' },
            { k: 'Expansion',        v: '+$8.4K',   pos: true, c: 'var(--gain)' },
            { k: 'Reactivation',     v: '+$1.2K',   pos: true, c: 'var(--info)' },
            { k: 'Contraction',      v: '−$2.4K',   pos: false, c: 'var(--warning)' },
            { k: 'Churn',            v: '−$3.4K',   pos: false, c: 'var(--loss)' },
          ].map((m, i) => (
            <div key={m.k} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11.5,color:'var(--text-primary)',flex:1}}>{m.k}</span>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:12,color:m.c,fontWeight:600}}>{m.v}</span>
            </div>
          ))}
          <div style={{marginTop:10,paddingTop:10,borderTop:'2px solid var(--border-default)',display:'flex',justifyContent:'space-between',fontSize:12.5}}>
            <span style={{fontWeight:600}}>Net new MRR</span>
            <span style={{fontFamily:'Geist Mono, monospace',fontWeight:700,color:'var(--gain-text)'}}>+$28.6K</span>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-warn"><AdmIcon name="circle-x" size={14} /></div>
            <h3 className="adm-card-title">Churn · 30d</h3>
          </div>
          <div style={{display:'flex',gap:14,marginBottom:14}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginBottom:4}}>Logo churn</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:24,fontWeight:600,color:'var(--text-primary)'}}>2.4%</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--gain-text)'}}>−0.4pp MoM</div>
            </div>
            <div style={{width:1,background:'var(--border-subtle)'}} />
            <div style={{flex:1}}>
              <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginBottom:4}}>$ churn</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:24,fontWeight:600,color:'var(--text-primary)'}}>1.8%</div>
              <div style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--gain-text)'}}>−0.2pp MoM</div>
            </div>
          </div>
          <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginBottom:8}}>Top reasons</div>
          {[
            { k: 'Lost confidence in returns',  pct: 38 },
            { k: 'Switched to competitor',      pct: 22 },
            { k: 'Found agent unhelpful',       pct: 18 },
            { k: 'Pricing',                     pct: 14 },
            { k: 'Other',                       pct: 8 },
          ].map(r => (
            <div key={r.k} style={{padding:'5px 0'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:3}}>
                <span style={{fontSize:11,color:'var(--text-secondary)',flex:1}}>{r.k}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar" style={{height:4}}><span style={{width:`${r.pct*2.4}%`,background:'var(--loss)'}} /></div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Top accounts · MTD" />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Plan</th>
              <th>Region</th>
              <th>Since</th>
              <th className="col-num">MRR</th>
              <th className="col-num">Trading vol</th>
              <th className="col-num">Trading fees</th>
              <th className="col-num">Total MTD</th>
              <th>Health</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'arc_184', name: 'Stratos Capital',    plan: 'Enterprise',  region: 'us',  since: 'Q1 2023', mrr: 4200, vol: '$48.2M', fees: '$8.4K', tot: '$12.6K', health: 'expanding' },
              { id: 'arc_142', name: 'Mountfair Hedge',    plan: 'Enterprise',  region: 'eu',  since: 'Q3 2023', mrr: 2200, vol: '$22.4M', fees: '$3.8K', tot: '$6.0K',  health: 'healthy' },
              { id: 'arc_128', name: 'Polychain DAO',      plan: 'Quant',       region: 'apac',since: 'Q4 2023', mrr: 1490, vol: '$8.4M',  fees: '$1.2K', tot: '$2.7K',  health: 'healthy' },
              { id: 'arc_88',  name: 'k. yamamoto · solo', plan: 'Quant',       region: 'apac',since: 'Q3 2023', mrr: 149,  vol: '$8.2M',  fees: '$58.4',  tot: '$207',  health: 'champion' },
              { id: 'arc_42',  name: 'Tess Karadzic',      plan: 'Pro',         region: 'eu',  since: 'Q1 2024', mrr: 49,   vol: '$1.9M',  fees: '$22',    tot: '$71',   health: 'healthy' },
              { id: 'arc_38',  name: 'arianne.dev',        plan: 'Pro',         region: 'us',  since: 'Q4 2023', mrr: 49,   vol: '$4.1M',  fees: '$48',    tot: '$97',   health: 'expanding' },
            ].map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{fontWeight:500}}>{a.name}</div>
                  <div className="mono col-tertiary" style={{fontSize:10.5,marginTop:2}}>{a.id}</div>
                </td>
                <td><AdmPill kind={a.plan === 'Enterprise' ? 'warn' : a.plan === 'Quant' ? 'gain' : 'info'}>{a.plan}</AdmPill></td>
                <td className="col-secondary" style={{fontSize:11}}>{a.region}</td>
                <td className="col-tertiary" style={{fontSize:11}}>{a.since}</td>
                <td className="col-num">${a.mrr.toLocaleString()}</td>
                <td className="col-num col-secondary">{a.vol}</td>
                <td className="col-num col-secondary">{a.fees}</td>
                <td className="col-num" style={{fontWeight:600,color:'var(--gain-text)'}}>{a.tot}</td>
                <td>
                  {a.health === 'champion'   && <AdmPill kind="gain">champion</AdmPill>}
                  {a.health === 'expanding'  && <AdmPill kind="gain">expanding</AdmPill>}
                  {a.health === 'healthy'    && <AdmPill kind="info">healthy</AdmPill>}
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
