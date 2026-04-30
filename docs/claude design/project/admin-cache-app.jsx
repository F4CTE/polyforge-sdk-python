/* Polyforge — Admin Cache & Queues
   Redis cluster, Kafka topics, dead-letter, consumer lag */

const CACHES = [
  { id: 'price-tick',      shards: 6,  size: '4.2 GB',  hit: 99.84, ops: '142K/s', evict: '0.4%/h', ttl: '5s'   },
  { id: 'sentiment-cache', shards: 3,  size: '1.8 GB',  hit: 92.4,  ops: '8.4K/s', evict: '12%/h',  ttl: '5min' },
  { id: 'user-session',    shards: 4,  size: '2.4 GB',  hit: 99.94, ops: '14K/s',  evict: '0.1%/h', ttl: '24h'  },
  { id: 'orderbook-snap',  shards: 8,  size: '8.4 GB',  hit: 98.42, ops: '38K/s',  evict: '4.2%/h', ttl: '1s'   },
  { id: 'strategy-meta',   shards: 2,  size: '0.4 GB',  hit: 99.98, ops: '4.2K/s', evict: '0.02%/h',ttl: '1h'   },
  { id: 'kyc-doc-hash',    shards: 1,  size: '0.1 GB',  hit: 99.62, ops: '0.4K/s', evict: '0.0%/h', ttl: '∞'    },
];

const TOPICS = [
  { id: 'orders.v3',         partitions: 32, msgs: '14.8M', producers: 8,  consumers: 12, lag: 142,    state: 'op'   },
  { id: 'fills.v3',          partitions: 32, msgs: '8.4M',  producers: 4,  consumers: 18, lag: 84,     state: 'op'   },
  { id: 'price-tick.v2',     partitions: 64, msgs: '848M',  producers: 6,  consumers: 24, lag: 1820,   state: 'op'   },
  { id: 'sentiment-raw',     partitions: 8,  msgs: '184K',  producers: 12, consumers: 4,  lag: 8420,   state: 'lag'  },
  { id: 'audit',             partitions: 16, msgs: '184K',  producers: 24, consumers: 6,  lag: 12,     state: 'op'   },
  { id: 'webhooks.outbound', partitions: 4,  msgs: '42K',   producers: 8,  consumers: 4,  lag: 412,    state: 'op'   },
  { id: 'notify.email',      partitions: 4,  msgs: '8.4K',  producers: 6,  consumers: 2,  lag: 22,     state: 'op'   },
  { id: 'backtest.jobs',     partitions: 16, msgs: '12K',   producers: 4,  consumers: 38, lag: 4,      state: 'op'   },
  { id: 'broadcasts',        partitions: 2,  msgs: '184',   producers: 2,  consumers: 14, lag: 0,      state: 'op'   },
  { id: 'sentiment-raw.dlq', partitions: 4,  msgs: '142',   producers: 1,  consumers: 0,  lag: 142,    state: 'dlq'  },
];

function CacheStateBar({ hit }) {
  const c = hit > 99 ? 'var(--gain)' : hit > 95 ? 'var(--info)' : hit > 90 ? 'var(--warning)' : 'var(--loss)';
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:180}}>
      <div className="adm-bar" style={{flex:1}}><span style={{width:`${hit}%`,background:c}} /></div>
      <span style={{fontFamily:'Geist Mono, monospace',fontSize:11,color:c,fontWeight:600,minWidth:50,textAlign:'right'}}>{hit.toFixed(2)}%</span>
    </div>
  );
}

function TopicState({ s }) {
  if (s === 'op')  return <AdmPill kind="gain">op</AdmPill>;
  if (s === 'lag') return <AdmPill kind="warn">lagging</AdmPill>;
  if (s === 'dlq') return <AdmPill kind="loss">DLQ</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}

