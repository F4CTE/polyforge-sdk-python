/* Polyforge — Admin Blocks catalog
   Public + private prediction-market blocks (forecasting strategies).
   Author marketplace, accuracy stats, calibration, abuse signals. */

const BLOCKS = [
  { id: 'blk_94f2', name: 'fed-rate-cut-tracker',  author: 'k. yamamoto',   visibility: 'public',  state: 'live',   users: 412, vol30d: '$8.2M', roi30d: '+34.2%', brier: 0.118, hit: '72.4%', fee: '20% of pnl', rev30d: '$58.4K', flag: false, age: '124d', cat: 'macro' },
  { id: 'blk_94f1', name: 'senate-2026-margin',    author: 'arianne.dev',   visibility: 'public',  state: 'live',   users: 287, vol30d: '$4.1M', roi30d: '+18.7%', brier: 0.142, hit: '64.1%', fee: '15% of pnl', rev30d: '$22.1K', flag: false, age: '88d',  cat: 'politics' },
  { id: 'blk_94f0', name: 'cpi-print-fade',        author: 'bjorn.eth',     visibility: 'public',  state: 'live',   users: 198, vol30d: '$2.8M', roi30d: '+12.4%', brier: 0.156, hit: '58.4%', fee: '$49/mo',     rev30d: '$9.7K',  flag: false, age: '54d',  cat: 'macro' },
  { id: 'blk_94ef', name: 'oscar-best-picture',    author: 'tess.k',        visibility: 'public',  state: 'live',   users: 156, vol30d: '$1.9M', roi30d: '+9.1%',  brier: 0.121, hit: '68.2%', fee: '$29/mo',     rev30d: '$4.5K',  flag: false, age: '38d',  cat: 'culture' },
  { id: 'blk_94ee', name: 'nfl-spread-arb',        author: 'noah.q',        visibility: 'public',  state: 'live',   users: 84,  vol30d: '$0.7M', roi30d: '−4.8%',  brier: 0.241, hit: '47.8%', fee: '$19/mo',     rev30d: '$1.6K',  flag: 'drawdown', age: '21d',  cat: 'sports' },
  { id: 'blk_94ed', name: 'doge-tweet-fader',      author: 'volkov.eth',    visibility: 'private', state: 'halted', users: 1,   vol30d: '$4.2M', roi30d: '−18.4%', brier: 0.298, hit: '38.4%', fee: '—',          rev30d: '$0',     flag: 'risk', age: '4d',   cat: 'meme' },
  { id: 'blk_94ec', name: 'scotus-decision-pulse', author: 'maria.f',       visibility: 'public',  state: 'live',   users: 132, vol30d: '$1.2M', roi30d: '+6.4%',  brier: 0.168, hit: '61.4%', fee: '15% of pnl', rev30d: '$2.4K',  flag: false, age: '67d',  cat: 'politics' },
  { id: 'blk_94eb', name: 'congress-vote-pulse',   author: 'dmitri.q',      visibility: 'public',  state: 'paused', users: 71,  vol30d: '$0.9M', roi30d: '+2.1%',  brier: 0.182, hit: '54.2%', fee: '$39/mo',     rev30d: '$2.8K',  flag: false, age: '142d', cat: 'execution' },
  { id: 'blk_94ea', name: 'nba-injury-react',      author: 'sora.fi',       visibility: 'private', state: 'live',   users: 1,   vol30d: '$1.4M', roi30d: '+22.4%', brier: 0.124, hit: '69.8%', fee: '—',          rev30d: '$0',     flag: false, age: '14d',  cat: 'sports' },
  { id: 'blk_94e9', name: 'kalshi-spread-grid',    author: 'priya.io',      visibility: 'public',  state: 'live',   users: 244, vol30d: '$1.8M', roi30d: '+4.2%',  brier: 0.171, hit: '57.4%', fee: '$19/mo',     rev30d: '$4.6K',  flag: false, age: '198d', cat: 'execution' },
  { id: 'blk_94e8', name: 'fed-rate-cut-tracker v3',author:'k. yamamoto',   visibility: 'public',  state: 'archived',users: 0,  vol30d: '$0',    roi30d: '—',     brier: 0.142, hit: '66.1%', fee: '20% of pnl', rev30d: '$0',     flag: false, age: '320d', cat: 'macro' },
  { id: 'blk_94e7', name: 'rumor-fade-blocked',        author: 'anon_4a91',     visibility: 'private', state: 'halted', users: 1,   vol30d: '$0.4M', roi30d: '+82.4%', brier: 0.402, hit: '52.0%', fee: '—',          rev30d: '$0',     flag: 'abuse', age: '2d',   cat: 'unknown' },
];

