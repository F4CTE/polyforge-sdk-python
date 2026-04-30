/* Polyforge — Admin Trades & fills
   Real-time fill ticker for prediction-market YES/NO shares.
   Venue routing across Polymarket / Kalshi / off-platform sources, latency monitor. */

const TRADES = [
  { id: 'TX-92177', t: '00:00:09.124', side: 'YES',  mkt: 'Fed cuts in March',          venue: 'Polymarket', qty: '1,420 shares', px: '0.34¢', state: 'FILL',   fees: '$0.84', latency: '142ms', user: 'usr_71c2', strat: 'fed-rate-cut-tracker',  pnl: '+$184' },
  { id: 'TX-92176', t: '00:00:08.412', side: 'NO',   mkt: 'NYC mayor — Mamdani wins',   venue: 'Polymarket', qty: '4,200 shares', px: '0.62¢', state: 'FILL',   fees: '$0.27', latency: '118ms', user: 'usr_8a1d', strat: 'senate-2026-margin',    pnl: '+$22'  },
  { id: 'TX-92175', t: '00:00:07.882', side: 'YES',  mkt: 'CPI < 3.0% in March',        venue: 'Kalshi',     qty: '1,200 shares', px: '0.41¢', state: 'PART',   fees: '$0.18', latency: '224ms', user: 'usr_55a3', strat: 'cpi-print-fade',        pnl: '−$48'  },
  { id: 'TX-92174', t: '00:00:06.219', side: 'NO',   mkt: 'Oscar — best picture: A',    venue: 'Polymarket', qty: '1,800 shares', px: '0.18¢', state: 'FILL',   fees: '$0.36', latency: '94ms',  user: 'usr_92ff', strat: 'oscar-best-picture',    pnl: '+$84'  },
  { id: 'TX-92173', t: '00:00:05.741', side: 'YES',  mkt: 'Lakers make playoffs',       venue: 'Kalshi',     qty: '6,000 shares', px: '0.54¢', state: 'FILL',   fees: '$1.21', latency: '128ms', user: 'usr_44d8', strat: 'nba-injury-react',      pnl: '+$94'  },
  { id: 'TX-92172', t: '00:00:04.331', side: 'YES',  mkt: 'BTC > $100k by EOY',         venue: 'Polymarket', qty: '3,100 shares', px: '0.71¢', state: 'FILL',   fees: '$0.42', latency: '152ms', user: 'usr_4a91', strat: 'rumor-frontrun',        pnl: '−$12'  },
  { id: 'TX-92171', t: '00:00:03.802', side: 'NO',   mkt: 'Ethereum ETF approved Q1',   venue: 'Kalshi',     qty: '8,500 shares', px: '0.38¢', state: 'CANC',   fees: '$0',    latency: '—',     user: 'usr_8a1f', strat: 'manual',                pnl: '$0'    },
  { id: 'TX-92170', t: '00:00:02.142', side: 'YES',  mkt: 'NFL — Chiefs cover spread',  venue: 'Kalshi',     qty: '1,800 shares', px: '0.48¢', state: 'FILL',   fees: '$0.94', latency: '136ms', user: 'usr_3b22', strat: 'nfl-spread-arb',        pnl: '+$54'  },
  { id: 'TX-92169', t: '00:00:01.418', side: 'NO',   mkt: 'SCOTUS — TikTok ban upheld', venue: 'Polymarket', qty: '8,000 shares', px: '0.22¢', state: 'FILL',   fees: '$0.55', latency: '108ms', user: 'usr_77c5', strat: 'scotus-decision-pulse', pnl: '−$44'  },
  { id: 'TX-92168', t: '23:59:59.812', side: 'YES',  mkt: 'Fed cuts in March',          venue: 'Polymarket', qty: '600 shares',   px: '0.34¢', state: 'REJECT', fees: '$0',    latency: '—',     user: 'usr_5b18', strat: 'orderbook-imbalance',   pnl: '$0',   reject: 'insufficient_balance' },
  { id: 'TX-92167', t: '23:59:59.114', side: 'YES',  mkt: 'CPI < 3.0% in March',        venue: 'Polymarket', qty: '2,500 shares', px: '0.41¢', state: 'FILL',   fees: '$0.21', latency: '218ms', user: 'usr_66b4', strat: 'kalshi-spread-grid',    pnl: '+$11'  },
  { id: 'TX-92166', t: '23:59:58.422', side: 'NO',   mkt: 'Doge to $1 in 2026',         venue: 'Polymarket', qty: '2,200 shares', px: '0.08¢', state: 'FILL',   fees: '$0.44', latency: '144ms', user: 'usr_8a1c', strat: 'manual',                pnl: '+$8'   },
  { id: 'TX-92165', t: '23:59:57.811', side: 'YES',  mkt: 'NYC mayor — Mamdani wins',   venue: 'Polymarket', qty: '1,200 shares', px: '0.62¢', state: 'FILL',   fees: '$0.16', latency: '124ms', user: 'usr_8a1e', strat: 'kalshi-spread-grid',    pnl: '−$4'   },
  { id: 'TX-92164', t: '23:59:56.918', side: 'NO',   mkt: 'NBA — Celtics over/under',   venue: 'Kalshi',     qty: '600 shares',   px: '0.51¢', state: 'PART',   fees: '$0.09', latency: '244ms', user: 'usr_22a7', strat: 'manual',                pnl: '+$2'   },
  { id: 'TX-92163', t: '23:59:55.441', side: 'YES',  mkt: 'Senate — D majority 2026',   venue: 'Polymarket', qty: '6,000 shares', px: '0.46¢', state: 'FILL',   fees: '$0.61', latency: '116ms', user: 'usr_71c2', strat: 'senate-2026-margin',    pnl: '+$36'  },
];

