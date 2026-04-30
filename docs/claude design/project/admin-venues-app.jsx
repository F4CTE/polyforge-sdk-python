/* Polyforge — Admin Venue connectors
   Prediction-market venues: Polymarket, Kalshi, Manifold, PredictIt + data sources.
   State, latency, fills, fee tier, credentials. */

const VENUES = [
  { id: 'polymarket', name: 'Polymarket',  region: 'global', state: 'op',   conn: 'gamma+clob', markets: 1842, vol24h: '$48.2M', fills24h: 14820, p99: 142, feeTier: 'Maker',     uptime30d: 99.97, since: '38d',  cred: 'rotated 12d ago' },
  { id: 'kalshi',     name: 'Kalshi',      region: 'us',     state: 'op',   conn: 'rest+ws',    markets: 824,  vol24h: '$22.4M', fills24h: 4820,  p99: 218, feeTier: 'Tier 3',    uptime30d: 99.92, since: '88d',  cred: 'rotated 4d ago' },
  { id: 'manifold',   name: 'Manifold',    region: 'global', state: 'op',   conn: 'rest',       markets: 412,  vol24h: '$0.8M',  fills24h: 412,   p99: 184, feeTier: 'free',      uptime30d: 99.84, since: '142d', cred: 'rotated 22d ago' },
  { id: 'predictit',  name: 'PredictIt',   region: 'us',     state: 'op',   conn: 'rest',       markets: 84,   vol24h: '$0.4M',  fills24h: 178,   p99: 484, feeTier: '10% wd fee',uptime30d: 99.41, since: '54d',  cred: 'rotated 8d ago' },
  { id: 'metaculus',  name: 'Metaculus',   region: 'global', state: 'op',   conn: 'rest',       markets: 0,    vol24h: '—',      fills24h: 0,     p99: 318, feeTier: 'data only', uptime30d: 99.98, since: '12d',  cred: 'rotated 2d ago', readonly: true },
  { id: 'iem',        name: 'Iowa EM',     region: 'us',     state: 'down', conn: 'rest',       markets: 24,   vol24h: '$0',     fills24h: 0,     p99: 0,   feeTier: 'flat',      uptime30d: 99.42, since: '14m',  cred: 'rotated 18d ago', err: 'http 503 from iem.uiowa.edu' },
  { id: 'augur',      name: 'Augur v2',    region: 'global', state: 'paus', conn: 'rpc',        markets: 0,    vol24h: '$0',     fills24h: 0,     p99: 0,   feeTier: 'gas',       uptime30d: 99.84, since: '7d',   cred: 'rotated 32d ago' },
  { id: 'limitless',  name: 'Limitless',   region: 'global', state: 'plan', conn: '—',          markets: 0,    vol24h: '$0',     fills24h: 0,     p99: 0,   feeTier: '—',         uptime30d: 0,     since: 'Q2 plan', cred: 'pending' },
];

