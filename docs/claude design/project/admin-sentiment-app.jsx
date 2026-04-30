/* Polyforge — Admin Sentiment ingest
   News, social, polling, and oracle feeds; coverage, freshness, model accuracy.
   These signals feed `sentiment.score` and `news.weight` blocks for prediction-market strategies. */

const SOURCES = [
  { id: 'twitter-firehose',     kind: 'social',  name: 'Twitter/X firehose',         topics: 'all',          rate: '14.8K/min', delay: '4s',   acc: 0.84, state: 'op',   weight: 0.34 },
  { id: 'reddit-politics',      kind: 'social',  name: 'Reddit · 24 subs',           topics: 'politics, sports', rate: '1.2K/min', delay: '12s', acc: 0.71, state: 'op',   weight: 0.18 },
  { id: 'discord-mirror',       kind: 'social',  name: 'Discord · 38 servers',       topics: 'top 30 markets', rate: '4.2K/min', delay: '8s',   acc: 0.62, state: 'op',   weight: 0.14 },
  { id: 'news-rss',             kind: 'news',    name: 'News · 184 outlets',         topics: 'all',          rate: '184/min',   delay: '22s',  acc: 0.92, state: 'op',   weight: 0.28 },
  { id: 'sec-filings',          kind: 'news',    name: 'SEC · 8K/10Q webhook',       topics: 'us markets',   rate: '4/hour',    delay: '2min', acc: 0.98, state: 'op',   weight: 0.08 },
  { id: 'polls-538',            kind: 'polling', name: 'FiveThirtyEight aggregate',  topics: 'elections',    rate: '12/day',    delay: '4h',   acc: 0.78, state: 'op',   weight: 0.42 },
  { id: 'polls-realclear',      kind: 'polling', name: 'RealClearPolitics',          topics: 'elections',    rate: '8/day',     delay: '6h',   acc: 0.74, state: 'op',   weight: 0.32 },
  { id: 'oracle-uma',           kind: 'oracle',  name: 'UMA optimistic oracle',      topics: 'all',          rate: '38/hour',   delay: '8s',   acc: 0.94, state: 'op',   weight: 0.62 },
  { id: 'oracle-chainlink',     kind: 'oracle',  name: 'Chainlink Functions',        topics: 'sports, finance', rate: '142/hour',delay: '14s', acc: 0.96, state: 'op',   weight: 0.48 },
  { id: 'sportsdata-feed',      kind: 'data',    name: 'SportsDataIO · scores',      topics: 'sports',       rate: '8.4K/min',  delay: '6s',   acc: 0.99, state: 'op',   weight: 0.74 },
  { id: 'youtube-finfluencer',  kind: 'social',  name: 'YouTube · 142 channels',     topics: 'top 50 markets', rate: '12/hour', delay: '8min', acc: 0.42, state: 'deg',  weight: 0.06, err: 'transcript queue lag' },
  { id: 'tg-channels',          kind: 'social',  name: 'Telegram · 84 channels',     topics: 'all',          rate: '2.4K/min',  delay: '14s',  acc: 0.38, state: 'paus',weight: 0,    err: 'manipulation flagged' },
];

