/* Polyforge — Whales feed
   Live feed + leaderboard + filters. */

const WH_LEADERS = [
  { who: 'unholyfist.eth',   avatar: 'UF', edge30: '+24.2%', winRate: '78%', trades: 142, vol: '$2.4M', followers: 1284, you: true,  spark: [40, 44, 48, 52, 50, 56, 58, 62, 64, 66, 70, 72, 74, 76, 80, 82, 86, 90, 92, 96, 98, 100] },
  { who: '0xtidemark',        avatar: 'TM', edge30: '+22.1%', winRate: '74%', trades: 96,  vol: '$1.8M', followers: 842,  spark: [50, 52, 54, 56, 58, 60, 64, 66, 68, 70, 72, 74, 78, 80, 82, 84, 86, 90, 92, 94, 96, 98] },
  { who: 'cassandra.x',       avatar: 'CX', edge30: '+18.6%', winRate: '71%', trades: 186, vol: '$840K', followers: 2104, you: true,  spark: [60, 58, 62, 64, 66, 68, 70, 68, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 88, 90, 92, 94] },
  { who: 'plinkochamp.eth',   avatar: 'PC', edge30: '+14.4%', winRate: '69%', trades: 84,  vol: '$1.2M', followers: 612,  spark: [55, 56, 58, 60, 58, 62, 60, 64, 66, 68, 66, 70, 72, 74, 72, 76, 78, 80, 82, 80, 84, 86] },
  { who: 'parlaymoney',       avatar: 'PM', edge30: '+9.8%',  winRate: '64%', trades: 320, vol: '$680K', followers: 384,  spark: [60, 58, 62, 60, 64, 62, 66, 64, 68, 66, 70, 68, 72, 70, 74, 72, 76, 74, 78, 76, 80, 78] },
  { who: 'bigbrain.poly',     avatar: 'BB', edge30: '+8.1%',  winRate: '62%', trades: 248, vol: '$540K', followers: 218,  spark: [58, 60, 62, 64, 62, 66, 64, 68, 66, 70, 68, 72, 70, 74, 72, 76, 74, 78, 76, 80, 78, 82] },
  { who: 'oracleseer',        avatar: 'OS', edge30: '+6.4%',  winRate: '58%', trades: 84,  vol: '$420K', followers: 162,  spark: [62, 60, 64, 62, 66, 64, 68, 66, 70, 68, 72, 70, 74, 72, 76, 74, 78, 76, 80, 78, 82, 80] },
];

const WH_FEED = [
  { who: 'unholyfist.eth',   avatar: 'UF', mins: 2,   side: 'BUY',  market: 'FED-CUT-JUL',   dir: 'YES', size: '$48,200', px: '¢73', edge: '+24.2%', mirrored: 28, fresh: true,  venue: 'kalshi' },
  { who: 'plinkochamp.eth',  avatar: 'PC', mins: 8,   side: 'SELL', market: 'ELEC28-DEM',    dir: 'YES', size: '$22,000', px: '¢42', edge: '+14.4%', mirrored: 12, fresh: true,  venue: 'polymarket' },
  { who: '0xtidemark',       avatar: 'TM', mins: 14,  side: 'BUY',  market: 'BTC-150K-DEC',  dir: 'NO',  size: '$31,200', px: '¢68', edge: '+22.1%', mirrored: 42, fresh: true,  venue: 'polymarket' },
  { who: 'cassandra.x',      avatar: 'CX', mins: 38,  side: 'BUY',  market: 'OSCARS-OPP',    dir: 'NO',  size: '$14,500', px: '¢81', edge: '+18.6%', mirrored: 18, venue: 'polymarket' },
  { who: 'parlaymoney',      avatar: 'PM', mins: 52,  side: 'SELL', market: 'NFL-SB-CHIEFS', dir: 'YES', size: '$8,400',  px: '¢34', edge: '+9.8%',  mirrored: 4,  venue: 'kalshi' },
  { who: 'bigbrain.poly',    avatar: 'BB', mins: 84,  side: 'BUY',  market: 'TARIFF-CHN-25', dir: 'YES', size: '$22,400', px: '¢58', edge: '+8.1%',  mirrored: 8,  venue: 'kalshi' },
  { who: 'unholyfist.eth',   avatar: 'UF', mins: 102, side: 'BUY',  market: 'CPI-MAR-COOL',  dir: 'YES', size: '$12,800', px: '¢56', edge: '+24.2%', mirrored: 14, venue: 'kalshi' },
  { who: 'oracleseer',       avatar: 'OS', mins: 168, side: 'SELL', market: 'NVDA-EARN-Q1',  dir: 'NO',  size: '$9,200',  px: '¢19', edge: '+6.4%',  mirrored: 2,  venue: 'kalshi' },
  { who: 'cassandra.x',      avatar: 'CX', mins: 218, side: 'BUY',  market: 'FED-CUT-JUL',   dir: 'YES', size: '$28,400', px: '¢70', edge: '+18.6%', mirrored: 36, venue: 'kalshi' },
];

