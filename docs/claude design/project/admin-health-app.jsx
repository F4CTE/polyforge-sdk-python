/* Polyforge — Admin System Health
   Service grid, latency heatmap, error budgets, recent incidents */

const SERVICES = [
  { id: 'gateway',     name: 'API gateway',         tier: 't0', state: 'op',   p50: 4,  p99: 22,  err: 0.012, qps: 4820, slo: 99.97 },
  { id: 'orders',      name: 'Order router',        tier: 't0', state: 'op',   p50: 8,  p99: 28,  err: 0.041, qps: 1420, slo: 99.94 },
  { id: 'matching',    name: 'Matching engine',     tier: 't0', state: 'op',   p50: 2,  p99: 12,  err: 0.002, qps: 14820,slo: 99.99 },
  { id: 'risk',        name: 'Risk engine',         tier: 't0', state: 'op',   p50: 6,  p99: 18,  err: 0.008, qps: 4820, slo: 99.98 },
  { id: 'pricing',     name: 'Pricing · md',        tier: 't0', state: 'op',   p50: 3,  p99: 14,  err: 0.004, qps: 24820,slo: 99.99 },
  { id: 'sentiment',   name: 'Sentiment ingest',    tier: 't1', state: 'deg',  p50: 142,p99: 1820,err: 2.4,   qps: 184,  slo: 99.5  },
  { id: 'backtest',    name: 'Backtest workers',    tier: 't1', state: 'op',   p50: 8420,p99: 18400,err: 1.2,  qps: 38,   slo: 99.0  },
  { id: 'agent',       name: 'Agent gateway',       tier: 't1', state: 'op',   p50: 384,p99: 1840,err: 0.42,  qps: 412,  slo: 99.5  },
  { id: 'auth',        name: 'Auth service',        tier: 't0', state: 'op',   p50: 12, p99: 48,  err: 0.014, qps: 1280, slo: 99.97 },
  { id: 'kyc',         name: 'KYC pipeline',        tier: 't2', state: 'op',   p50: 184,p99: 940, err: 0.84,  qps: 22,   slo: 99.0  },
  { id: 'notify',      name: 'Notifications',       tier: 't2', state: 'op',   p50: 22, p99: 142, err: 0.18,  qps: 412,  slo: 99.5  },
  { id: 'webhooks',    name: 'Webhook delivery',    tier: 't2', state: 'op',   p50: 84, p99: 412, err: 1.4,   qps: 184,  slo: 99.0  },
  { id: 'reports',     name: 'Report generator',    tier: 't2', state: 'op',   p50: 1240,p99: 4820,err: 0.4,   qps: 4,    slo: 99.0  },
  { id: 'archive',     name: 'Cold archive',        tier: 't2', state: 'op',   p50: 184,p99: 8200,err: 0,     qps: 12,   slo: 98.0  },
  { id: 'ws',          name: 'WebSocket fan-out',   tier: 't0', state: 'op',   p50: 2,  p99: 8,   err: 0.001, qps: 38400,slo: 99.99 },
  { id: 'predictit',   name: 'PredictIt connector', tier: 't1', state: 'down', p50: 0,  p99: 0,   err: 100,   qps: 0,    slo: 99.0, since: '14:22' },
];

function StatePill({ s }) {
  if (s === 'op')   return <AdmPill kind="gain"><span className="adm-dot is-gain" />op</AdmPill>;
  if (s === 'deg')  return <AdmPill kind="warn"><span className="adm-dot is-warn" />deg</AdmPill>;
  if (s === 'down') return <AdmPill kind="loss">DOWN</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function ErrorBudget({ slo, used }) {
  const remaining = 100 - used;
  const c = used > 80 ? 'var(--loss)' : used > 50 ? 'var(--warning)' : 'var(--gain)';
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:4}}>
        <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{slo}%</span>
        <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:11,color:c,fontWeight:600}}>{used}% used</span>
      </div>
      <div className="adm-bar" style={{height:5}}><span style={{width:`${used}%`,background:c}} /></div>
    </div>
  );
}

