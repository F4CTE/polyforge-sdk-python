/* Polyforge — Activity log (audit trail) */

const ACTIVITY = [
  { t: '14:24:08', actor: 'You',                  evt: 'order.filled',         tgt: 'O-8x42n',                  meta: 'partial fill 240/420 · ¢73 · FED-CUT-JUL',           ip: '—', kind: 'fill' },
  { t: '14:18:22', actor: 'whale-mirror-politics', evt: 'order.placed',        tgt: 'O-9k1m4',                  meta: '800 NO ELEC28-DEM @ ¢58 (TWAP) · auto-mirror trigger',  ip: 'agent', kind: 'order' },
  { t: '14:11:04', actor: 'You',                  evt: 'strategy.paused',      tgt: 'orderbook-imbalance',     meta: 'manual pause from Strategies → drawdown −12.4%',         ip: '64.181.204.12', kind: 'risk' },
  { t: '14:02:11', actor: 'You',                  evt: 'order.placed',         tgt: 'O-4qm71',                  meta: '300 NO BTC-150K-DEC @ ¢69 (LIMIT)',                       ip: '64.181.204.12', kind: 'order' },
  { t: '13:54:51', actor: 'oscars-favorite-hedge', evt: 'order.filled',        tgt: 'O-7hk20',                  meta: '60 YES OSCARS-OPP @ ¢19 · realized −$11',                 ip: 'agent', kind: 'fill' },
  { t: '13:33:09', actor: 'whale-mirror-politics', evt: 'whale.signal',        tgt: '0xPanoramic',              meta: 'detected: +14,200 NO ELEC28-DEM · cohort confidence 94',  ip: 'agent', kind: 'signal' },
  { t: '13:21:00', actor: 'You',                  evt: 'auth.session_started', tgt: '—',                        meta: 'MacBook Pro · Safari · NYC · 2FA passed',                ip: '64.181.204.12', kind: 'auth' },
  { t: '12:54:08', actor: 'tariff-shock-hedger',  evt: 'order.filled',         tgt: 'O-3lp44',                  meta: '220 YES TARIFF-CHN-25 @ ¢58',                            ip: 'agent', kind: 'fill' },
  { t: '12:14:42', actor: 'fed-rate-cut-tracker', evt: 'order.filled',         tgt: 'O-1rt99',                  meta: '320 YES FED-CUT-JUL @ ¢71',                              ip: 'agent', kind: 'fill' },
  { t: '11:02:18', actor: 'system',               evt: 'event.scheduled',      tgt: 'CPI-MAR',                  meta: 'pre-event guard armed · 22h to release',                 ip: '—', kind: 'system' },
  { t: '09:15:33', actor: 'You',                  evt: 'auth.session_started', tgt: '—',                        meta: 'iPhone · Safari · NYC · 2FA passed',                     ip: '67.245.10.224', kind: 'auth' },
  { t: 'yest 22:31', actor: 'You',                evt: 'wallet.deposit',       tgt: 'TX-44818',                 meta: '+$2,000.00 USDC from Coinbase · cleared',                ip: '64.181.204.12', kind: 'wallet' },
  { t: 'yest 16:22', actor: 'You',                evt: 'strategy.created',     tgt: 'whale-mirror-politics',   meta: 'forked from Marketplace · v0 paper, 2 whales tracked',   ip: '64.181.204.12', kind: 'strategy' },
  { t: 'yest 14:01', actor: 'You',                evt: 'apikey.created',       tgt: 'pk_live_…7Jc2',            meta: 'scope: trade.read · created from Settings → API keys',   ip: '64.181.204.12', kind: 'auth' },
];

const evtColor = {
  fill:     'var(--gain-text)',
  order:    'var(--accent-text)',
  signal:   '#a78bfa',
  risk:     'var(--warn-text)',
  auth:     'var(--text-secondary)',
  wallet:   'var(--gain-text)',
  strategy: 'var(--accent-text)',
  system:   'var(--text-tertiary)',
};

function App() {
  const [filter, setFilter] = React.useState('all');
  const filtered = filter === 'all' ? ACTIVITY : ACTIVITY.filter(a => a.kind === filter);
  return (
    <UsrShell active="activity" title="Activity log" actions={
      <>
        <button className="adm-btn adm-btn-ghost"><AdmIcon name="filter" size={12} />Filters</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
      </>
    }>
      <AdmPageHead title="Activity log" subtitle="Every action your account, agents, and integrations have taken — append-only, signed, immutable." />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Events · today" value="24" delta="14 from agents" deltaKind="neutral" />
        <AdmStat label="Events · 7d" value="318" delta="71% automated" deltaKind="neutral" />
        <AdmStat label="Auth sessions" value="3" delta="all 2FA verified" deltaKind="gain" />
        <AdmStat label="Risk events" value="1" delta="1 strategy paused" deltaKind="warn" />
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-filter-group">
            <button className={`adm-filter${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>All <span className="count">{ACTIVITY.length}</span></button>
            <button className={`adm-filter${filter === 'order' ? ' is-active' : ''}`} onClick={() => setFilter('order')}>Orders</button>
            <button className={`adm-filter${filter === 'fill' ? ' is-active' : ''}`} onClick={() => setFilter('fill')}>Fills</button>
            <button className={`adm-filter${filter === 'auth' ? ' is-active' : ''}`} onClick={() => setFilter('auth')}>Auth</button>
            <button className={`adm-filter${filter === 'risk' ? ' is-active' : ''}`} onClick={() => setFilter('risk')}>Risk</button>
            <button className={`adm-filter${filter === 'wallet' ? ' is-active' : ''}`} onClick={() => setFilter('wallet')}>Wallet</button>
            <button className={`adm-filter${filter === 'strategy' ? ' is-active' : ''}`} onClick={() => setFilter('strategy')}>Strategy</button>
            <button className={`adm-filter${filter === 'signal' ? ' is-active' : ''}`} onClick={() => setFilter('signal')}>Signals</button>
          </div>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Filter by actor, event, or target..." />
          </div>
        </div>
        <table className="adm-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Target</th><th>Meta</th><th>IP</th></tr></thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={i}>
                <td className="col-mono col-tertiary">{a.t}</td>
                <td>
                  <span style={{ fontFamily: a.actor === 'You' || a.actor === 'system' ? 'inherit' : 'Geist Mono, monospace', fontSize: 11.5, color: a.actor === 'You' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{a.actor}</span>
                </td>
                <td>
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: evtColor[a.kind], fontWeight: 500 }}>{a.evt}</span>
                </td>
                <td className="col-mono col-secondary">{a.tgt}</td>
                <td className="col-secondary" style={{ fontSize: 11.5, maxWidth: 360 }}>{a.meta}</td>
                <td className="col-mono col-tertiary">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">Showing {filtered.length} events · 90-day retention · <a href="Docs.html" style={{ color: 'var(--accent-text)' }}>SIEM export</a></div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
