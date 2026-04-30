/* Polyforge — Admin Marketplace Listings
   Strategy listings pending review, fee tier management, payouts */

const LISTINGS = [
  { id: 'lst_4f2a', strat: 'fed-rate-cut-tracker v4',  author: 'k. yamamoto',  state: 'pending',   fee: '20% of pnl', minDeposit: '$500', backtest: '12mo · brier 0.118', forwardDays: 32, submitted: '2h ago',  flag: false },
  { id: 'lst_4f29', strat: 'nyc-mayoral-poll-fade',    author: 'sora.fi',      state: 'pending',   fee: '$99/mo',     minDeposit: '$2,000',backtest: '8mo · brier 0.094', forwardDays: 14, submitted: '4h ago',  flag: false },
  { id: 'lst_4f28', strat: 'senate-2026-margin v2',    author: 'arianne.dev',  state: 'changes',   fee: '15% of pnl', minDeposit: '$250', backtest: '6mo · brier 0.142', forwardDays: 7,  submitted: '1d ago',  flag: 'risk_disclosure' },
  { id: 'lst_4f27', strat: 'cpi-print-laddered',       author: 'priya.io',     state: 'pending',   fee: '$29/mo',     minDeposit: '$200', backtest: '12mo · brier 0.184', forwardDays: 21, submitted: '6h ago',  flag: false },
  { id: 'lst_4f26', strat: 'thin-market-sniper',       author: 'anon_4a91',    state: 'rejected',  fee: '50% of pnl', minDeposit: '$5,000',backtest: '7d · brier —',      forwardDays: 0,  submitted: '12h ago', flag: 'wash_trading' },
  { id: 'lst_4f25', strat: 'oscars-favorite-hedge',    author: 'bjorn.eth',    state: 'live',      fee: '$49/mo',     minDeposit: '$300', backtest: '12mo · brier 0.156', forwardDays: 54, submitted: '54d ago', flag: false },
  { id: 'lst_4f24', strat: 'congress-vote-pulse',      author: 'dmitri.q',     state: 'live',      fee: '$39/mo',     minDeposit: '$500', backtest: '12mo · brier 0.182', forwardDays: 142,submitted: '142d ago',flag: false },
  { id: 'lst_4f23', strat: 'scotus-decision-pulse',    author: 'maria.f',      state: 'pending',   fee: '15% of pnl', minDeposit: '$200', backtest: '6mo · brier 0.168',forwardDays: 18, submitted: '8h ago',  flag: false },
  { id: 'lst_4f22', strat: 'kalshi-spread-grid',       author: 'tess.k',       state: 'live',      fee: '$29/mo',     minDeposit: '$1,000',backtest: '12mo · brier 0.171', forwardDays: 38, submitted: '38d ago', flag: false },
  { id: 'lst_4f21', strat: 'nfl-spread-momentum',      author: 'noah.q',       state: 'live',      fee: '$19/mo',     minDeposit: '$200', backtest: '12mo · brier 0.224', forwardDays: 21, submitted: '21d ago', flag: 'drawdown' },
];

