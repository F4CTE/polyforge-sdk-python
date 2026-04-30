/* Polyforge — Orders & Fills */

const ORDERS_OPEN = [
  { id: 'O-8x42n', t: '14:24', mk: 'FED-CUT-JUL', side: 'YES', type: 'LIMIT', px: 73, sz: 420, filled: 240, strat: 'fed-rate-cut-tracker', venue: 'kalshi', state: 'partial' },
  { id: 'O-9k1m4', t: '14:18', mk: 'ELEC28-DEM',  side: 'NO',  type: 'TWAP',  px: 58, sz: 800, filled: 180, strat: 'whale-mirror-politics', venue: 'polymarket', state: 'partial' },
  { id: 'O-2zb98', t: '14:11', mk: 'CPI-MAR-COOL',side: 'YES', type: 'LIMIT', px: 56, sz: 200, filled: 0,   strat: 'cpi-cool-fade',  venue: 'kalshi', state: 'open' },
  { id: 'O-4qm71', t: '14:02', mk: 'BTC-150K-DEC',side: 'NO',  type: 'LIMIT', px: 69, sz: 300, filled: 0,   strat: 'whale-mirror-politics', venue: 'polymarket', state: 'open' },
];

const FILLS = [
  { t: '14:24:08', mk: 'FED-CUT-JUL',  side: 'YES', sz: 420, px: 73, val: '+$306', kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
  { t: '14:18:22', mk: 'ELEC28-DEM',   side: 'NO',  sz: 180, px: 58, val: '+$104', kind: 'gain', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { t: '14:11:04', mk: 'CPI-MAR-COOL', side: 'YES', sz: 140, px: 56, val: '+$78',  kind: 'gain', strat: 'cpi-cool-fade', venue: 'kalshi' },
  { t: '13:54:51', mk: 'OSCARS-OPP',   side: 'YES', sz: 60,  px: 19, val: '−$11',  kind: 'loss', strat: 'oscars-favorite-hedge', venue: 'polymarket' },
  { t: '13:47:18', mk: 'FED-CUT-JUL',  side: 'YES', sz: 200, px: 72, val: '+$142', kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
  { t: '13:33:09', mk: 'BTC-150K-DEC', side: 'NO',  sz: 90,  px: 69, val: '−$24',  kind: 'loss', strat: 'whale-mirror-politics', venue: 'polymarket' },
  { t: '13:22:42', mk: 'NFL-SB-CHIEFS',side: 'YES', sz: 300, px: 34, val: '+$58',  kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
  { t: '12:54:08', mk: 'TARIFF-CHN-25',side: 'YES', sz: 220, px: 58, val: '+$84',  kind: 'gain', strat: 'tariff-shock-hedger', venue: 'kalshi' },
  { t: '12:14:42', mk: 'FED-CUT-JUL',  side: 'YES', sz: 320, px: 71, val: '+$224', kind: 'gain', strat: 'fed-rate-cut-tracker', venue: 'kalshi' },
];

function App() {
  const [tab, setTab] = React.useState('open');
  return (
    <UsrShell active="orders" title="Orders & fills" actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export CSV</button>
        <button className="adm-btn adm-btn-danger"><AdmIcon name="x" size={12} />Cancel all</button>
      </>
    }>
      <AdmPageHead
        title="Orders & fills"
        subtitle="4 open · 26 filled today · combined notional $4,820"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Open orders" value="4" delta="$2,140 working" deltaKind="neutral" />
        <AdmStat label="Filled today" value="26" delta="$4,820 notional" deltaKind="neutral" />
        <AdmStat label="Net P&L · today" value="+$372" delta="+2.98%" deltaKind="gain" />
        <AdmStat label="Avg slippage" value="0.4¢" delta="−0.2¢ vs avg" deltaKind="gain" />
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            <button className={`adm-filter${tab === 'open' ? ' is-active' : ''}`} onClick={() => setTab('open')}>Open <span className="count">{ORDERS_OPEN.length}</span></button>
            <button className={`adm-filter${tab === 'fills' ? ' is-active' : ''}`} onClick={() => setTab('fills')}>Fills · today <span className="count">{FILLS.length}</span></button>
            <button className="adm-filter">Cancelled <span className="count">2</span></button>
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Filter by strategy or market..." />
          </div>
        </div>

        {tab === 'open' ? (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Time</th>
                <th>Market</th>
                <th>Side</th>
                <th>Type</th>
                <th>Px</th>
                <th>Filled / Size</th>
                <th>Strategy</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ORDERS_OPEN.map(o => {
                const pct = (o.filled / o.sz) * 100;
                return (
                  <tr key={o.id}>
                    <td className="col-mono col-id">{o.id}</td>
                    <td className="col-mono col-tertiary">{o.t}</td>
                    <td>
                      <div className="col-mono" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{o.mk}</div>
                      <UsrVenueBadge venue={o.venue} />
                    </td>
                    <td><span className={`adm-pill ${o.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 18, fontSize: 10 }}>{o.side}</span></td>
                    <td className="col-mono col-secondary">{o.type}</td>
                    <td className="col-mono">¢{o.px}</td>
                    <td style={{ minWidth: 140 }}>
                      <div className="col-mono" style={{ fontSize: 11, marginBottom: 4 }}>{o.filled} / {o.sz}</div>
                      <div className="usr-fill-gauge"><span style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className="col-mono col-secondary">{o.strat}</td>
                    <td>
                      <span className={`adm-pill ${o.state === 'partial' ? 'is-warn' : ''} has-dot is-pulse`} style={{ height: 18, fontSize: 10 }}>{o.state.toUpperCase()}</span>
                    </td>
                    <td>
                      <button className="row-action" title="Cancel"><AdmIcon name="x" size={12} /></button>
                      <button className="row-action" title="Edit"><AdmIcon name="edit" size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Market</th>
                <th>Side</th>
                <th>Size</th>
                <th>Px</th>
                <th>Strategy</th>
                <th>Venue</th>
                <th className="col-num">P&L</th>
              </tr>
            </thead>
            <tbody>
              {FILLS.map((f, i) => (
                <tr key={i}>
                  <td className="col-mono col-tertiary">{f.t}</td>
                  <td className="col-mono">{f.mk}</td>
                  <td><span className={`adm-pill ${f.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ height: 18, fontSize: 10 }}>{f.side}</span></td>
                  <td className="col-num">{f.sz}</td>
                  <td className="col-mono">¢{f.px}</td>
                  <td className="col-mono col-secondary">{f.strat}</td>
                  <td><UsrVenueBadge venue={f.venue} /></td>
                  <td className="col-num" style={{ color: f.kind === 'gain' ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>{f.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="adm-table-foot">
          <span>Net <span style={{ color: 'var(--gain-text)' }}>+$961</span> across shown rows · {FILLS.length} fills today</span>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
