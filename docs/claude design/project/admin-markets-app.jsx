/* Polyforge — Admin Markets
   Prediction-market events tracked across venues.
   Liquidity, spread, depth, resolution state. */

const MARKETS = [
  { sym: 'fed-mar-cut',     title: 'Fed cuts rates in March',           cat: 'macro',    venues: 4, vol24h: '$48.2M', users: 2841, oi: '$184M', spread: '0.4¢', depth: '$8.2M', resolves: 'Mar 19',  yes: '34¢',  state: 'live' },
  { sym: 'nyc-mayor-26',    title: 'Mamdani wins NYC mayor 2026',       cat: 'politics', venues: 3, vol24h: '$22.4M', users: 1912, oi: '$92M',  spread: '0.6¢', depth: '$4.8M', resolves: 'Nov 5',   yes: '62¢',  state: 'live' },
  { sym: 'cpi-mar-low',     title: 'CPI < 3.0% for March print',        cat: 'macro',    venues: 3, vol24h: '$18.1M', users: 1684, oi: '$48M',  spread: '0.2¢', depth: '$12.4M',resolves: 'Apr 10',  yes: '41¢',  state: 'live' },
  { sym: 'oscar-bp-26',     title: 'Best Picture: A Real Pain',         cat: 'culture',  venues: 2, vol24h: '$12.8M', users: 1422, oi: '$24M',  spread: '0.3¢', depth: '$7.2M', resolves: 'Mar 2',   yes: '18¢',  state: 'live' },
  { sym: 'btc-100k-eoy',    title: 'BTC > $100k by EOY',                cat: 'crypto',   venues: 4, vol24h: '$8.4M',  users: 1124, oi: '$28M',  spread: '0.5¢', depth: '$1.2M', resolves: 'Dec 31',  yes: '71¢',  state: 'live' },
  { sym: 'nfl-chiefs-cov',  title: 'Chiefs cover spread (Sun)',         cat: 'sports',   venues: 2, vol24h: '$6.2M',  users: 942,  oi: '—',     spread: '0.8¢', depth: '$2.4M', resolves: 'Sun 8pm', yes: '54¢',  state: 'live' },
  { sym: 'eth-etf-q1',      title: 'Ethereum spot ETF approved Q1',     cat: 'crypto',   venues: 3, vol24h: '$2.1M',  users: 412,  oi: '$8M',   spread: '1.2¢', depth: '$0.4M', resolves: 'Mar 31',  yes: '38¢',  state: 'live' },
  { sym: 'scotus-tiktok',   title: 'SCOTUS upholds TikTok ban',         cat: 'politics', venues: 3, vol24h: '$1.8M',  users: 388,  oi: '$4M',   spread: '0.9¢', depth: '$0.6M', resolves: 'Apr 15',  yes: '22¢',  state: 'live' },
  { sym: 'doge-1-26',       title: 'DOGE reaches $1 in 2026',           cat: 'meme',     venues: 4, vol24h: '$1.4M',  users: 622,  oi: '$2M',   spread: '0.6¢', depth: '$0.8M', resolves: 'Dec 31',  yes: '8¢',   state: 'live' },
  { sym: 'sen-d-26',        title: 'Dems hold Senate majority 2026',    cat: 'politics', venues: 3, vol24h: '$0.9M',  users: 284,  oi: '$1M',   spread: '1.4¢', depth: '$0.3M', resolves: 'Nov 5',   yes: '46¢',  state: 'degraded' },
  { sym: 'lakers-poff',     title: 'Lakers make playoffs',              cat: 'sports',   venues: 2, vol24h: '$0.4M',  users: 142,  oi: '—',     spread: '2.0¢', depth: '$0.1M', resolves: 'Apr 14',  yes: '54¢',  state: 'live' },
  { sym: 'gpt5-feb',        title: 'OpenAI ships GPT-5 by Feb 28',      cat: 'tech',     venues: 1, vol24h: '$0',     users: 0,    oi: '—',     spread: '—',    depth: '—',     resolves: 'Feb 28',  yes: '—',    state: 'halted' },
];

