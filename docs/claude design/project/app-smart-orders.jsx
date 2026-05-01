/* Polyforge — Smart Orders
   Algorithmic execution: TWAP, VWAP, Iceberg, Sniper. Active orders + create form. */

const SO_RUNNING = [
  { id: 'SO-7382', algo: 'TWAP',    market: 'FED-CUT-JUL · YES', side: 'BUY',  notional: '$48,000', filled: '62%',  remaining: '$18,240', vwap: '¢73.4', target: '¢74.0', started: '38m ago', endsIn: '52m',  status: 'running' },
  { id: 'SO-7361', algo: 'VWAP',    market: 'BTC-150K-DEC · NO', side: 'SELL', notional: '$22,400', filled: '34%',  remaining: '$14,784', vwap: '¢62.1', target: '¢62.0', started: '14m ago', endsIn: '1h 46m', status: 'running' },
  { id: 'SO-7344', algo: 'Iceberg', market: 'ELEC28-DEM · YES',  side: 'BUY',  notional: '$120,000', filled: '18%', remaining: '$98,400', vwap: '¢42.8', target: '¢43.5', started: '6m ago',  endsIn: '—',     status: 'running' },
  { id: 'SO-7298', algo: 'Sniper',  market: 'CPI-MAR-COOL · YES', side: 'BUY', notional: '$8,400',  filled: '0%',   remaining: '$8,400',  vwap: '—',    target: '≤ ¢56', started: '2m ago',  endsIn: '—',     status: 'waiting' },
];

const SO_RECENT = [
  { id: 'SO-7251', algo: 'TWAP',    market: 'TARIFF-CHN-25', side: 'BUY',  notional: '$32,000', vwap: '¢58.2', target: '¢58.5', slip: '-0.3¢', dur: '1h 02m', when: '2h ago' },
  { id: 'SO-7224', algo: 'VWAP',    market: 'NVDA-EARN-Q1',  side: 'SELL', notional: '$14,800', vwap: '¢42.4', target: '¢42.5', slip: '-0.1¢', dur: '48m',    when: '6h ago' },
  { id: 'SO-7188', algo: 'Iceberg', market: 'OSCARS-OPP',    side: 'BUY',  notional: '$48,000', vwap: '¢81.6', target: '¢82.0', slip: '-0.4¢', dur: '4h 12m', when: '1d ago' },
  { id: 'SO-7142', algo: 'Sniper',  market: 'NFL-SB-CHIEFS', side: 'BUY',  notional: '$6,200',  vwap: '¢34.0', target: '≤ ¢34',  slip: '0¢',    dur: '14m',    when: '2d ago' },
];

const SO_ALGO_KIND = {
  TWAP:    { color: 'var(--accent-default)', desc: 'Time-weighted slices · evenly distributed' },
  VWAP:    { color: '#10b981',                desc: 'Volume-weighted · matches market profile' },
  Iceberg: { color: '#f59e0b',                desc: 'Display only N% · refresh on fill' },
  Sniper:  { color: '#a78bfa',                desc: 'Wait for limit · single shot' },
};