function App() {
  return (
    <UsrShell active="whales" title="Whales" actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Mirror strategy</button>
    }>
      <AdmPageHead
        title="Whales"
        subtitle="Track 248 wallets · 30d edge updated every 5 min · auto-mirror via strategy block"
      />

      <div className="adm-grid-3" style={{ marginBottom: 20 }}>
        <AdmStat label="Tracked wallets" value="248" delta="+12 · 7d" deltaKind="gain" />
        <AdmStat label="Signals · 24h"   value="84"  delta="2 fresh now" deltaKind="gain" />
        <AdmStat label="Your mirror P&L · 30d" value="+$612" delta="+8.1%" deltaKind="gain" />
      </div>

      <div className="adm-grid-2">
        {/* Live feed */}
        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Live feed</h3>
            <span className="usr-rec">STREAMING</span>
            <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
              <button className="adm-filter is-active">All</button>
              <button className="adm-filter">Followed</button>
              <button className="adm-filter">$10k+</button>
            </div>
          </div>
          <div>
            {WH_FEED.map((w, i) => (
              <div key={i} className={`usr-whale-card${w.fresh ? ' is-fresh' : ''}`}>
                <div className="usr-whale-avatar">{w.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{w.who}</span>
                    <span className={`adm-pill ${w.side === 'BUY' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{w.side}</span>
                    <span className={`adm-pill ${w.dir === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 16, fontSize: 9.5 }}>{w.dir}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-primary)' }}>{w.market}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{w.mins < 60 ? `${w.mins}m ago` : `${Math.round(w.mins / 60)}h ago`}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{w.size}</span>
                    <span>@ {w.px}</span>
                    <UsrVenueBadge venue={w.venue} />
                    <span style={{ color: 'var(--text-tertiary)' }}>30d edge <span style={{ color: 'var(--gain-text)' }}>{w.edge}</span></span>
                    <span style={{ color: 'var(--text-tertiary)' }}>· {w.mirrored} users mirrored</span>
                  </div>
                </div>
                <button className="adm-btn adm-btn-sm adm-btn-secondary">Mirror</button>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Leaderboard · 30d</h3>
            <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
              <button className="adm-filter is-active">Edge</button>
              <button className="adm-filter">Volume</button>
              <button className="adm-filter">Win rate</button>
            </div>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Wallet</th>
                <th>30d edge</th>
                <th>Win</th>
                <th>Trades</th>
                <th>Vol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {WH_LEADERS.map((w, i) => (
                <tr key={w.who}>
                  <td className="col-mono col-tertiary">{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="usr-whale-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{w.avatar}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 500 }}>{w.who}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{w.followers.toLocaleString()} followers</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--gain-text)', fontWeight: 600, fontSize: 12 }}>{w.edge30}</span>
                      <AdmSpark points={w.spark} kind="gain" height={16} />
                    </div>
                  </td>
                  <td className="col-num">{w.winRate}</td>
                  <td className="col-num">{w.trades}</td>
                  <td className="col-mono col-secondary">{w.vol}</td>
                  <td>
                    {w.you ? <span className="adm-pill is-accent" style={{ height: 18, fontSize: 9.5 }}>FOLLOWING</span> : <button className="adm-btn adm-btn-sm adm-btn-ghost"><AdmIcon name="plus" size={11} />Follow</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
