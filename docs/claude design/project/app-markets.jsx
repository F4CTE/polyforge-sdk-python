/* Polyforge — Markets browse */

const MK_CATS = [
  { id: 'all',      label: 'All',         count: 1842 },
  { id: 'politics', label: 'Politics',    count: 412  },
  { id: 'crypto',   label: 'Crypto',      count: 286  },
  { id: 'macro',    label: 'Macro',       count: 168  },
  { id: 'sports',   label: 'Sports',      count: 524  },
  { id: 'tech',     label: 'Tech',        count: 142  },
  { id: 'culture',  label: 'Culture',     count: 184  },
  { id: 'science',  label: 'Science',     count: 126  },
];

const MK_FEAT = [
  { sym: 'ELEC28-DEM',     name: 'Democrats win 2028 Presidential election',  yes: 42, chg: +2.4, vol: '$1.2M', oi: '$4.4M', venue: 'polymarket', cat: 'politics', resolves: 'Nov 2028', whales: 4, hot: true },
  { sym: 'BTC-150K-DEC',   name: 'BTC > $150,000 by Dec 31, 2025',             yes: 31, chg: -1.1, vol: '$840K', oi: '$2.1M', venue: 'polymarket', cat: 'crypto',   resolves: 'Dec 31', whales: 7, hot: true },
  { sym: 'FED-CUT-JUL',    name: 'Fed cuts rates at July 2025 FOMC meeting',   yes: 73, chg: +4.2, vol: '$620K', oi: '$1.8M', venue: 'kalshi',     cat: 'macro',    resolves: 'Jul 30', whales: 2, hot: true },
];

const MK_ROWS = [
  { sym: 'ETH-ETF-Q2',     name: 'Spot ETH ETF approved by end of Q2 2025',    yes: 88, chg: +0.6, vol: '$2.1M', oi: '$8.4M', venue: 'polymarket', cat: 'crypto',   resolves: 'Jun 30', whales: 0 },
  { sym: 'NVDA-EARN-Q1',   name: 'NVDA beats Q1 2025 EPS consensus',           yes: 81, chg: +1.2, vol: '$1.4M', oi: '$2.8M', venue: 'kalshi',     cat: 'tech',     resolves: 'May 22', whales: 3 },
  { sym: 'OSCARS-OPP',     name: 'Oppenheimer wins Best Picture',              yes: 18, chg: +3.6, vol: '$420K', oi: '$1.2M', venue: 'polymarket', cat: 'culture',  resolves: '2d 04h', whales: 1, hot: true },
  { sym: 'NFL-SB-CHIEFS',  name: 'Chiefs win Super Bowl 2026',                 yes: 34, chg: +1.8, vol: '$1.1M', oi: '$3.8M', venue: 'kalshi',     cat: 'sports',   resolves: 'Feb 8',  whales: 2 },
  { sym: 'CPI-MAR-COOL',   name: 'March CPI prints below 3.0% YoY',            yes: 58, chg: +1.2, vol: '$280K', oi: '$640K', venue: 'kalshi',     cat: 'macro',    resolves: '14h 22m', whales: 0, hot: true },
  { sym: 'SCOTUS-S2024',   name: 'SCOTUS grants cert in case 23-1234',         yes: 61, chg: -0.4, vol: '$280K', oi: '$420K', venue: 'polymarket', cat: 'politics', resolves: 'Jun 30', whales: 1 },
  { sym: 'AAPL-VISIONPRO', name: 'Apple sells 1M+ Vision Pros by end 2025',    yes: 22, chg: -2.1, vol: '$680K', oi: '$1.8M', venue: 'polymarket', cat: 'tech',     resolves: 'Dec 31', whales: 1 },
  { sym: 'TARIFF-CHN-25',  name: 'US tariffs on China > 25% by Aug 2025',      yes: 64, chg: +6.8, vol: '$1.8M', oi: '$3.2M', venue: 'kalshi',     cat: 'macro',    resolves: 'Aug 31', whales: 5, hot: true },
  { sym: 'FUSION-BREAK',   name: 'Net-positive fusion before 2027',            yes: 12, chg: +0.4, vol: '$140K', oi: '$680K', venue: 'polymarket', cat: 'science',  resolves: 'Jan 2027', whales: 0 },
  { sym: 'TRUMP-INDICT-3', name: 'New Trump indictment by year-end',           yes: 28, chg: -0.8, vol: '$340K', oi: '$1.4M', venue: 'polymarket', cat: 'politics', resolves: 'Dec 31', whales: 2 },
  { sym: 'NBA-FINALS-CEL', name: 'Celtics win NBA Finals 2025',                yes: 42, chg: +1.2, vol: '$680K', oi: '$2.4M', venue: 'kalshi',     cat: 'sports',   resolves: 'Jun 22', whales: 1 },
  { sym: 'TSLA-FSD-L4',    name: 'Tesla achieves L4 autonomy by Q4',           yes: 8,  chg: -0.2, vol: '$220K', oi: '$840K', venue: 'polymarket', cat: 'tech',     resolves: 'Dec 31', whales: 0 },
];