function K({ k }) {
  const lab = { social: 'social', news: 'news', polling: 'polling', oracle: 'oracle', data: 'data' };
  const kind = { social: 'info', news: 'gain', polling: 'warn', oracle: 'gain', data: 'info' }[k] || 'default';
  return <AdmPill kind={kind}>{lab[k]}</AdmPill>;
}
function S({ s }) {
  if (s === 'op')   return <AdmPill kind="gain"><span className="adm-dot is-gain" />op</AdmPill>;
  if (s === 'deg')  return <AdmPill kind="warn">deg</AdmPill>;
  if (s === 'paus') return <AdmPill kind="loss">paused</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="sentiment" title="Sentiment ingest" crumbs={[{ label: 'Platform' }]}>
      <AdmPageHead
        title="Sentiment ingest"
        sub={<>12 sources · 38 model versions · 184M signals/day · feeds <span className="mono" style={{color:'var(--text-secondary)'}}>sentiment.score</span> and <span className="mono" style={{color:'var(--text-secondary)'}}>news.weight</span> blocks for 11 markets</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="bot" size={12} />Model registry</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Add source</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Active sources" value="10 / 12" delta="1 deg · 1 paused" deltaKind="warn" icon="trending" iconKind="is-warn" />
        <AdmStat label="Signals · 24h" value="184M" delta="+8.4%" deltaKind="gain" icon="activity" iconKind="is-info" />
        <AdmStat label="Model accuracy · 30d" value="78.4%" delta="+1.2pp on backtests" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="Avg ingest delay" value="9s" delta="p99 38s · YouTube spiked" deltaKind="warn" icon="clock" iconKind="is-warn" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="bar-chart" size={14} /></div>
            <h3 className="adm-card-title">Live sentiment scores · top markets</h3>
            <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-tertiary)'}}>−1 NO leans ⇄ +1 YES leans</span>
          </div>
          {[
            { sym: 'FED-MAR-CUT',     score: 0.42,  delta: '+0.08' },
            { sym: 'CPI-MAR-LT3',     score: 0.18,  delta: '−0.04' },
            { sym: 'NYC-MAYOR-MAMD',  score: 0.62,  delta: '+0.22' },
            { sym: 'SCOTUS-TIKTOK',   score: -0.14, delta: '−0.18' },
            { sym: 'OSCAR-BP-A',      score: 0.08,  delta: '+0.02' },
            { sym: 'NFL-CHIEFS-CVR',  score: 0.74,  delta: '+0.34' },
            { sym: 'SEN-2026-DEM',    score: -0.32, delta: '−0.14' },
            { sym: 'LAKERS-PLAYOFF',  score: -0.04, delta: '+0.04' },
          ].map((s, i) => {
            const c = s.score > 0.3 ? 'var(--gain)' : s.score < -0.3 ? 'var(--loss)' : 'var(--info)';
            return (
              <div key={s.sym} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                  <span className="mono" style={{fontSize:11.5,color:'var(--text-primary)',fontWeight:500,minWidth:144}}>{s.sym}</span>
                  <span style={{fontFamily:'Geist Mono, monospace',fontSize:13,color:c,fontWeight:600,width:60}}>{s.score > 0 ? '+' : ''}{s.score.toFixed(2)}</span>
                  <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color: s.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)'}}>{s.delta}</span>
                  <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-tertiary)'}}>1h trend</span>
                </div>
                <div style={{position:'relative',height:6,background:'var(--bg-elevated)',borderRadius:3}}>
                  <div style={{position:'absolute',top:0,bottom:0,left:'50%',width:1,background:'var(--border-default)'}} />
                  <div style={{position:'absolute',top:0,bottom:0,background:c,borderRadius:3,...(s.score >= 0 ? {left:'50%',width:`${(s.score)*50}%`} : {right:'50%',width:`${(-s.score)*50}%`})}} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="bot" size={14} /></div>
            <h3 className="adm-card-title">Model accuracy · 30d</h3>
          </div>
          <svg viewBox="0 0 360 140" style={{width:'100%',height:140}}>
            {[40,70,100].map(y => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            <path d="M 0 60 L 30 58 L 60 54 L 90 56 L 120 50 L 150 48 L 180 44 L 210 46 L 240 42 L 270 38 L 300 40 L 330 36 L 360 32" stroke="var(--gain)" strokeWidth="1.6" fill="none" />
            <path d="M 0 76 L 30 78 L 60 72 L 90 74 L 120 70 L 150 68 L 180 64 L 210 66 L 240 62 L 270 58 L 300 60 L 330 54 L 360 50" stroke="var(--info)" strokeWidth="1.4" fill="none" />
            <path d="M 0 96 L 30 94 L 60 90 L 90 92 L 120 88 L 150 86 L 180 82 L 210 88 L 240 84 L 270 80 L 300 82 L 330 76 L 360 72" stroke="var(--warning)" strokeWidth="1.4" fill="none" strokeDasharray="3 3" />
          </svg>
          <div style={{display:'flex',gap:14,fontSize:10.5,color:'var(--text-tertiary)',marginTop:8,flexWrap:'wrap'}}>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:14,height:2,background:'var(--gain)',borderRadius:1}} /> news (92%)</span>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:14,height:2,background:'var(--info)',borderRadius:1}} /> polling (78%)</span>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:14,height:2,borderTop:'2px dashed var(--warning)'}} /> aggregate (84%)</span>
          </div>
          <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:11,color:'var(--text-tertiary)',marginBottom:8}}>Production model</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'var(--bg-elevated)',borderRadius:6,border:'1px solid var(--border-subtle)'}}>
              <div>
                <div className="mono" style={{fontSize:12,color:'var(--text-primary)',fontWeight:500}}>polysent-v3.2</div>
                <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>roberta-large · ft on 38M market-labelled · deployed 8d ago</div>
              </div>
              <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Manage</button>
            </div>
          </div>
        </div>
      </div>

      <AdmSectionHead title="Sources" />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>State</th>
              <th>Kind</th>
              <th>Coverage</th>
              <th className="col-num">Rate</th>
              <th className="col-num">Delay</th>
              <th className="col-num">Accuracy</th>
              <th className="col-num">Weight</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{fontWeight:500}}>{s.name}</div>
                  <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{s.id}{s.err && <> · <span style={{color:'var(--loss-text)'}}>{s.err}</span></>}</div>
                </td>
                <td><S s={s.state} /></td>
                <td><K k={s.kind} /></td>
                <td className="col-secondary" style={{fontSize:11}}>{s.topics}</td>
                <td className="col-num col-secondary">{s.rate}</td>
                <td className="col-num" style={{color: parseInt(s.delay) > 60 || s.delay.includes('min') || s.delay.includes('h') ? 'var(--warning)' : 'var(--text-secondary)'}}>{s.delay}</td>
                <td className="col-num" style={{color: s.acc > 0.8 ? 'var(--gain-text)' : s.acc > 0.6 ? 'var(--text-secondary)' : 'var(--warning)',fontWeight:600}}>{(s.acc * 100).toFixed(0)}%</td>
                <td className="col-num">
                  <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                    <div className="adm-bar" style={{width:50}}><span style={{width:`${s.weight*100}%`}} /></div>
                    <span style={{fontFamily:'Geist Mono, monospace',fontSize:11}}>{s.weight.toFixed(2)}</span>
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