function MarketStatePill({ s }) {
  if (s === 'live')     return <AdmPill kind="gain"><span className="adm-dot is-gain" />LIVE</AdmPill>;
  if (s === 'degraded') return <AdmPill kind="warn"><span className="adm-dot is-warn" />DEGRADED</AdmPill>;
  if (s === 'halted')   return <AdmPill kind="loss">HALTED</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function CatPill({ c }) {
  const colors = {
    politics: 'var(--info)',
    macro:    'var(--accent-default)',
    sports:   'var(--gain)',
    culture:  'var(--text-secondary)',
    crypto:   'var(--warning)',
    tech:     'var(--text-secondary)',
    meme:     'var(--warning)',
  };
  return <span style={{fontSize:10,fontFamily:'Geist Mono, monospace',color:colors[c] || 'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>{c}</span>;
}

function VenueCoverageHeatmap() {
  const venues = ['Polymarket', 'Kalshi', 'Manifold', 'PredictIt', 'IEM'];
  const symbols = ['fed-mar-cut','nyc-mayor-26','cpi-mar-low','oscar-bp-26','btc-100k-eoy','nfl-chiefs-cov','eth-etf-q1','scotus-tiktok','doge-1-26','sen-d-26'];
  const grid = [
    ['good','good','ok','wide','na'],
    ['good','good','wide','wide','wide'],
    ['good','good','wide','na','na'],
    ['good','wide','wide','na','na'],
    ['good','good','good','wide','na'],
    ['good','good','na','na','na'],
    ['good','good','wide','na','na'],
    ['good','good','wide','wide','na'],
    ['good','good','good','na','na'],
    ['good','wide','down','wide','na'],
  ];
  const cellStyle = (s) => {
    const map = {
      good: { background: 'color-mix(in srgb, var(--gain) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--gain) 80%, transparent)' },
      ok:   { background: 'color-mix(in srgb, var(--gain) 28%, transparent)', border: '1px solid color-mix(in srgb, var(--gain) 40%, transparent)' },
      wide: { background: 'color-mix(in srgb, var(--warning) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 60%, transparent)' },
      down: { background: 'color-mix(in srgb, var(--loss) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--loss) 80%, transparent)' },
      na:   { background: 'transparent', border: '1px dashed var(--border-subtle)' },
    };
    return map[s];
  };
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'140px repeat(5, 1fr)',gap:6,marginBottom:8}}>
        <div></div>
        {venues.map(v => <div key={v} style={{fontSize:10,color:'var(--text-tertiary)',textAlign:'center',fontFamily:'Geist Mono, monospace'}}>{v}</div>)}
      </div>
      {symbols.map((sym, i) => (
        <div key={sym} style={{display:'grid',gridTemplateColumns:'140px repeat(5, 1fr)',gap:6,marginBottom:6,alignItems:'center'}}>
          <div className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{sym}</div>
          {grid[i].map((s, j) => (
            <div key={j} style={{height:18,borderRadius:3,...cellStyle(s)}} title={`${sym} on ${venues[j]}: ${s}`} />
          ))}
        </div>
      ))}
      <div style={{display:'flex',gap:14,marginTop:14,paddingTop:14,borderTop:'1px solid var(--border-subtle)',fontSize:10.5,color:'var(--text-tertiary)'}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,...cellStyle('good')}} /> deep liquid</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,...cellStyle('wide')}} /> wide spread</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,...cellStyle('down')}} /> degraded</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,...cellStyle('na')}} /> not listed</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <AdmShell active="markets" title="Markets" crumbs={[{ label: 'Forecasting' }]}>
      <AdmPageHead
        title="Markets"
        sub={<>{MARKETS.length} markets tracked · 5 venues · 24h volume <span className="mono" style={{color:'var(--text-secondary)'}}>$122.8M</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Track market</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="24h volume" value="$122.8M" delta="+8.4% vs 7d avg" deltaKind="gain" icon="dollar" iconKind="is-gain" />
        <AdmStat label="Active markets" value="11 / 12" delta="GPT-5 halted" deltaKind="loss" icon="bar-chart" iconKind="is-info" />
        <AdmStat label="Avg spread" value="0.7¢" delta="−0.1¢" deltaKind="gain" icon="trending" iconKind="is-gain" />
        <AdmStat label="Resolving · 14d" value="6" delta="$304M open" icon="activity" iconKind="is-info" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="globe" size={14} /></div>
            <h3 className="adm-card-title">Venue × market coverage</h3>
            <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-tertiary)'}}>liquidity quality</span>
          </div>
          <VenueCoverageHeatmap />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="trending" size={14} /></div>
            <h3 className="adm-card-title">Top by volume · 24h</h3>
          </div>
          {MARKETS.slice(0, 6).map(m => {
            const num = parseFloat(m.vol24h.replace(/[$M]/g,''));
            const pct = (num / 50) * 100;
            return (
              <div key={m.sym} style={{padding:'10px 0',borderBottom:'1px solid var(--border-subtle)'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                  <span style={{fontSize:12,color:'var(--text-primary)',fontWeight:500,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</span>
                  <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:12,color:'var(--text-secondary)',fontWeight:600}}>{m.vol24h}</span>
                </div>
                <div className="adm-bar"><span style={{width:`${pct}%`}} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <AdmSectionHead title="All markets" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Title, slug, category…" />
          </div>
          <AdmFilter active count={MARKETS.length}>All</AdmFilter>
          <AdmFilter count={3}>Politics</AdmFilter>
          <AdmFilter count={3}>Macro</AdmFilter>
          <AdmFilter count={2}>Sports</AdmFilter>
          <AdmFilter count={1}>Halted</AdmFilter>
          <button className="adm-filter"><AdmIcon name="filter" size={11} />Venue · all</button>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>State</th>
              <th>Venues</th>
              <th className="col-num">YES</th>
              <th className="col-num">24h volume</th>
              <th className="col-num">Active users</th>
              <th className="col-num">Open interest</th>
              <th className="col-num">Spread</th>
              <th className="col-num">Top depth</th>
              <th>Resolves</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {MARKETS.map(m => (
              <tr key={m.sym}>
                <td>
                  <div style={{fontWeight:500,fontSize:12.5,maxWidth:280}}>{m.title}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                    <CatPill c={m.cat} />
                    <span className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{m.sym}</span>
                  </div>
                </td>
                <td><MarketStatePill s={m.state} /></td>
                <td><span className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{m.venues}</span></td>
                <td className="col-num" style={{fontWeight:600,color: m.yes === '—' ? 'var(--text-tertiary)' : 'var(--text-primary)'}}>{m.yes}</td>
                <td className="col-num" style={{fontWeight:600}}>{m.vol24h}</td>
                <td className="col-num col-secondary">{m.users.toLocaleString()}</td>
                <td className="col-num col-secondary">{m.oi}</td>
                <td className="col-num col-secondary" style={{color: parseFloat(m.spread) > 1 ? 'var(--warning)' : 'var(--text-secondary)'}}>{m.spread}</td>
                <td className="col-num col-secondary">{m.depth}</td>
                <td className="col-secondary" style={{fontSize:11}}>{m.resolves}</td>
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
