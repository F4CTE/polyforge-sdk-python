/* Polyforge — Watchlist
   User-curated list of markets with custom alerts and quick trade. */

const WL_MARKETS = [
  { id: 'm1', name: 'Will Fed cut rates in June 2026?',  cat: 'Politics', side: 'YES', price: 64, delta: '+4¢', deltaKind: 'gain', vol: '$4.8M', alert: '70¢', alertActive: true,  added: '3d ago' },
  { id: 'm2', name: 'Ethereum ETF approval Q3',          cat: 'Crypto',   side: 'YES', price: 71, delta: '+11¢', deltaKind: 'gain', vol: '$4.2M', alert: '80¢', alertActive: true,  added: '1d ago' },
  { id: 'm3', name: 'Trump vs Vance — GOP nominee',      cat: 'Politics', side: 'YES', price: 72, delta: '+3¢', deltaKind: 'gain', vol: '$8.4M', alert: null,  alertActive: false, added: '5d ago' },
  { id: 'm4', name: 'BTC above $120k by July 1',         cat: 'Crypto',   side: 'NO',  price: 38, delta: '-2¢', deltaKind: 'loss', vol: '$2.4M', alert: '30¢', alertActive: true,  added: '2d ago' },
  { id: 'm5', name: 'NVDA Q2 earnings beat',             cat: 'Markets',  side: 'YES', price: 58, delta: '+3¢', deltaKind: 'gain', vol: '$1.2M', alert: null,  alertActive: false, added: '1w ago' },
  { id: 'm6', name: 'Lakers make NBA playoffs',          cat: 'Sports',   side: 'NO',  price: 32, delta: '+8¢', deltaKind: 'gain', vol: '$680K', alert: '40¢', alertActive: true,  added: '4d ago' },
  { id: 'm7', name: 'CPI under 3.0% in May',             cat: 'Markets',  side: 'YES', price: 52, delta: '+1¢', deltaKind: 'gain', vol: '$2.1M', alert: null,  alertActive: false, added: '6d ago' },
  { id: 'm8', name: 'Apple WWDC AI announcement',        cat: 'Tech',     side: 'YES', price: 78, delta: '+5¢', deltaKind: 'gain', vol: '$960K', alert: '85¢', alertActive: true,  added: '3d ago' },
];

function App() {
  const [filter, setFilter] = React.useState('All');
  const cats = ['All', ...new Set(WL_MARKETS.map(m => m.cat))];
  const visible = filter === 'All' ? WL_MARKETS : WL_MARKETS.filter(m => m.cat === filter);

  return (
    <UsrShell active="watchlist" title="Watchlist" crumbs={[{ label: 'Watchlist' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Alert settings</button>
        <a href="App-Markets.html" className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Add markets</a>
      </>
    }>
      <AdmPageHead
        title="Watchlist"
        sub={`${WL_MARKETS.length} markets · ${WL_MARKETS.filter(m => m.alertActive).length} active alerts · prices update every 30s`}
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Watched" value={WL_MARKETS.length} delta="3 added · 7d" deltaKind="gain" />
        <AdmStat label="Active alerts" value={WL_MARKETS.filter(m => m.alertActive).length} delta="firing soon · 2" deltaKind="warn" />
        <AdmStat label="Avg 24h move" value="+3.4¢" delta="across watchlist" deltaKind="gain" />
        <AdmStat label="Total volume · 24h" value="$24.7M" delta="+18% · vs avg" deltaKind="gain" />
      </div>

      <div className="adm-table-tools" style={{ marginBottom: 12 }}>
        <div className="adm-search" style={{ width: 280 }}>
          <AdmIcon name="search" size={12} />
          <input placeholder="Search watchlist" />
        </div>
        <div className="adm-filter-group">
          {cats.map(c => (
            <button key={c} className={`adm-filter${filter === c ? ' is-active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <select className="adm-select" defaultValue="added">
            <option value="added">Recently added</option>
            <option value="move">Biggest mover</option>
            <option value="volume">Volume</option>
          </select>
        </div>
      </div>

      <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Side</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>24h</th>
              <th style={{ textAlign: 'right' }}>Volume</th>
              <th>Alert at</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(m => (
              <tr key={m.id}>
                <td>
                  <a href="App-Market-Detail.html" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}><span className="adm-pill" style={{ fontSize: 9.5 }}>{m.cat}</span></div>
                  </a>
                </td>
                <td><span className={`adm-pill ${m.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{m.side}</span></td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{m.price}¢</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: m.deltaKind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.delta}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{m.vol}</td>
                <td>
                  {m.alert ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <span className="adm-pill has-dot is-warn is-pulse" style={{ fontSize: 10 }}>{m.alert}</span>
                    </span>
                  ) : (
                    <button className="adm-btn adm-btn-sm adm-btn-ghost" style={{ fontSize: 11 }}>
                      <AdmIcon name="bell" size={11} />Add
                    </button>
                  )}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.added}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <a href="App-Market-Detail.html" className="adm-btn adm-btn-sm adm-btn-primary">Trade</a>
                    <button className="adm-btn adm-btn-sm" style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}>
                      <AdmIcon name="x" size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);