function VisibilityPill({ v }) {
  const map = {
    public:  { kind: 'gain',   label: 'PUBLIC',  icon: 'eye' },
    private: { kind: '',       label: 'PRIVATE', icon: 'lock' },
    forked:  { kind: 'info',   label: 'FORKED',  icon: 'copy' },
  };
  const m = map[v];
  return <AdmPill kind={m.kind}>{m.label}</AdmPill>;
}

function StatePill({ s }) {
  const map = {
    live:     { kind: 'gain', label: 'LIVE',    dot: true, pulse: true },
    paused:   { kind: 'warn', label: 'PAUSED',  dot: true },
    halted:   { kind: 'loss', label: 'HALTED',  dot: true, pulse: true },
    archived: { kind: '',     label: 'ARCHIVED' },
  };
  const m = map[s];
  return <AdmPill kind={m.kind} dot={m.dot} pulse={m.pulse}>{m.label}</AdmPill>;
}

function FlagBadge({ f }) {
  if (!f) return null;
  const map = { drawdown: 'DRAWDOWN', risk: 'RISK', abuse: 'ABUSE' };
  return <AdmPill kind="loss">{map[f] || f.toUpperCase()}</AdmPill>;
}

function CatPill({ c }) {
  const map = {
    politics:  { kind: 'info',  label: 'POLITICS' },
    macro:     { kind: 'info',  label: 'MACRO' },
    sports:    { kind: '',      label: 'SPORTS' },
    culture:   { kind: '',      label: 'CULTURE' },
    execution: { kind: '',      label: 'EXECUTION' },
    meme:      { kind: 'warn',  label: 'MEME' },
    unknown:   { kind: 'loss',  label: 'UNKNOWN' },
  };
  const m = map[c] || { kind: '', label: c?.toUpperCase() };
  return <AdmPill kind={m.kind}>{m.label}</AdmPill>;
}

