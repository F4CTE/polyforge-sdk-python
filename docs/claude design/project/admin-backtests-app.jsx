/* Polyforge — Admin Backtests
   Backtest jobs, queue health, compute spend, popular timeframes */

const JOBS = [
  { id: 'bt_8814f2', user: 'usr_71c2', name: 'fed-rate-cut-tracker · 12mo',   period: '12mo',bars: '8.7M',  cpu: '24.4s', state: 'done',     started: '14:22:08', brier: 0.118, pnl: '+34.2%' },
  { id: 'bt_8814f1', user: 'usr_8a1d', name: 'oscars-favorite-hedge · 6mo',   period: '6mo', bars: '4.3M',  cpu: '12.1s', state: 'done',     started: '14:21:44', brier: 0.156, pnl: '+12.4%' },
  { id: 'bt_8814f0', user: 'usr_55a3', name: 'nfl-spread-momentum · 3mo',     period: '3mo', bars: '2.2M',  cpu: '7.4s',  state: 'done',     started: '14:21:28', brier: 0.224, pnl: '−4.8%'  },
  { id: 'bt_8814ef', user: 'usr_92ff', name: 'senate-2026-margin · 12mo',     period: '12mo',bars: '8.7M',  cpu: '—',     state: 'running',  started: '14:21:02', brier: null, pnl: null,    progress: 64 },
  { id: 'bt_8814ee', user: 'usr_44d8', name: 'nyc-mayoral-poll-fade · 90d',   period: '90d', bars: '2.1M',  cpu: '—',     state: 'running',  started: '14:20:48', brier: null, pnl: null,    progress: 41 },
  { id: 'bt_8814ed', user: 'usr_4a91', name: 'thin-market-sniper · 30d',      period: '30d', bars: '0.7M',  cpu: '—',     state: 'queued',   started: '—',         brier: null, pnl: null    },
  { id: 'bt_8814ec', user: 'usr_3b22', name: 'fed-rate-cut-tracker · stress', period: '5y',  bars: '43.2M', cpu: '—',     state: 'queued',   started: '—',         brier: null, pnl: null    },
  { id: 'bt_8814eb', user: 'usr_77c5', name: 'cpi-print-laddered · 12mo',     period: '12mo',bars: '8.7M',  cpu: '38.4s', state: 'done',     started: '14:18:22', brier: 0.184, pnl: '+4.2%'  },
  { id: 'bt_8814ea', user: 'usr_5b18', name: 'congress-vote-pulse · 14d',     period: '14d', bars: '0.3M',  cpu: '2.1s',  state: 'done',     started: '14:17:48', brier: 0.182, pnl: '+2.1%'  },
  { id: 'bt_8814e9', user: 'usr_66b4', name: 'scotus-decision-pulse · 6mo',   period: '6mo', bars: '4.3M',  cpu: '—',     state: 'failed',   started: '14:17:14', brier: null, pnl: null,    err: 'oom' },
  { id: 'bt_8814e8', user: 'usr_8a1c', name: 'doge-tweet-fader · 30d · param', period: '30d', bars: '0.7M',  cpu: '4.4s',  state: 'done',     started: '14:16:48', brier: 0.298, pnl: '−18.4%' },
  { id: 'bt_8814e7', user: 'usr_8a1e', name: 'kalshi-spread-grid · 90d',      period: '90d', bars: '2.1M',  cpu: '—',     state: 'failed',   started: '14:16:22', brier: null, pnl: null,    err: 'data_gap' },
];

