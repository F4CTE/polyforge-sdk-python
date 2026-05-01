/* Polyforge — Sports markets hub
   Kalshi-style sports section: leagues, today's events, featured matchups. */

const SP_LEAGUES = [
  { id: 'nba',  name: 'NBA',          icon: '🏀', events: 14, vol: '$24.4M' },
  { id: 'nfl',  name: 'NFL',          icon: '🏈', events: 0,  vol: '—' },
  { id: 'mlb',  name: 'MLB',          icon: '⚾', events: 22, vol: '$8.2M' },
  { id: 'nhl',  name: 'NHL',          icon: '🏒', events: 8,  vol: '$3.4M' },
  { id: 'soc',  name: 'Soccer',       icon: '⚽', events: 38, vol: '$12.8M' },
  { id: 'mma',  name: 'MMA',          icon: '🥊', events: 6,  vol: '$2.1M' },
  { id: 'ten',  name: 'Tennis',       icon: '🎾', events: 12, vol: '$1.8M' },
  { id: 'gol',  name: 'Golf',         icon: '⛳', events: 4,  vol: '$890K' },
];

const SP_TODAY = [
  { league: 'NBA', event: 'Lakers @ Warriors',     time: 'Tonight 8:30 PM PT', volume: '$1.2M', market: 'Lakers ML', price: '+148', myProb: '52%' },
  { league: 'NBA', event: 'Celtics @ Heat',        time: 'Tonight 7:00 PM ET', volume: '$840K',  market: 'Celtics -4.5', price: '-110', myProb: '68%' },
  { league: 'MLB', event: 'Dodgers @ Padres',      time: 'Tonight 9:40 PM PT', volume: '$420K', market: 'Over 7.5', price: '+102', myProb: '54%' },
  { league: 'NHL', event: 'Rangers @ Islanders',   time: 'Tonight 7:30 PM ET', volume: '$280K', market: 'Rangers ML', price: '-122', myProb: '58%' },
  { league: 'Soccer', event: 'Real Madrid vs Bayern', time: 'Tomorrow 3:00 PM ET', volume: '$2.4M', market: 'Real Madrid', price: '+165', myProb: '46%' },
];

const SP_FUTURES = [
  { league: 'NBA',    name: '2026 NBA Finals winner',         topPick: 'Boston Celtics',     prob: '24%', volume: '$8.4M' },
  { league: 'NBA',    name: '2026 NBA MVP',                   topPick: 'Nikola Jokić',       prob: '32%', volume: '$3.2M' },
  { league: 'NFL',    name: 'Super Bowl LXI champion',        topPick: 'Kansas City Chiefs', prob: '18%', volume: '$22.4M' },
  { league: 'Soccer', name: 'Premier League 2025–26 winner',  topPick: 'Manchester City',    prob: '38%', volume: '$4.8M' },
];

function SpFloatingCard({ event }) {
  return (
    <a href="App-Sports-Event.html" className="adm-card" style={{
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none',
      borderLeft: '3px solid var(--accent-default)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="adm-pill" style={{ fontSize: 10 }}>{event.league}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{event.time}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{event.event}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Top market</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{event.market}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{event.price}</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--accent-text)' }}>{event.myProb} fair</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{event.volume} volume</div>
    </a>
  );
}

function App() {
  const [league, setLeague] = React.useState('all');

  return (
    <UsrShell active="sports" title="Sports" crumbs={[{ label: 'Sports' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Game alerts</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Preferences</button>
      </>
    }>
      <AdmPageHead
        title="Sports markets"
        sub="Live events from major leagues · Polyforge fair-value model · all markets settle on Polymarket"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Live events" value="104" delta="across 8 leagues" deltaKind="neutral" />
        <AdmStat label="24h volume" value="$53.6M" delta="+12% · vs avg" deltaKind="gain" />
        <AdmStat label="Featured tonight" value="14" delta="NBA · MLB · NHL" deltaKind="neutral" />
        <AdmStat label="Edge plays" value="6" delta="≥3% mispricing" deltaKind="gain" />
      </div>

      {/* League grid */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Leagues</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {SP_LEAGUES.map(l => (
            <button key={l.id}
              onClick={() => setLeague(l.id)}
              className="adm-card"
              style={{
                padding: 14, textAlign: 'left', cursor: 'pointer',
                background: league === l.id ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                borderColor: league === l.id ? 'var(--accent-border)' : undefined,
                font: 'inherit', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
              <div style={{ fontSize: 22 }}>{l.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {l.events > 0 ? `${l.events} live · ${l.vol}` : 'Off-season'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tonight's slate */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Tonight's slate</div>
          <a href="#" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none' }}>See all events →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {SP_TODAY.map((e, i) => <SpFloatingCard key={i} event={e} />)}
        </div>
      </div>

      {/* Futures */}
      <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Season-long futures</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>Long-tenor markets · settle at end of season</div>
        </div>
        <table className="adm-table" style={{ marginTop: 0 }}>
          <thead>
            <tr><th>League</th><th>Market</th><th>Top pick</th><th style={{ textAlign: 'right' }}>Probability</th><th style={{ textAlign: 'right' }}>Volume</th><th></th></tr>
          </thead>
          <tbody>
            {SP_FUTURES.map((f, i) => (
              <tr key={i}>
                <td><span className="adm-pill" style={{ fontSize: 10 }}>{f.league}</span></td>
                <td><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</span></td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{f.topPick}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{f.prob}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{f.volume}</td>
                <td><a href="App-Sports-Event.html" className="adm-btn adm-btn-sm adm-btn-secondary">View</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);