function App() {
  const [tab, setTab] = React.useState('all');
  const counts = {
    all:     BLOCKS.length,
    live:    BLOCKS.filter(s => s.state === 'live').length,
    flagged: BLOCKS.filter(s => s.flag).length,
    halted:  BLOCKS.filter(s => s.state === 'halted').length,
    archived:BLOCKS.filter(s => s.state === 'archived').length,
  };
  const filtered = BLOCKS.filter(s => {
    if (tab === 'all') return true;
    if (tab === 'flagged') return s.flag;
    return s.state === tab;
  });

  return (
    <AdmShell active="strategies" title="Blocks" crumbs={[{ label: 'Forecasting' }]} actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
    }>
      <AdmPageHead
        title="Blocks"
        sub={<>3,142 deployed · 84 public on marketplace · combined 30d volume <span className="mono" style={{color:'var(--text-secondary)'}}>$182.4M</span></>}
        actions={<>
          <div className="adm-filter"><AdmIcon name="clock" size={11} />Last 30d <AdmIcon name="chevron-down" size={11} /></div>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Live blocks" value="3,142" delta="+47 in 24h" deltaKind="gain" icon="blocks" iconKind="is-info" spark={[80,82,86,90,94,100,108,116,124,132,140,148,156,164,172,180,188,196,204,212,220,228,236,244]} sparkKind="gain" />
        <AdmStat label="Marketplace listings" value="84" delta="7 pending review" deltaKind="loss" icon="shopping-bag" iconKind="is-warn" />
        <AdmStat label="Marketplace revenue" value="$58.4K" delta="+12% MoM" deltaKind="gain" icon="dollar" iconKind="is-gain" spark={[20,22,26,28,32,34,38,42,44,46,50,52,54,56,58]} sparkKind="gain" />
        <AdmStat label="Halted (drawdown)" value="3" delta="2 auto · 1 manual" deltaKind="loss" icon="alert" iconKind="is-loss" />
      </div>

      <AdmSectionHead title="Top performers · 30d" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {BLOCKS.filter(s => s.visibility === 'public' && s.state === 'live').slice(0, 3).map((s, i) => (
          <div key={s.id} className="adm-card" style={{padding:16,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:14,right:14,fontFamily:'Geist Mono, monospace',fontSize:10,color:'var(--text-tertiary)',background:'var(--bg-app)',padding:'2px 6px',borderRadius:4}}>#{i+1}</div>
            <div className="mono" style={{fontSize:13,fontWeight:600,marginBottom:2}}>{s.name}</div>
            <div style={{fontSize:11,color:'var(--text-tertiary)',marginBottom:14,fontFamily:'Geist Mono, monospace'}}>by {s.author}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:14}}>
              <span style={{fontFamily:'Geist Mono, monospace',fontSize:24,fontWeight:600,color:'var(--gain-text)'}}>{s.roi30d}</span>
              <span style={{fontSize:11,color:'var(--text-tertiary)',fontFamily:'Geist Mono, monospace'}}>30d ROI</span>
            </div>
            <AdmSpark points={[10,12,14,16,18,22,28,32,38,44,52,58,64,72,80,86,94,102,110,116,124,132,140,148].map(v=>v+i*5)} kind="gain" height={40} />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:12,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
              <div><div style={{fontSize:10,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Users</div><div style={{fontFamily:'Geist Mono, monospace',fontSize:13,fontWeight:600}}>{s.users}</div></div>
              <div><div style={{fontSize:10,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Brier</div><div style={{fontFamily:'Geist Mono, monospace',fontSize:13,fontWeight:600}}>{s.brier}</div></div>
              <div><div style={{fontSize:10,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Hit</div><div style={{fontFamily:'Geist Mono, monospace',fontSize:13,fontWeight:600,color:'var(--gain-text)'}}>{s.hit}</div></div>
            </div>
          </div>
        ))}
      </div>

      <AdmSectionHead title="All blocks" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Search by name, author, ID…" />
          </div>
          <AdmFilter active={tab==='all'}     count={counts.all}     onClick={()=>setTab('all')}>All</AdmFilter>
          <AdmFilter active={tab==='live'}    count={counts.live}    onClick={()=>setTab('live')}>Live</AdmFilter>
          <AdmFilter active={tab==='flagged'} count={counts.flagged} onClick={()=>setTab('flagged')}>Flagged</AdmFilter>
          <AdmFilter active={tab==='halted'}  count={counts.halted}  onClick={()=>setTab('halted')}>Halted</AdmFilter>
          <AdmFilter active={tab==='paused'}  count="1" onClick={()=>setTab('paused')}>Paused</AdmFilter>
          <AdmFilter active={tab==='archived'} count={counts.archived} onClick={()=>setTab('archived')}>Archived</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Category</th>
              <th>Visibility</th>
              <th>State</th>
              <th>Flag</th>
              <th className="col-num">Users</th>
              <th className="col-num">30d vol</th>
              <th className="col-num">30d ROI</th>
              <th className="col-num">Brier</th>
              <th className="col-num">Hit rate</th>
              <th>Pricing</th>
              <th className="col-num">Rev 30d</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{fontWeight:500,fontFamily:'Geist Mono, monospace',fontSize:12.5}}>{s.name}</div>
                  <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>by <span className="mono" style={{color:'var(--text-secondary)'}}>{s.author}</span> · {s.age}</div>
                </td>
                <td><CatPill c={s.cat} /></td>
                <td><VisibilityPill v={s.visibility} /></td>
                <td><StatePill s={s.state} /></td>
                <td>{s.flag ? <FlagBadge f={s.flag} /> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
                <td className="col-num">{s.users}</td>
                <td className="col-num col-secondary">{s.vol30d}</td>
                <td className="col-num" style={{color: s.roi30d.startsWith('+') ? 'var(--gain-text)' : s.roi30d.startsWith('−') ? 'var(--loss-text)' : 'var(--text-tertiary)', fontWeight:600}}>{s.roi30d}</td>
                <td className="col-num col-secondary">{s.brier}</td>
                <td className="col-num" style={{color: parseFloat(s.hit) >= 60 ? 'var(--gain-text)' : parseFloat(s.hit) < 50 ? 'var(--loss-text)' : 'var(--text-secondary)'}}>{s.hit}</td>
                <td className="col-secondary" style={{fontSize:11.5}}>{s.fee}</td>
                <td className="col-num">{s.rev30d}</td>
                <td style={{width:32}}><button className="row-action"><AdmIcon name="more" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span>{filtered.length} of {BLOCKS.length}</span>
          <div className="adm-pagination">
            <button disabled><AdmIcon name="chevron-left" size={11} /></button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>…</button>
            <button>262</button>
            <button><AdmIcon name="chevron-right" size={11} /></button>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
