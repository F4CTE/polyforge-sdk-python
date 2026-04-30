/* Polyforge — Notifications */

const NOTIFS = [
  { id: 'n1', t: '14:24', read: false, kind: 'fill',     icon: 'cart',     accent: 'var(--gain-text)', title: 'Filled · 240/420 of FED-CUT-JUL @ ¢73', body: 'fed-rate-cut-tracker · Kalshi', cta: 'View order' },
  { id: 'n2', t: '14:18', read: false, kind: 'whale',    icon: 'trending', accent: 'var(--accent-text)', title: '0xPanoramic added 14,200 NO on ELEC28-DEM', body: 'Whale you follow · 18 min ago', cta: 'Mirror trade' },
  { id: 'n3', t: '14:11', read: false, kind: 'risk',     icon: 'alert',    accent: 'var(--warn-text)', title: 'Strategy paused · drawdown −12.4%', body: 'orderbook-imbalance hit your daily kill switch threshold.', cta: 'Review' },
  { id: 'n4', t: '13:54', read: false, kind: 'system',   icon: 'check',    accent: 'var(--gain-text)', title: 'Backtest complete · cpi-cool-fade-v3', body: 'Sharpe 2.18 · Win rate 67% · 4.1k trades', cta: 'Open report' },
  { id: 'n5', t: '11:02', read: true,  kind: 'event',    icon: 'calendar', accent: 'var(--text-secondary)', title: 'CPI release in 22h 18m', body: 'Active strategies will trigger pre-event guards.', cta: null },
  { id: 'n6', t: '09:15', read: true,  kind: 'system',   icon: 'shield',   accent: 'var(--text-secondary)', title: 'New device signed in · MacBook Pro · NYC', body: 'If this wasn\'t you, revoke immediately.', cta: 'Review device' },
  { id: 'n7', t: 'yest',  read: true,  kind: 'fill',     icon: 'cart',     accent: 'var(--gain-text)', title: 'Filled · 200/200 of CPI-MAR-COOL @ ¢56', body: 'cpi-cool-fade · Kalshi · +$78', cta: null },
  { id: 'n8', t: 'yest',  read: true,  kind: 'whale',    icon: 'trending', accent: 'var(--text-secondary)', title: 'WhaleBuckMason exited 8,400 NO on BTC-150K-DEC', body: 'You have a position in this market.', cta: 'View market' },
  { id: 'n9', t: '2d',    read: true,  kind: 'system',   icon: 'check',    accent: 'var(--text-secondary)', title: 'Strategy whale-mirror-politics promoted to live', body: 'Approved by you · running for 18h', cta: null },
];

function App() {
  const [filter, setFilter] = React.useState('all');
  const [items, setItems] = React.useState(NOTIFS);
  const filtered = items.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.kind === filter;
  });
  const unread = items.filter(n => !n.read).length;
  return (
    <UsrShell active="notifications" title="Notifications" actions={
      <>
        <button className="adm-btn adm-btn-ghost" onClick={() => setItems(items.map(i => ({ ...i, read: true })))}>Mark all read</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Preferences</button>
      </>
    }>
      <AdmPageHead title="Notifications" subtitle={`${unread} unread · fills, whales, risk events, and system updates.`} />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Filter rail */}
        <aside className="adm-card" style={{ padding: 12, alignSelf: 'start', position: 'sticky', top: 84 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, padding: '4px 8px' }}>Filter</div>
          {[
            { id: 'all',    label: 'All',         count: items.length },
            { id: 'unread', label: 'Unread',      count: unread },
            { id: 'fill',   label: 'Fills',       count: items.filter(i => i.kind === 'fill').length },
            { id: 'whale',  label: 'Whales',      count: items.filter(i => i.kind === 'whale').length },
            { id: 'risk',   label: 'Risk',        count: items.filter(i => i.kind === 'risk').length },
            { id: 'event',  label: 'Events',      count: items.filter(i => i.kind === 'event').length },
            { id: 'system', label: 'System',      count: items.filter(i => i.kind === 'system').length },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '7px 10px', borderRadius: 6, background: filter === f.id ? 'var(--bg-hover)' : 'transparent',
              border: 'none', color: filter === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer', marginBottom: 2, fontWeight: filter === f.id ? 500 : 400, textAlign: 'left'
            }}>
              <span>{f.label}</span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)' }}>{f.count}</span>
            </button>
          ))}
        </aside>

        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((n, i) => (
            <div key={n.id} style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr auto',
              gap: 12,
              padding: '14px 18px',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: !n.read ? 'color-mix(in srgb, var(--accent-default) 4%, transparent)' : 'transparent',
              alignItems: 'flex-start',
              position: 'relative'
            }}>
              {!n.read && <span style={{ position: 'absolute', left: 6, top: 22, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-default)' }} />}
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.accent, border: '1px solid var(--border-subtle)' }}>
                <AdmIcon name={n.icon} size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4, fontWeight: !n.read ? 500 : 400 }}>{n.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{n.body}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{n.t}</span>
                {n.cta && <button className="adm-btn adm-btn-ghost" style={{ height: 22, fontSize: 11 }}>{n.cta}</button>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No notifications match this filter.</div>
          )}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