function MicroBookViz({ yes }) {
  const no = 100 - yes;
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-elevated)', minWidth: 60 }}>
      <span style={{ width: `${yes}%`, background: 'var(--gain)', opacity: 0.7 }} />
      <span style={{ width: `${no}%`,  background: 'var(--loss)', opacity: 0.45 }} />
    </div>
  );
}

function FeaturedCard({ m }) {
  return (
    <a href="App-Market-Detail.html" className="adm-card" style={{ padding: 16, textDecoration: 'none', display: 'block', position: 'relative' }}>
      {m.hot && <span className="adm-pill is-warn has-dot is-pulse" style={{ position: 'absolute', top: 12, right: 12, height: 18, fontSize: 9.5 }}>HOT</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <UsrVenueBadge venue={m.venue} />
        <span className="adm-pill" style={{ height: 16, fontSize: 9.5 }}>{m.cat.toUpperCase()}</span>
      </div>
      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{m.sym}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.35, minHeight: 38 }}>{m.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 28, fontWeight: 600, color: 'var(--gain-text)', letterSpacing: '-0.01em' }}>¢{m.yes}</span>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: m.chg >= 0 ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.chg >= 0 ? '+' : ''}{m.chg}%</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)' }}>NO ¢{100 - m.yes}</span>
      </div>
      <MicroBookViz yes={m.yes} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontFamily: 'Geist Mono, monospace', fontSize: 10.5 }}>
        <div><div style={{ color: 'var(--text-tertiary)' }}>VOL 24h</div><div style={{ color: 'var(--text-primary)' }}>{m.vol}</div></div>
        <div><div style={{ color: 'var(--text-tertiary)' }}>OI</div><div style={{ color: 'var(--text-primary)' }}>{m.oi}</div></div>
        <div><div style={{ color: 'var(--text-tertiary)' }}>RESOLVES</div><div style={{ color: 'var(--text-primary)' }}>{m.resolves}</div></div>
      </div>
    </a>
  );
}

function App() {
  const [cat, setCat] = React.useState('all');
  const [venue, setVenue] = React.useState('all');
  const filtered = MK_ROWS.filter(m => (cat === 'all' || m.cat === cat) && (venue === 'all' || m.venue === venue));

  return (
    <UsrShell active="markets" title="Markets" actions={
      <>
        <button className="adm-btn adm-btn-ghost adm-btn-sm"><AdmIcon name="bookmark" size={12} />Saved</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Alerts</button>
      </>
    }>
      <AdmPageHead
        title="Markets"
        subtitle="1,842 active markets across Polymarket and Kalshi · indexed every 250ms"
      />

      {/* Featured row */}
      <AdmSectionHead title="Featured · trending now" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
        {MK_FEAT.map(m => <FeaturedCard key={m.sym} m={m} />)}
      </div>

      {/* Filters + table */}
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            {MK_CATS.map(c => (
              <button key={c.id} className={`adm-filter${cat === c.id ? ' is-active' : ''}`} onClick={() => setCat(c.id)}>
                {c.label}<span className="count">{c.count}</span>
              </button>
            ))}
          </div>
          <span style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
          <div className="adm-filter-group">
            <button className={`adm-filter${venue === 'all' ? ' is-active' : ''}`} onClick={() => setVenue('all')}>Both</button>
            <button className={`adm-filter${venue === 'polymarket' ? ' is-active' : ''}`} onClick={() => setVenue('polymarket')}>Polymarket</button>
            <button className={`adm-filter${venue === 'kalshi' ? ' is-active' : ''}`} onClick={() => setVenue('kalshi')}>Kalshi</button>
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Search by symbol or text..." />
          </div>
        </div>

        <table className="adm-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>YES / NO</th>
              <th>Δ 24h</th>
              <th>Vol 24h</th>
              <th>OI</th>
              <th>Whales</th>
              <th>Resolves</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.sym}>
                <td>
                  <a href="App-Market-Detail.html" style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{m.sym}</span>
                      {m.hot && <span className="adm-pill is-warn" style={{ height: 14, fontSize: 9 }}>HOT</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{m.name}</div>
                    <UsrVenueBadge venue={m.venue} />
                  </a>
                </td>
                <td style={{ minWidth: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className="mono tabnum" style={{ color: 'var(--gain-text)', fontWeight: 600 }}>¢{m.yes}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', fontSize: 10 }}>/</span>
                    <span className="mono tabnum" style={{ color: 'var(--loss-text)' }}>¢{100 - m.yes}</span>
                  </div>
                  <MicroBookViz yes={m.yes} />
                </td>
                <td className="col-num" style={{ color: m.chg >= 0 ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.chg >= 0 ? '+' : ''}{m.chg.toFixed(1)}%</td>
                <td className="col-mono col-secondary">{m.vol}</td>
                <td className="col-mono col-tertiary">{m.oi}</td>
                <td className="col-num">{m.whales || '—'}</td>
                <td className="col-mono col-tertiary">{m.resolves}</td>
                <td><a href="App-Market-Detail.html" className="row-action"><AdmIcon name="arrow-up-right" size={13} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span>Showing {filtered.length} markets · sort <span style={{ color: 'var(--text-secondary)' }}>vol 24h ↓</span></span>
          <div className="adm-pagination">
            <button disabled>‹</button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