function StateCell({ s, reject }) {
  const map = {
    FILL:   { kind: 'gain' },
    PART:   { kind: 'warn' },
    CANC:   { kind: '' },
    REJECT: { kind: 'loss' },
  };
  return (
    <div>
      <AdmPill kind={map[s].kind}>{s}</AdmPill>
      {reject && <div style={{fontSize:10,color:'var(--loss-text)',fontFamily:'Geist Mono, monospace',marginTop:2}}>{reject}</div>}
    </div>
  );
}

function VenueRoutingBar() {
  const data = [
    { v: 'Polymarket',   pct: 68.4, fills: 6818, color: 'var(--accent-default)' },
    { v: 'Kalshi',       pct: 24.7, fills: 2462, color: 'var(--info)' },
    { v: 'Manifold',     pct: 4.2,  fills: 418,  color: 'var(--gain)' },
    { v: 'PredictIt',    pct: 1.8,  fills: 178,  color: 'var(--warning)' },
    { v: 'Off-platform', pct: 0.9,  fills: 88,   color: 'var(--text-tertiary)' },
  ];
  return (
    <div>
      <div style={{display:'flex',height:8,borderRadius:4,overflow:'hidden',marginBottom:14,border:'1px solid var(--border-subtle)'}}>
        {data.map(d => <div key={d.v} style={{width:`${d.pct}%`,background:d.color}} />)}
      </div>
      {data.map(d => (
        <div key={d.v} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:12}}>
          <span style={{width:8,height:8,borderRadius:2,background:d.color}} />
          <span style={{color:'var(--text-primary)',flex:1}}>{d.v}</span>
          <span style={{fontFamily:'Geist Mono, monospace',color:'var(--text-secondary)'}}>{d.fills.toLocaleString()}</span>
          <span style={{fontFamily:'Geist Mono, monospace',color:'var(--text-tertiary)',minWidth:42,textAlign:'right'}}>{d.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function LatencyHistogram() {
  const buckets = [
    { range: '0-50',    count: 80,   pct: 4 },
    { range: '50-100',  count: 1240, pct: 62 },
    { range: '100-150', count: 1820, pct: 91 },
    { range: '150-200', count: 920,  pct: 46 },
    { range: '200-300', count: 380,  pct: 19 },
    { range: '300-500', count: 84,   pct: 4 },
    { range: '500+',    count: 18,   pct: 1, hot: true },
  ];
  return (
    <div>
      <div style={{display:'flex',gap:4,alignItems:'flex-end',height:80,marginBottom:8}}>
        {buckets.map(b => (
          <div key={b.range} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <div style={{width:'100%',height:`${b.pct}%`,background:b.hot ? 'var(--loss)' : 'var(--accent-default)',borderRadius:'2px 2px 0 0',minHeight:2}} />
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:4,fontSize:10,fontFamily:'Geist Mono, monospace',color:'var(--text-tertiary)'}}>
        {buckets.map(b => (
          <div key={b.range} style={{flex:1,textAlign:'center'}}>{b.range}</div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:14,paddingTop:14,borderTop:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontSize:11}}>
        <div><span style={{color:'var(--text-tertiary)'}}>p50</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>118ms</span></div>
        <div><span style={{color:'var(--text-tertiary)'}}>p95</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>224ms</span></div>
        <div><span style={{color:'var(--text-tertiary)'}}>p99</span> <span style={{color:'var(--warning)',fontWeight:600,marginLeft:4}}>418ms</span></div>
        <div><span style={{color:'var(--text-tertiary)'}}>max</span> <span style={{color:'var(--loss-text)',fontWeight:600,marginLeft:4}}>1.2s</span></div>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = React.useState('all');
  const [paused, setPaused] = React.useState(false);

  const counts = {
    all:    9942,
    fill:   8854,
    part:   642,
    cancel: 388,
    reject: 58,
  };

  return (
    <AdmShell active="orders" title="Trades & fills" crumbs={[{ label: 'Forecasting' }]} actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export CSV</button>
    }>
      <AdmPageHead
        title="Trades & fills"
        sub={<>{counts.all.toLocaleString()} trades · {counts.all - counts.cancel - counts.reject} executed · 30d notional <span className="mono" style={{color:'var(--text-secondary)'}}>$182.4M</span></>}
        actions={<>
          <button className={`adm-btn ${paused ? 'adm-btn-secondary' : 'adm-btn-primary'}`} onClick={()=>setPaused(!paused)}>
            <span className={`adm-dot ${paused ? '' : 'is-gain'}`} style={{boxShadow:paused?'none':undefined}} />
            {paused ? 'Resume stream' : 'Live stream'}
          </button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Fill rate · 24h" value="89.1%" delta="+0.4%" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="Avg latency" value="142ms" delta="p99 418ms" icon="activity" iconKind="is-info" />
        <AdmStat label="Reject rate" value="0.58%" delta="+0.12% · balance" deltaKind="loss" icon="circle-x" iconKind="is-loss" />
        <AdmStat label="Slippage · top markets" value="0.4¢" delta="vs 0.6¢ avg" deltaKind="gain" icon="trending" iconKind="is-gain" />
      </div>

      <div className="adm-grid-3" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="globe" size={14} /></div>
            <h3 className="adm-card-title">Venue routing · 24h</h3>
          </div>
          <VenueRoutingBar />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Latency distribution</h3>
            <span style={{marginLeft:'auto',fontSize:10,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>ms</span>
          </div>
          <LatencyHistogram />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="circle-x" size={14} /></div>
            <h3 className="adm-card-title">Reject reasons · 24h</h3>
          </div>
          {[
            { k: 'insufficient_balance',    n: 38, pct: 65.5 },
            { k: 'price_out_of_range',      n: 9,  pct: 15.5 },
            { k: 'venue_rate_limit',        n: 5,  pct: 8.6 },
            { k: 'market_resolved',         n: 4,  pct: 6.9 },
            { k: 'kill_switch_active',      n: 2,  pct: 3.4 },
          ].map((r, i) => (
            <div key={r.k} style={{padding:'8px 0',borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span className="mono" style={{fontSize:11.5,color:'var(--text-primary)'}}>{r.k}</span>
                <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{r.n}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)',minWidth:36,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar is-loss"><span style={{width:`${r.pct}%`}} /></div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Live trade ticker" action={
        <span className="adm-pill has-dot is-pulse is-gain">{paused ? 'PAUSED' : 'LIVE'}</span>
      } />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Trade ID, user, market, venue…" />
          </div>
          <AdmFilter active={tab==='all'}    count={counts.all.toLocaleString()}    onClick={()=>setTab('all')}>All</AdmFilter>
          <AdmFilter active={tab==='fill'}   count={counts.fill.toLocaleString()}   onClick={()=>setTab('fill')}>Filled</AdmFilter>
          <AdmFilter active={tab==='part'}   count={counts.part}   onClick={()=>setTab('part')}>Partial</AdmFilter>
          <AdmFilter active={tab==='cancel'} count={counts.cancel} onClick={()=>setTab('cancel')}>Cancelled</AdmFilter>
          <AdmFilter active={tab==='reject'} count={counts.reject} onClick={()=>setTab('reject')}>Rejected</AdmFilter>
          <button className="adm-filter"><AdmIcon name="filter" size={11} />Venue · all</button>
          <button className="adm-filter"><AdmIcon name="filter" size={11} />Market · all</button>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Trade</th>
              <th>Side</th>
              <th>Market · Venue</th>
              <th className="col-num">Qty</th>
              <th className="col-num">Price</th>
              <th>State</th>
              <th className="col-num">Latency</th>
              <th>User · Block</th>
              <th className="col-num">P&L</th>
            </tr>
          </thead>
          <tbody>
            {TRADES.map((o) => (
              <tr key={o.id}>
                <td className="col-mono col-tertiary" style={{fontSize:11}}>{o.t}</td>
                <td className="col-id">{o.id}</td>
                <td><AdmPill kind={o.side === 'YES' ? 'gain' : 'loss'}>{o.side}</AdmPill></td>
                <td>
                  <span style={{fontWeight:500,fontSize:12}}>{o.mkt}</span>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{o.venue}</div>
                </td>
                <td className="col-num">{o.qty}</td>
                <td className="col-num">{o.px}</td>
                <td><StateCell s={o.state} reject={o.reject} /></td>
                <td className="col-num col-secondary" style={{color: parseInt(o.latency) > 200 ? 'var(--warning)' : 'var(--text-secondary)'}}>{o.latency}</td>
                <td>
                  <a href="Admin-User-Detail.html" className="mono" style={{color:'var(--accent-text)',textDecoration:'none',fontSize:11}}>{o.user}</a>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{o.strat}</div>
                </td>
                <td className="col-num" style={{color: o.pnl.startsWith('+') ? 'var(--gain-text)' : o.pnl.startsWith('−') ? 'var(--loss-text)' : 'var(--text-tertiary)', fontWeight:600}}>{o.pnl}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span>showing 15 most recent · {counts.all.toLocaleString()} total · auto-refresh 2s</span>
          <div className="adm-pagination">
            <button><AdmIcon name="chevron-left" size={11} /></button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>…</button>
            <button>663</button>
            <button><AdmIcon name="chevron-right" size={11} /></button>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