function App() {
  const [tab, setTab] = React.useState('active');
  const [algo, setAlgo] = React.useState('TWAP');
  const [side, setSide] = React.useState('BUY');
  const [notional, setNotional] = React.useState('25000');
  const [duration, setDuration] = React.useState('60');

  return (
    <UsrShell active="smart-orders" title="Smart orders" crumbs={[
      { label: 'Orders', href: 'App-Orders.html' },
      { label: 'Smart orders' },
    ]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New smart order</button>
    }>
      <AdmPageHead
        title="Smart orders"
        sub="Algorithmic execution for size that won't fit a single click · TWAP, VWAP, Iceberg, Sniper"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Running" value={SO_RUNNING.filter(o => o.status === 'running').length} delta={`${SO_RUNNING.filter(o => o.status === 'waiting').length} waiting`} deltaKind="warn" />
        <AdmStat label="Filled today"   value="$284K" delta="across 11 orders" deltaKind="neutral" />
        <AdmStat label="Avg slippage"   value="-0.24¢" delta="vs target · 30d" deltaKind="gain" />
        <AdmStat label="Saved vs market" value="$1,840" delta="last 30d" deltaKind="gain" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        {/* Left: orders */}
        <div>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 0, marginBottom: 12 }}>
            {[
              { id: 'active', label: `Active (${SO_RUNNING.length})` },
              { id: 'recent', label: `Recent (${SO_RECENT.length})` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`} style={{ borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent', padding: '10px 16px', fontSize: 12.5, marginBottom: -1, transition: 'color 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'active' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <table className="adm-table">
                <thead><tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Algo</th>
                  <th>Market</th>
                  <th>Side</th>
                  <th style={{ textAlign: 'right' }}>Notional</th>
                  <th style={{ width: 140 }}>Progress</th>
                  <th style={{ textAlign: 'right' }}>VWAP</th>
                  <th>Ends in</th>
                  <th style={{ width: 80 }}></th>
                </tr></thead>
                <tbody>
                  {SO_RUNNING.map(o => {
                    const pct = parseInt(o.filled);
                    const ak = SO_ALGO_KIND[o.algo];
                    return (
                      <tr key={o.id}>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: ak.color }} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{o.algo}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{o.market}</td>
                        <td><span className={`adm-pill ${o.side === 'BUY' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{o.side}</span></td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{o.notional}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: o.status === 'waiting' ? 'var(--text-tertiary)' : 'var(--accent-default)' }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 32 }}>{o.filled}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{o.vwap}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{o.endsIn}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="adm-btn adm-btn-secondary" style={{ height: 24, fontSize: 10.5, padding: '0 8px' }}>Pause</button>
                            <button className="adm-btn adm-btn-secondary" style={{ height: 24, fontSize: 10.5, padding: '0 8px', color: 'var(--loss-text)', borderColor: 'var(--border-subtle)' }}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'recent' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <table className="adm-table">
                <thead><tr>
                  <th>ID</th><th>Algo</th><th>Market</th><th>Side</th>
                  <th style={{ textAlign: 'right' }}>Notional</th>
                  <th style={{ textAlign: 'right' }}>VWAP</th>
                  <th style={{ textAlign: 'right' }}>vs target</th>
                  <th>Duration</th><th>When</th>
                </tr></thead>
                <tbody>
                  {SO_RECENT.map(o => {
                    const ak = SO_ALGO_KIND[o.algo];
                    const slipNum = parseFloat(o.slip);
                    return (
                      <tr key={o.id}>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: ak.color }} />
                            <span style={{ fontSize: 12 }}>{o.algo}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{o.market}</td>
                        <td><span className={`adm-pill ${o.side === 'BUY' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{o.side}</span></td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{o.notional}</td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{o.vwap}</td>
                        <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: slipNum < 0 ? 'var(--gain-text)' : slipNum > 0 ? 'var(--loss-text)' : 'var(--text-secondary)' }}>{o.slip}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{o.dur}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{o.when}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: create form */}
        <div className="adm-card" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>New smart order</h3>

          {/* Algo picker */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16 }}>
            {Object.keys(SO_ALGO_KIND).map(a => (
              <button
                key={a}
                onClick={() => setAlgo(a)}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  background: algo === a ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${algo === a ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: SO_ALGO_KIND[a].color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.3 }}>{SO_ALGO_KIND[a].desc}</div>
              </button>
            ))}
          </div>

          {/* Market */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Market</label>
            <input className="adm-input mono" defaultValue="FED-CUT-JUL" style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
          </div>

          {/* Side */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Side</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => setSide('BUY')}
                style={{
                  justifyContent: 'center', display: 'inline-flex', alignItems: 'center',
                  padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                  background: side === 'BUY' ? 'var(--gain-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${side === 'BUY' ? 'var(--gain)' : 'var(--border-subtle)'}`,
                  color: side === 'BUY' ? 'var(--gain-text)' : 'var(--text-secondary)',
                }}
              >BUY YES</button>
              <button
                onClick={() => setSide('SELL')}
                style={{
                  justifyContent: 'center', display: 'inline-flex', alignItems: 'center',
                  padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                  background: side === 'SELL' ? 'var(--loss-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${side === 'SELL' ? 'var(--loss)' : 'var(--border-subtle)'}`,
                  color: side === 'SELL' ? 'var(--loss-text)' : 'var(--text-secondary)',
                }}
              >BUY NO</button>
            </div>
          </div>

          {/* Notional */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Notional ($)</label>
            <input className="adm-input mono" value={notional} onChange={e => setNotional(e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
          </div>

          {(algo === 'TWAP' || algo === 'VWAP') && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Duration (minutes)</label>
              <input className="adm-input mono" value={duration} onChange={e => setDuration(e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
            </div>
          )}

          {algo === 'Iceberg' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Display size (% of total)</label>
              <input className="adm-input mono" defaultValue="10" style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
            </div>
          )}

          {algo === 'Sniper' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Limit price (¢)</label>
              <input className="adm-input mono" defaultValue="56" style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
            </div>
          )}

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
            Estimated VWAP: <strong style={{ color: 'var(--text-primary)' }}>¢73.4</strong> · Estimated slip: <strong style={{ color: 'var(--gain-text)' }}>-0.3¢</strong>
          </div>

          <button className="adm-btn adm-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Submit smart order</button>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);