function StatePill({ s }) {
  if (s === 'done')    return <AdmPill kind="gain">DONE</AdmPill>;
  if (s === 'running') return <AdmPill kind="info"><span className="adm-dot is-pulse is-info" />RUNNING</AdmPill>;
  if (s === 'queued')  return <AdmPill kind="warn">QUEUED</AdmPill>;
  if (s === 'failed')  return <AdmPill kind="loss">FAILED</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="backtests" title="Backtests" crumbs={[{ label: 'Trading' }]}>
      <AdmPageHead
        title="Backtests"
        sub={<>2,841 runs in last 24h · 38 active workers · queue depth 12</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Worker pool</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="play" size={12} />Drain queue</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Runs · 24h" value="2,841" delta="+18.4%" deltaKind="gain" icon="flask" iconKind="is-info" />
        <AdmStat label="Avg run time" value="14.2s" delta="p99 184s" icon="clock" iconKind="is-info" />
        <AdmStat label="Queue depth" value="12" delta="2 stale > 2min" deltaKind="warn" icon="layers" iconKind="is-warn" />
        <AdmStat label="Compute · 24h" value="$184.20" delta="38 workers · c5.2xl" icon="dollar" iconKind="is-info" />
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Worker pool · live</h3>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(8, 1fr)',gap:6,marginBottom:14}}>
            {Array.from({length:38}).map((_, i) => {
              const states = ['busy','busy','busy','busy','busy','idle','busy','busy','busy','busy','busy','idle','busy','busy','busy','busy','idle','busy','busy','busy','busy','busy','idle','busy','busy','busy','busy','busy','idle','busy','busy','busy','busy','idle','busy','busy','warn','idle'];
              const s = states[i];
              const c = s === 'busy' ? 'var(--accent-default)' : s === 'warn' ? 'var(--warning)' : 'var(--bg-elevated)';
              return <div key={i} style={{aspectRatio:'1',background:c,borderRadius:3,border:'1px solid var(--border-subtle)'}} />;
            })}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,fontFamily:'Geist Mono, monospace'}}>
            <span><span style={{color:'var(--accent-text)',fontWeight:600}}>30</span> <span style={{color:'var(--text-tertiary)'}}>busy</span></span>
            <span><span style={{color:'var(--text-secondary)',fontWeight:600}}>7</span> <span style={{color:'var(--text-tertiary)'}}>idle</span></span>
            <span><span style={{color:'var(--warning)',fontWeight:600}}>1</span> <span style={{color:'var(--text-tertiary)'}}>stalled</span></span>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="clock" size={14} /></div>
            <h3 className="adm-card-title">Run time · last 24h</h3>
          </div>
          <svg viewBox="0 0 360 120" style={{width:'100%',height:120}}>
            <defs>
              <linearGradient id="bt-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20,40,60,80,100].map(y => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            <path d="M 0 80 L 30 78 L 60 72 L 90 70 L 120 64 L 150 62 L 180 56 L 210 48 L 240 42 L 270 38 L 300 36 L 330 32 L 360 30 L 360 120 L 0 120 Z" fill="url(#bt-area)" />
            <path d="M 0 80 L 30 78 L 60 72 L 90 70 L 120 64 L 150 62 L 180 56 L 210 48 L 240 42 L 270 38 L 300 36 L 330 32 L 360 30" stroke="var(--accent-default)" strokeWidth="1.6" fill="none" />
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:12,paddingTop:12,borderTop:'1px solid var(--border-subtle)',fontSize:11,fontFamily:'Geist Mono, monospace'}}>
            <div><span style={{color:'var(--text-tertiary)'}}>p50</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>8s</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>p95</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>42s</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>p99</span> <span style={{color:'var(--warning)',fontWeight:600,marginLeft:4}}>184s</span></div>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="bar-chart" size={14} /></div>
            <h3 className="adm-card-title">Period mix · 7d</h3>
          </div>
          {[
            { p: '7d',   pct: 8,  n: 224 },
            { p: '14d',  pct: 12, n: 342 },
            { p: '30d',  pct: 28, n: 798 },
            { p: '90d',  pct: 22, n: 624 },
            { p: '6mo',  pct: 14, n: 398 },
            { p: '1y',   pct: 13, n: 372 },
            { p: '5y',   pct: 3,  n: 84 },
          ].map(r => (
            <div key={r.p} style={{padding:'7px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:11.5,color:'var(--text-primary)',width:36}}>{r.p}</span>
                <div className="adm-bar" style={{flex:1}}><span style={{width:`${r.pct*3}%`}} /></div>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)',minWidth:42,textAlign:'right'}}>{r.n}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Recent jobs" action={<span className="adm-pill has-dot is-pulse is-info">LIVE</span>} />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Job ID, user, strategy…" />
          </div>
          <AdmFilter active count="2,841">All</AdmFilter>
          <AdmFilter count={38}>Running</AdmFilter>
          <AdmFilter count={12}>Queued</AdmFilter>
          <AdmFilter count={48}>Failed</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>State</th>
              <th>User</th>
              <th>Period</th>
              <th className="col-num">Bars</th>
              <th className="col-num">CPU time</th>
              <th>Started</th>
              <th className="col-num">Brier</th>
              <th className="col-num">Net P&L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map(j => (
              <tr key={j.id}>
                <td>
                  <span className="mono" style={{color:'var(--accent-text)',fontSize:11}}>{j.id}</span>
                  <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{j.name}</div>
                </td>
                <td>
                  <StatePill s={j.state} />
                  {j.progress != null && (
                    <div style={{marginTop:4,width:80}}>
                      <div className="adm-bar"><span style={{width:`${j.progress}%`}} /></div>
                      <div style={{fontSize:10,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',marginTop:2}}>{j.progress}%</div>
                    </div>
                  )}
                  {j.err && <div style={{fontSize:10,color:'var(--loss-text)',fontFamily:'Geist Mono, monospace',marginTop:2}}>{j.err}</div>}
                </td>
                <td><a className="mono" href="Admin-User-Detail.html" style={{color:'var(--accent-text)',fontSize:11,textDecoration:'none'}}>{j.user}</a></td>
                <td className="col-mono col-secondary">{j.period}</td>
                <td className="col-num col-secondary">{j.bars}</td>
                <td className="col-num col-secondary">{j.cpu}</td>
                <td className="col-mono col-tertiary" style={{fontSize:11}}>{j.started}</td>
                <td className="col-num">{j.brier != null ? <span style={{color:j.brier < 0.18 ? 'var(--gain-text)' : j.brier > 0.25 ? 'var(--loss-text)' : 'var(--text-secondary)',fontWeight:600}}>{j.brier.toFixed(3)}</span> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
                <td className="col-num">{j.pnl != null ? <span style={{color:j.pnl.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)',fontWeight:600}}>{j.pnl}</span> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
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