function L({ s }) {
  if (s === 'pending')  return <AdmPill kind="warn">PENDING</AdmPill>;
  if (s === 'changes')  return <AdmPill kind="info">CHANGES REQ.</AdmPill>;
  if (s === 'live')     return <AdmPill kind="gain"><span className="adm-dot is-gain" />LIVE</AdmPill>;
  if (s === 'rejected') return <AdmPill kind="loss">REJECTED</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="listings" title="Marketplace listings" crumbs={[{ label: 'Trading' }]}>
      <AdmPageHead
        title="Marketplace listings"
        sub={<>7 awaiting review · 142 listings live · $48.4K platform fees this month</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Listing policy</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="dollar" size={12} />Run payouts</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Pending review" value="7" delta="2 over SLA · 24h" deltaKind="warn" icon="clock" iconKind="is-warn" />
        <AdmStat label="Live listings" value="142" delta="+8 this week" deltaKind="gain" icon="shopping-bag" iconKind="is-gain" />
        <AdmStat label="Platform fees · MTD" value="$48,420" delta="+22.4%" deltaKind="gain" icon="dollar" iconKind="is-info" />
        <AdmStat label="Author payouts due" value="$184,210" delta="186 authors · run Fri" icon="users" iconKind="is-info" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1.4fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="dollar" size={14} /></div>
            <h3 className="adm-card-title">Top earners · 30d</h3>
          </div>
          <table className="adm-mini-table">
            <thead><tr><th>Strategy</th><th>Author</th><th className="col-num">Subscribers</th><th className="col-num">Author cut</th><th className="col-num">Platform cut</th></tr></thead>
            <tbody>
              <tr><td className="mono">fed-rate-cut-tracker</td><td>k. yamamoto</td><td className="col-num">412</td><td className="col-num" style={{color:'var(--gain-text)'}}>$46,720</td><td className="col-num">$11,680</td></tr>
              <tr><td className="mono">senate-2026-margin</td><td>arianne.dev</td><td className="col-num">287</td><td className="col-num" style={{color:'var(--gain-text)'}}>$17,684</td><td className="col-num">$4,421</td></tr>
              <tr><td className="mono">kalshi-spread-grid</td><td>tess.k</td><td className="col-num">156</td><td className="col-num" style={{color:'var(--gain-text)'}}>$3,624</td><td className="col-num">$906</td></tr>
              <tr><td className="mono">oscars-favorite-hedge</td><td>bjorn.eth</td><td className="col-num">198</td><td className="col-num" style={{color:'var(--gain-text)'}}>$7,761</td><td className="col-num">$1,940</td></tr>
              <tr><td className="mono">cpi-print-laddered</td><td>priya.io</td><td className="col-num">244</td><td className="col-num" style={{color:'var(--gain-text)'}}>$3,712</td><td className="col-num">$928</td></tr>
              <tr><td className="mono">congress-vote-pulse</td><td>dmitri.q</td><td className="col-num">71</td><td className="col-num" style={{color:'var(--gain-text)'}}>$2,219</td><td className="col-num">$555</td></tr>
            </tbody>
          </table>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="layers" size={14} /></div>
            <h3 className="adm-card-title">Fee structure mix</h3>
          </div>
          {[
            { k: 'Performance fee · 20%+', n: 38, pct: 26.8, color: 'var(--accent-default)' },
            { k: 'Performance fee · 10-20%', n: 42, pct: 29.6, color: 'var(--info)' },
            { k: 'Subscription · $50+/mo', n: 24, pct: 16.9, color: 'var(--gain)' },
            { k: 'Subscription · <$50/mo', n: 32, pct: 22.5, color: 'var(--warning)' },
            { k: 'Free / open source', n: 6,  pct: 4.2,  color: 'var(--text-tertiary)' },
          ].map(r => (
            <div key={r.k} style={{padding:'9px 0',borderBottom:'1px solid var(--border-subtle)'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:5}}>
                <span style={{width:8,height:8,borderRadius:2,background:r.color}} />
                <span style={{fontSize:12,color:'var(--text-primary)'}}>{r.k}</span>
                <span style={{marginLeft:'auto',fontFamily:'Geist Mono, monospace',fontSize:11,color:'var(--text-secondary)'}}>{r.n}</span>
                <span style={{fontFamily:'Geist Mono, monospace',fontSize:10.5,color:'var(--text-tertiary)',minWidth:42,textAlign:'right'}}>{r.pct}%</span>
              </div>
              <div className="adm-bar"><span style={{width:`${r.pct*2}%`,background:r.color}} /></div>
            </div>
          ))}
        </div>
      </div>

      <AdmSectionHead title="Submissions" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Listing or strategy…" />
          </div>
          <AdmFilter active count={LISTINGS.length}>All</AdmFilter>
          <AdmFilter count={4}>Pending</AdmFilter>
          <AdmFilter count={1}>Changes req.</AdmFilter>
          <AdmFilter count={4}>Live</AdmFilter>
          <AdmFilter count={1}>Rejected</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>State</th>
              <th>Author</th>
              <th>Fee</th>
              <th className="col-num">Min deposit</th>
              <th>Evidence</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {LISTINGS.map(l => (
              <tr key={l.id}>
                <td>
                  <div style={{fontWeight:500,color:'var(--text-primary)'}}>{l.strat}</div>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace',marginTop:2}}>{l.id}{l.flag && <> · <span style={{color:'var(--loss-text)'}}>flag: {l.flag}</span></>}</div>
                </td>
                <td><L s={l.state} /></td>
                <td className="col-secondary">{l.author}</td>
                <td className="mono" style={{fontSize:11.5,color:'var(--text-secondary)'}}>{l.fee}</td>
                <td className="col-num">{l.minDeposit}</td>
                <td>
                  <span style={{fontSize:11,color:'var(--text-secondary)'}}>{l.backtest}</span>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{l.forwardDays > 0 ? `${l.forwardDays}d forward · live` : 'no forward run'}</div>
                </td>
                <td className="col-tertiary" style={{fontSize:11}}>{l.submitted}</td>
                <td className="col-actions">
                  {l.state === 'pending' && (
                    <div style={{display:'flex',gap:4}}>
                      <button className="adm-icon-btn" title="Approve"><AdmIcon name="check" size={14} /></button>
                      <button className="adm-icon-btn" title="Reject"><AdmIcon name="circle-x" size={14} /></button>
                    </div>
                  )}
                  {l.state !== 'pending' && <button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