function LatencyHeatmap() {
  // 16 services × 24 hours
  const cols = 24;
  const rng = (seed) => { let s = seed; return () => { s = (s*9301+49297)%233280; return s/233280; }; };
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',marginBottom:6,paddingLeft:120}}>
        <span>−24h</span><span>−18h</span><span>−12h</span><span>−6h</span><span>now</span>
      </div>
      {SERVICES.slice(0, 12).map((s, i) => {
        const r = rng(s.id.length * 17 + i);
        return (
          <div key={s.id} style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:8,marginBottom:3,alignItems:'center'}}>
            <div className="mono" style={{fontSize:10.5,color:'var(--text-secondary)'}}>{s.name}</div>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${cols}, 1fr)`,gap:2,height:14}}>
              {Array.from({length:cols}).map((_, j) => {
                const v = r();
                let bg;
                if (s.state === 'down' && j >= 22) bg = 'var(--loss)';
                else if (s.state === 'deg' && j >= 18) bg = v > 0.4 ? 'var(--warning)' : 'color-mix(in srgb, var(--warning) 40%, transparent)';
                else if (v < 0.04) bg = 'var(--warning)';
                else if (v < 0.08) bg = 'color-mix(in srgb, var(--warning) 40%, transparent)';
                else if (v < 0.4)  bg = 'color-mix(in srgb, var(--gain) 60%, transparent)';
                else if (v < 0.8)  bg = 'color-mix(in srgb, var(--gain) 30%, transparent)';
                else               bg = 'color-mix(in srgb, var(--gain) 14%, transparent)';
                return <div key={j} style={{background:bg,borderRadius:1}} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const INCIDENTS = [
  { id: 'INC-2014', t: '14:22', sev: 'crit', svc: 'PredictIt connector',  title: 'Venue connector lost ws · orders re-routed', state: 'investigating', dur: '14m' },
  { id: 'INC-2013', t: '14:14', sev: 'high', svc: 'Sentiment ingest', title: 'p99 latency 12× baseline · upstream rate-limit', state: 'mitigated',     dur: '8m' },
  { id: 'INC-2012', t: '13:48', sev: 'low',  svc: 'Webhook delivery', title: 'Retry surge · 1.4% error rate',                  state: 'resolved',      dur: '12m' },
  { id: 'INC-2011', t: '11:02', sev: 'high', svc: 'Backtest workers', title: 'Worker pool oom · 2 nodes restarted',            state: 'resolved',      dur: '4m' },
];

function App() {
  return (
    <AdmShell active="health" title="System health" crumbs={[{ label: 'Platform' }]}>
      <AdmPageHead
        title="System health"
        sub={<>16 services · 14 t0/t1 · uptime <span className="mono" style={{color:'var(--text-secondary)'}}>99.972%</span> · 1 active incident</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="newspaper" size={12} />Public status</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Runbooks</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Operational" value="14 / 16" delta="2 degraded" deltaKind="warn" icon="check" iconKind="is-gain" />
        <AdmStat label="API success rate" value="99.984%" delta="last 60min" deltaKind="gain" icon="activity" iconKind="is-gain" />
        <AdmStat label="Open incidents" value="1" delta="PredictIt · 14m · investigating" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
        <AdmStat label="Error budget · gateway" value="38%" delta="62% remaining · 7d" deltaKind="warn" icon="pie" iconKind="is-warn" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Latency heatmap · 24h</h3>
            <span style={{marginLeft:'auto',fontSize:10,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>p99</span>
          </div>
          <LatencyHeatmap />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-loss"><AdmIcon name="shield-alert" size={14} /></div>
            <h3 className="adm-card-title">Recent incidents · 24h</h3>
          </div>
          {INCIDENTS.map((inc, i) => (
            <div key={inc.id} style={{padding:'12px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{inc.t}</span>
                <SevPill s={inc.sev} />
                <span className="mono" style={{fontSize:11,color:'var(--accent-text)'}}>{inc.id}</span>
                <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)'}}>{inc.dur}</span>
              </div>
              <div style={{fontSize:12.5,color:'var(--text-primary)',marginBottom:4}}>{inc.title}</div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:10.5,color:'var(--text-tertiary)'}}>
                <span className="mono">{inc.svc}</span>
                <span>·</span>
                {inc.state === 'investigating' && <span style={{color:'var(--loss-text)',fontWeight:600}}>● investigating</span>}
                {inc.state === 'mitigated'     && <span style={{color:'var(--warning)',fontWeight:600}}>○ mitigated</span>}
                {inc.state === 'resolved'      && <span style={{color:'var(--gain-text)',fontWeight:600}}>✓ resolved</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Service grid" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <AdmFilter active count={SERVICES.length}>All</AdmFilter>
          <AdmFilter count={6}>Tier 0</AdmFilter>
          <AdmFilter count={4}>Tier 1</AdmFilter>
          <AdmFilter count={6}>Tier 2</AdmFilter>
          <AdmFilter count={1}>Degraded</AdmFilter>
          <AdmFilter count={1}>Down</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Tier</th>
              <th>State</th>
              <th className="col-num">QPS</th>
              <th className="col-num">p50</th>
              <th className="col-num">p99</th>
              <th className="col-num">Err %</th>
              <th>SLO · budget</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map(s => (
              <tr key={s.id}>
                <td>
                  <span style={{fontWeight:500}}>{s.name}</span>
                  <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{s.id}{s.since && <> · since {s.since}</>}</div>
                </td>
                <td><span className="mono" style={{fontSize:10.5,padding:'2px 6px',borderRadius:4,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)'}}>{s.tier}</span></td>
                <td><StatePill s={s.state} /></td>
                <td className="col-num col-secondary">{s.qps.toLocaleString()}</td>
                <td className="col-num col-secondary">{s.p50}ms</td>
                <td className="col-num" style={{color: s.p99 > 1000 ? 'var(--warning)' : 'var(--text-secondary)'}}>{s.p99}ms</td>
                <td className="col-num" style={{color: s.err > 1 ? 'var(--loss-text)' : s.err > 0.1 ? 'var(--warning)' : 'var(--text-secondary)',fontWeight: s.err > 0.1 ? 600 : 400}}>{s.err.toFixed(2)}%</td>
                <td style={{minWidth:160}}><ErrorBudget slo={s.slo} used={Math.min(96, Math.round(s.err * 24 + 8))} /></td>
                <td className="col-actions"><button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdmShell>
  );
}

function SevPill({ s }) {
  if (s === 'crit') return <AdmPill kind="loss">crit</AdmPill>;
  if (s === 'high') return <AdmPill kind="warn">high</AdmPill>;
  if (s === 'low')  return <AdmPill kind="info">low</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
