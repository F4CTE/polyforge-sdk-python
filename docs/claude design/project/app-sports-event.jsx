/* Polyforge — Sports event detail
   Single matchup with all available markets: ML, spread, total, props. */

const SE_EVENT = {
  league: 'NBA',
  matchup: 'Lakers @ Warriors',
  time: 'Tonight 8:30 PM PT · Chase Center',
  status: 'Pre-game · 4h 22m',
  away: { team: 'Los Angeles Lakers', short: 'LAL', record: '38-32', form: 'L,W,L,W,W' },
  home: { team: 'Golden State Warriors', short: 'GSW', record: '42-28', form: 'W,W,L,W,W' },
};

const SE_MARKETS = {
  moneyline: [
    { side: 'LAL', price: '+148', impl: '40.3%', fair: '52.0%', edge: '+11.7%', vol: '$420K' },
    { side: 'GSW', price: '-172', impl: '63.2%', fair: '48.0%', edge: '-15.2%', vol: '$680K' },
  ],
  spread: [
    { side: 'LAL +4.5', price: '-110', impl: '52.4%', fair: '54.0%', edge: '+1.6%', vol: '$340K' },
    { side: 'GSW -4.5', price: '-110', impl: '52.4%', fair: '46.0%', edge: '-6.4%', vol: '$320K' },
  ],
  total: [
    { side: 'Over 224.5',  price: '-108', impl: '51.9%', fair: '54.0%', edge: '+2.1%', vol: '$220K' },
    { side: 'Under 224.5', price: '-112', impl: '52.8%', fair: '46.0%', edge: '-6.8%', vol: '$210K' },
  ],
  props: [
    { name: 'LeBron James over 26.5 pts', price: '-115', impl: '53.5%', fair: '58%', edge: '+4.5%' },
    { name: 'Steph Curry over 4.5 threes', price: '+105', impl: '48.8%', fair: '46%', edge: '-2.8%' },
    { name: 'Anthony Davis over 12.5 reb',  price: '-122', impl: '55.0%', fair: '60%', edge: '+5.0%' },
    { name: 'Klay Thompson over 18.5 pts',  price: '+102', impl: '49.5%', fair: '52%', edge: '+2.5%' },
  ],
};

function SeRow({ m, kind }) {
  const edgePos = m.edge.startsWith('+');
  return (
    <tr>
      <td><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.side || m.name}</span></td>
      <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{m.price}</td>
      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{m.impl}</td>
      <td className="mono" style={{ textAlign: 'right', color: 'var(--accent-text)', fontWeight: 600 }}>{m.fair}</td>
      <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: edgePos ? 'var(--gain-text)' : 'var(--loss-text)' }}>{m.edge}</td>
      {m.vol && <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{m.vol}</td>}
      <td><button className="adm-btn adm-btn-sm adm-btn-secondary">Trade</button></td>
    </tr>
  );
}

function SeMarketTable({ title, sub, rows, withVol = true }) {
  return (
    <div className="adm-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      <table className="adm-table" style={{ marginTop: 0 }}>
        <thead>
          <tr>
            <th>Selection</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Implied</th>
            <th style={{ textAlign: 'right' }}>Fair value</th>
            <th style={{ textAlign: 'right' }}>Edge</th>
            {withVol && <th style={{ textAlign: 'right' }}>Volume</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <SeRow key={i} m={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  return (
    <UsrShell active="sports-event" title={SE_EVENT.matchup} crumbs={[
      { label: 'Sports', href: 'App-Sports.html' },
      { label: 'NBA' },
      { label: SE_EVENT.matchup },
    ]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bell" size={12} />Alert me</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="bookmark" size={12} />Watch</button>
      </>
    }>
      {/* Hero matchup */}
      <div className="adm-card" style={{ padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Geist Mono, monospace' }}>{SE_EVENT.away.short}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{SE_EVENT.away.team}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{SE_EVENT.away.record} · L5: {SE_EVENT.away.form}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{SE_EVENT.league}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-tertiary)', margin: '8px 0' }}>@</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{SE_EVENT.time}</div>
          <div style={{ marginTop: 8 }}>
            <span className="adm-pill has-dot is-warn is-pulse">{SE_EVENT.status}</span>
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Geist Mono, monospace' }}>{SE_EVENT.home.short}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{SE_EVENT.home.team}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{SE_EVENT.home.record} · L5: {SE_EVENT.home.form}</div>
        </div>
      </div>

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Total volume" value="$2.4M" delta="across all markets" deltaKind="neutral" />
        <AdmStat label="Best edge" value="+11.7%" delta="LAL ML · vs fair" deltaKind="gain" />
        <AdmStat label="Markets open" value="38" delta="ML · spread · total · props" deltaKind="neutral" />
        <AdmStat label="Fair-value confidence" value="High" delta="model + historical fit" deltaKind="gain" />
      </div>

      <SeMarketTable title="Moneyline" sub="Win-only · settles at final whistle" rows={SE_MARKETS.moneyline} />
      <SeMarketTable title="Spread" sub="Point spread · push refunds" rows={SE_MARKETS.spread} />
      <SeMarketTable title="Total points" sub="Over/under · combined score" rows={SE_MARKETS.total} />

      {/* Player props */}
      <div className="adm-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Player props</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>4 of 38 props · sorted by edge</div>
        </div>
        <table className="adm-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>Selection</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Implied</th>
              <th style={{ textAlign: 'right' }}>Fair</th>
              <th style={{ textAlign: 'right' }}>Edge</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SE_MARKETS.props.map((p, i) => <SeRow key={i} m={p} />)}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);