function App() {
  return (
    <AdmShell active="cache" title="Cache & queues" crumbs={[{ label: 'Platform' }]}>
      <AdmPageHead
        title="Cache & queues"
        sub={<>Redis cluster · 6 nodes · Kafka · 32 brokers · 1.8B msgs/24h · streaming layer healthy</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Cluster topology</button>
          <button className="adm-btn adm-btn-secondary is-loss"><AdmIcon name="circle-x" size={12} />Flush selected</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Cache hit · global" value="98.42%" delta="+0.04%" deltaKind="gain" icon="database" iconKind="is-gain" />
        <AdmStat label="Cache memory" value="17.4 GB / 32 GB" delta="54% used · across 6 caches" icon="layers" iconKind="is-info" />
        <AdmStat label="Kafka throughput" value="184K msg/s" delta="peak today 412K" deltaKind="gain" icon="activity" iconKind="is-info" />
        <AdmStat label="DLQ size" value="142" delta="sentiment-raw · 8h" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1fr 1fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="database" size={14} /></div>
            <h3 className="adm-card-title">Redis caches</h3>
            <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-tertiary)'}}>hit rate</span>
          </div>
          <table className="adm-mini-table">
            <thead><tr><th>Key</th><th className="col-num">Shards</th><th className="col-num">Size</th><th>Hit rate</th><th className="col-num">Ops</th></tr></thead>
            <tbody>
              {CACHES.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className="mono" style={{color:'var(--text-primary)'}}>{c.id}</span>
                    <div style={{fontSize:10,color:'var(--text-tertiary)',marginTop:2}}>ttl {c.ttl} · evict {c.evict}</div>
                  </td>
                  <td className="col-num">{c.shards}</td>
                  <td className="col-num col-secondary">{c.size}</td>
                  <td><CacheStateBar hit={c.hit} /></td>
                  <td className="col-num col-secondary">{c.ops}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon is-info"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Throughput · 60min</h3>
          </div>
          <svg viewBox="0 0 360 140" style={{width:'100%',height:140}}>
            <defs>
              <linearGradient id="cq-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20,50,80,110].map(y => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />)}
            <path d="M 0 90 L 30 80 L 60 76 L 90 64 L 120 70 L 150 56 L 180 48 L 210 36 L 240 42 L 270 28 L 300 32 L 330 24 L 360 28 L 360 140 L 0 140 Z" fill="url(#cq-area)" />
            <path d="M 0 90 L 30 80 L 60 76 L 90 64 L 120 70 L 150 56 L 180 48 L 210 36 L 240 42 L 270 28 L 300 32 L 330 24 L 360 28" stroke="var(--accent-default)" strokeWidth="1.6" fill="none" />
            <path d="M 0 110 L 60 100 L 120 96 L 180 88 L 240 84 L 300 80 L 360 78" stroke="var(--info)" strokeWidth="1.4" fill="none" strokeDasharray="4 4" />
          </svg>
          <div style={{display:'flex',gap:18,fontSize:10.5,color:'var(--text-tertiary)',marginTop:8}}>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:14,height:2,background:'var(--accent-default)',borderRadius:1}} /> producers</span>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:14,height:2,borderTop:'2px dashed var(--info)'}} /> consumers</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:14,paddingTop:14,borderTop:'1px solid var(--border-subtle)',fontFamily:'Geist Mono, monospace',fontSize:11}}>
            <div><span style={{color:'var(--text-tertiary)'}}>peak in</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>412K/s</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>peak out</span> <span style={{color:'var(--text-primary)',fontWeight:600,marginLeft:4}}>388K/s</span></div>
            <div><span style={{color:'var(--text-tertiary)'}}>avg lag</span> <span style={{color:'var(--warning)',fontWeight:600,marginLeft:4}}>1.4s</span></div>
          </div>
        </div>
      </div>

      <AdmSectionHead title="Kafka topics" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <AdmFilter active count={TOPICS.length}>All</AdmFilter>
          <AdmFilter count={1}>Lagging</AdmFilter>
          <AdmFilter count={1}>DLQ</AdmFilter>
          <AdmFilter count={4}>Trading</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>State</th>
              <th className="col-num">Partitions</th>
              <th className="col-num">Messages · 24h</th>
              <th className="col-num">Producers</th>
              <th className="col-num">Consumers</th>
              <th className="col-num">Lag (msg)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TOPICS.map(t => (
              <tr key={t.id}>
                <td><span className="mono" style={{fontWeight:500}}>{t.id}</span></td>
                <td><TopicState s={t.state} /></td>
                <td className="col-num col-secondary">{t.partitions}</td>
                <td className="col-num">{t.msgs}</td>
                <td className="col-num col-secondary">{t.producers}</td>
                <td className="col-num col-secondary">{t.consumers || <span style={{color:'var(--loss-text)',fontWeight:600}}>0</span>}</td>
                <td className="col-num" style={{color: t.lag > 1000 ? 'var(--warning)' : t.state === 'dlq' ? 'var(--loss-text)' : 'var(--text-secondary)',fontWeight: t.lag > 1000 ? 600 : 400}}>{t.lag.toLocaleString()}</td>
                <td className="col-actions">
                  <div style={{display:'flex',gap:4}}>
                    <button className="adm-icon-btn" title="Replay"><AdmIcon name="play" size={14} /></button>
                    <button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button>
                  </div>
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
