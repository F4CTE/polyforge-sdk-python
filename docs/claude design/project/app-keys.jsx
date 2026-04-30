/* Polyforge — API keys & integrations */

const KEYS = [
  { id: 'pk_live_8a91f4c2e7Jc2', label: 'Production · Trading bot',     created: '2026-04-22', last: '2 min ago',   scope: ['trade.read', 'trade.write', 'orders.cancel'], state: 'active', env: 'live' },
  { id: 'pk_paper_44k2x9zR0aB1', label: 'Paper · Local dev',             created: '2026-03-18', last: '14 min ago',  scope: ['trade.read', 'trade.write'],                  state: 'active', env: 'paper' },
  { id: 'pk_live_3lq6n8m4jXp9w', label: 'Read-only · Grafana exporter', created: '2026-02-10', last: '38 min ago',  scope: ['portfolio.read', 'orders.read'],              state: 'active', env: 'live' },
  { id: 'pk_live_revoked01x',    label: 'Old laptop',                    created: '2025-11-04', last: '3 days ago',  scope: ['trade.read'],                                  state: 'revoked', env: 'live' },
];

const INTEGRATIONS = [
  { name: 'Polymarket',     status: 'connected', wallet: '0x4f...c81a',     icon: 'P', color: '#4F6EF7', meta: 'EOA · USDC bal $4,892.18' },
  { name: 'Kalshi',         status: 'connected', wallet: 'API · ada@…',     icon: 'K', color: '#16A34A', meta: 'L1 verified · USD bal $3,914.24' },
  { name: 'Coinbase',       status: 'connected', wallet: 'OAuth',           icon: 'C', color: '#1652F0', meta: 'For deposits & withdrawals' },
  { name: 'Telegram bot',   status: 'connected', wallet: '@ada_polyforge',  icon: 'T', color: '#229ED9', meta: 'Push: fills · whales · risk' },
  { name: 'Discord webhook', status: 'connected', wallet: '#trading-floor', icon: 'D', color: '#5865F2', meta: 'Push: daily P&L summary' },
  { name: 'Slack',          status: 'disconnected', wallet: '—',            icon: 'S', color: '#4A154B', meta: 'Connect to push fills + risk events' },
  { name: 'Zapier',         status: 'disconnected', wallet: '—',            icon: 'Z', color: '#FF4F00', meta: '500+ apps · trigger on signals' },
  { name: 'Claude · MCP',   status: 'connected', wallet: 'mcp://polyforge', icon: 'A', color: '#D97757', meta: 'Read positions, place paper trades' },
];

function App() {
  const [showNew, setShowNew] = React.useState(false);
  return (
    <UsrShell active="keys" title="API keys & integrations" actions={
      <button className="adm-btn adm-btn-primary" onClick={() => setShowNew(true)}><AdmIcon name="plus" size={12} />New key</button>
    }>
      <AdmPageHead title="API keys & integrations" subtitle="Programmatic access to your account. Scoped, revocable, audited — keys never touch the venue's underlying credentials." />

      {showNew && (
        <div className="adm-card" style={{ padding: 20, marginBottom: 20, borderColor: 'color-mix(in srgb, var(--accent-default) 30%, var(--border-default))', background: 'color-mix(in srgb, var(--accent-default) 4%, var(--bg-card))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)' }}>
              <AdmIcon name="key" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>New API key</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>Scopes are append-only mid-key — to remove a scope, rotate. Keys shown once at creation.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Label</label>
                  <input className="adm-input" placeholder="e.g. Production trading bot" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Environment</label>
                  <select className="adm-input"><option>Live</option><option>Paper</option></select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Scopes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['trade.read', 'trade.write', 'orders.read', 'orders.cancel', 'portfolio.read', 'whales.read', 'backtests.run'].map(s => (
                    <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 6, fontFamily: 'Geist Mono, monospace', fontSize: 11, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked={s === 'trade.read'} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn adm-btn-primary">Generate key</button>
                <button className="adm-btn adm-btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>API keys</h3>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>4 keys · 3 active</span>
        </div>
        <table className="adm-table">
          <thead><tr><th>Key</th><th>Env</th><th>Scopes</th><th>Created</th><th>Last used</th><th>State</th><th></th></tr></thead>
          <tbody>
            {KEYS.map((k, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{k.label}</div>
                  <div className="col-mono col-tertiary" style={{ fontSize: 10.5 }}>{k.id.slice(0,10)}…{k.id.slice(-4)}</div>
                </td>
                <td><span className={`adm-pill ${k.env === 'live' ? 'is-loss' : 'is-accent'}`} style={{ height: 18, fontSize: 10 }}>{k.env.toUpperCase()}</span></td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {k.scope.map(s => <code key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>{s}</code>)}
                  </div>
                </td>
                <td className="col-tertiary">{k.created}</td>
                <td className="col-tertiary">{k.last}</td>
                <td><span className={`adm-pill ${k.state === 'active' ? 'is-gain' : ''} has-dot`} style={{ height: 18, fontSize: 10 }}>{k.state}</span></td>
                <td>
                  <button className="row-action" title="Copy"><AdmIcon name="copy" size={12} /></button>
                  <button className="row-action" title="Rotate"><AdmIcon name="refresh" size={12} /></button>
                  <button className="row-action" title="Revoke"><AdmIcon name="x" size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 4 }}>Integrations</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginBottom: 14 }}>Wallets, exchanges, agents, and notification channels.</p>
        <div className="adm-grid-3">
          {INTEGRATIONS.map((it, i) => (
            <div key={i} className="adm-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: it.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>{it.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</span>
                    <span className={`adm-pill ${it.status === 'connected' ? 'is-gain' : ''} has-dot`} style={{ height: 17, fontSize: 9.5 }}>{it.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>{it.meta}</div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{it.wallet}</div>
                  <button className="adm-btn adm-btn-ghost" style={{ width: '100%' }}>{it.status === 'connected' ? 'Manage' : 'Connect'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
