/* Polyforge — Support (user-side ticket list)
   "My tickets" — what the user filed; status, last update, link to Admin-Tickets.html style detail. */

const SUP_TICKETS = [
  { id: 'TCK-2148', subject: 'API key 502 errors during peak resolution windows', status: 'in-progress', priority: 'high',   updated: '12m ago', author: 'You', responses: 4, unread: true },
  { id: 'TCK-2103', subject: 'Cannot withdraw to ledger — 2FA loop',                status: 'waiting',     priority: 'high',   updated: '2h ago',  author: 'You', responses: 6 },
  { id: 'TCK-2087', subject: 'Whale-mirror block ignoring size cap',                status: 'in-progress', priority: 'medium', updated: '6h ago',  author: 'You', responses: 3, unread: true },
  { id: 'TCK-2042', subject: 'Backtest export fails after 90 days of data',         status: 'open',        priority: 'low',    updated: '1d ago',  author: 'You', responses: 1 },
  { id: 'TCK-1984', subject: 'Tax report for Q1 — missing Kalshi fills',            status: 'resolved',    priority: 'medium', updated: '3d ago',  author: 'You', responses: 8 },
  { id: 'TCK-1922', subject: 'Strategy "Macro · Fed cycle" sharing settings',       status: 'resolved',    priority: 'low',    updated: '1w ago',  author: 'You', responses: 2 },
  { id: 'TCK-1864', subject: 'Cannot enable 2FA — recovery codes not generating',   status: 'closed',      priority: 'high',   updated: '2w ago',  author: 'You', responses: 5 },
];

const SUP_STATUS = {
  'open':        { label: 'Open',        kind: '' },
  'in-progress': { label: 'In progress', kind: 'is-warn' },
  'waiting':     { label: 'Waiting on you', kind: 'is-warn' },
  'resolved':    { label: 'Resolved',    kind: 'is-gain' },
  'closed':      { label: 'Closed',      kind: '' },
};

const SUP_PRIORITY = {
  high:   { label: 'High',   kind: 'is-loss' },
  medium: { label: 'Medium', kind: 'is-warn' },
  low:    { label: 'Low',    kind: '' },
};

function App() {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const filtered = SUP_TICKETS.filter(t => {
    if (filter === 'open' && !['open', 'in-progress', 'waiting'].includes(t.status)) return false;
    if (filter === 'closed' && !['resolved', 'closed'].includes(t.status)) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = SUP_TICKETS.filter(t => ['open', 'in-progress', 'waiting'].includes(t.status)).length;

  return (
    <UsrShell active="support" title="Support" crumbs={[{ label: 'Support' }]} actions={
      <a href="App-Support-New.html" className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New ticket</a>
    }>
      <AdmPageHead
        title="Support"
        sub="Get help from the Polyforge team · typical first response under 4 hours · 24/5 coverage"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Open tickets"        value={openCount} delta={`${SUP_TICKETS.filter(t => t.unread).length} unread`} deltaKind="warn" />
        <AdmStat label="Avg first response"  value="3h 12m" delta="-22m vs last month" deltaKind="gain" />
        <AdmStat label="Resolution rate"     value="94%" delta="last 30d" deltaKind="gain" />
        <AdmStat label="Total filed"         value={SUP_TICKETS.length} delta="all-time" deltaKind="neutral" />
      </div>

      {/* Help shortcuts */}
      <div className="adm-grid-3" style={{ marginBottom: 20 }}>
        {[
          { icon: 'book',     title: 'Browse the user guide', sub: 'Most questions have a written answer there', href: 'Guide.html' },
          { icon: 'message',  title: 'Community Discord',     sub: '4,200 traders · staff present 9am–9pm UTC',  href: '#' },
          { icon: 'calendar', title: 'Schedule a desk call',  sub: 'Tier 2+ accounts · 30-min Zoom with support', href: '#' },
        ].map((s, i) => (
          <a key={i} href={s.href} className="adm-card" style={{ padding: 16, textDecoration: 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              display: 'grid', placeItems: 'center', color: 'var(--accent-text)'
            }}>
              <AdmIcon name={s.icon} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                <AdmIcon name="arrow-right" size={12} className="adm-icon-tertiary" />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{s.sub}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Tickets table */}
      <div className="adm-card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>My tickets</h3>
          <div className="adm-filter-group" style={{ marginLeft: 12 }}>
            <button onClick={() => setFilter('all')} className={`adm-filter ${filter === 'all' ? 'is-active' : ''}`}>All</button>
            <button onClick={() => setFilter('open')} className={`adm-filter ${filter === 'open' ? 'is-active' : ''}`}>Open</button>
            <button onClick={() => setFilter('closed')} className={`adm-filter ${filter === 'closed' ? 'is-active' : ''}`}>Closed</button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="adm-input"
            style={{ marginLeft: 'auto', width: 240, padding: '6px 10px', fontSize: 12 }}
          />
        </div>
        <table className="adm-table">
          <thead><tr>
            <th style={{ width: 100 }}>ID</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th style={{ textAlign: 'right' }}>Replies</th>
            <th>Last update</th>
          </tr></thead>
          <tbody>
            {filtered.map(t => {
              const s = SUP_STATUS[t.status], p = SUP_PRIORITY[t.priority];
              return (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => location.href = 'App-Support-Detail.html'}>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{t.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-default)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 12.5, fontWeight: t.unread ? 500 : 400, color: 'var(--text-primary)' }}>{t.subject}</span>
                    </div>
                  </td>
                  <td><span className={`adm-pill ${s.kind}`} style={{ fontSize: 10 }}>{s.label}</span></td>
                  <td><span className={`adm-pill ${p.kind}`} style={{ fontSize: 10 }}>{p.label}</span></td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-secondary)' }}>{t.responses}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{t.updated}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>No tickets match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);