function VS({ s, since, readonly }) {
  if (s === 'op')   return <><AdmPill kind="gain"><span className="adm-dot is-gain" />op</AdmPill>{readonly && <div style={{fontSize:10,color:'var(--text-tertiary)',marginTop:2,fontFamily:'Geist Mono, monospace'}}>read-only</div>}</>;
  if (s === 'down') return <><AdmPill kind="loss">DOWN</AdmPill><div style={{fontSize:10,color:'var(--loss-text)',fontFamily:'Geist Mono, monospace',marginTop:2}}>{since}</div></>;
  if (s === 'paus') return <AdmPill kind="warn">paused</AdmPill>;
  if (s === 'plan') return <AdmPill>planned</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="venues" title="Venue connectors" crumbs={[{ label: 'Platform' }]}>
      <AdmPageHead
        title="Venue connectors"
        sub={<>8 venues · 5 live · 1 down · 24h notional <span className="mono" style={{color:'var(--text-secondary)'}}>$71.8M</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Routing rules</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Add venue</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Connected" value="5 / 8" delta="IEM down · Augur paused" deltaKind="loss" icon="globe" iconKind="is-loss" />
        <AdmStat label="Avg p99 latency" value="269ms" delta="PredictIt 484ms" deltaKind="warn" icon="activity" iconKind="is-info" />
        <AdmStat label="Routing diversity" value="2.4 venues / signal" delta="cross-venue arb on" deltaKind="gain" icon="layers" iconKind="is-info" />
        <AdmStat label="Reconnects · 24h" value="38" delta="IEM 14 · others 24" deltaKind="warn" icon="circle-x" iconKind="is-warn" />
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1.6fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="bar-chart" size={14} /></div>
            <h3 className="adm-card-title">Volume share · 24h</h3>
          </div>
          {VENUES.filter(v => v.fills24h > 0).map(v => {
            const pct = parseFloat(v.vol24h.replace(/[$M]/g,'')) / 50 * 100;
            return (
              <div key={v.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border-subtle)'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                  <span style={{fontSize:13,color:'var(--text-primary)',fontWeight:500}}>{v.name}</span>
                  <span style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{v.region}</span>
                  <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:12,color:'var(--text-secondary)',fontWeight:600}}>{v.vol24h}</span>
                  <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)',minWidth:60,textAlign:'right'}}>{v.fills24h.toLocaleString()} fills</span>
                </div>
                <div className="adm-bar"><span style={{width:`${pct}%`}} /></div>
              </div>
            );
          })}
        </div>
        <div className="adm-card" style={{borderLeft:'2px solid var(--loss)'}}>
          <div className="adm-card-head">
            <div className="adm-card-icon is-loss"><AdmIcon name="shield-alert" size={14} /></div>
            <h3 className="adm-card-title">IEM · incident</h3>
          </div>
          <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <span style={{color:'var(--text-tertiary)'}}>Down for</span>
              <span className="mono" style={{color:'var(--loss-text)',fontWeight:600}}>14m 22s</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <span style={{color:'var(--text-tertiary)'}}>Error</span>
              <span className="mono" style={{fontSize:10.5}}>http 503</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <span style={{color:'var(--text-tertiary)'}}>Reconnects</span>
              <span className="mono" style={{color:'var(--warning)'}}>14 · backoff 32s</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <span style={{color:'var(--text-tertiary)'}}>Open orders</span>
              <span className="mono">82 · pinned to alt</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}>
              <span style={{color:'var(--text-tertiary)'}}>Failover</span>
              <span style={{color:'var(--gain-text)'}}>auto · Polymarket</span>
            </div>
          </div>
          <div style={{display:'flex',gap:6,marginTop:12}}>
            <button className="adm-btn adm-btn-secondary" style={{flex:1}}><AdmIcon name="play" size={12} />Reconnect</button>
            <button className="adm-btn adm-btn-secondary is-loss" style={{flex:1}}><AdmIcon name="circle-x" size={12} />Force off</button>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="lock" size={14} /></div>
            <h3 className="adm-card-title">Credential rotation</h3>
          </div>
          {VENUES.filter(v => v.cred !== 'pending').map((v, i) => {
            const days = parseInt(v.cred.match(/\d+/)?.[0] || 0);
            const overdue = days > 30;
            return (
              <div key={v.id} style={{padding:'9px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,color:'var(--text-primary)',flex:1}}>{v.name}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color: overdue ? 'var(--warning)' : 'var(--text-tertiary)'}}>{v.cred}</span>
                {overdue && <AdmPill kind="warn">stale</AdmPill>}
              </div>
            );
          })}
        </div>
      </div>

      <AdmSectionHead title="All connectors" />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Venue</th>
              <th>State</th>
              <th>Connection</th>
              <th>Region</th>
              <th className="col-num">Markets</th>
              <th className="col-num">24h volume</th>
              <th className="col-num">p99 latency</th>
              <th>Fee tier</th>
              <th className="col-num">30d uptime</th>
              <th className="col-num">Online for</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {VENUES.map(v => (
              <tr key={v.id}>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:24,height:24,borderRadius:6,background:'var(--bg-elevated)',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,color:'var(--text-secondary)',border:'1px solid var(--border-subtle)'}}>{v.name.slice(0,2).toUpperCase()}</div>
                    <span style={{fontWeight:500}}>{v.name}</span>
                  </div>
                </td>
                <td><VS s={v.state} since={v.since} readonly={v.readonly} /></td>
                <td className="col-mono col-secondary">{v.conn}</td>
                <td className="col-secondary" style={{fontSize:11}}>{v.region}</td>
                <td className="col-num col-secondary">{v.markets || '—'}</td>
                <td className="col-num">{v.vol24h}</td>
                <td className="col-num" style={{color: v.p99 > 300 ? 'var(--warning)' : v.p99 === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)'}}>{v.p99 > 0 ? `${v.p99}ms` : '—'}</td>
                <td className="mono col-secondary" style={{fontSize:11}}>{v.feeTier}</td>
                <td className="col-num" style={{color: v.uptime30d > 99.9 ? 'var(--gain-text)' : v.uptime30d > 99 ? 'var(--text-secondary)' : v.uptime30d === 0 ? 'var(--text-tertiary)' : 'var(--warning)'}}>{v.uptime30d > 0 ? `${v.uptime30d}%` : '—'}</td>
                <td className="col-mono col-tertiary" style={{fontSize:11}}>{v.since}</td>
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
