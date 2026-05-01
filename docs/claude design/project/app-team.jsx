/* Polyforge — Team / Org members */

const MEMBERS = [
  { name: 'Ada Diallo',      email: 'ada@stochasticlabs.io',     role: 'Owner',       status: 'active', mfa: true,  last: '2 min ago',  init: 'AD' },
  { name: 'Mateo Rivera',    email: 'mateo@stochasticlabs.io',   role: 'Admin',       status: 'active', mfa: true,  last: '14 min ago', init: 'MR' },
  { name: 'Yuki Tanaka',     email: 'yuki@stochasticlabs.io',    role: 'Trader',      status: 'active', mfa: true,  last: '1 hour ago', init: 'YT' },
  { name: 'Priya Khatri',    email: 'priya@stochasticlabs.io',   role: 'Analyst',     status: 'active', mfa: false, last: '4 hours ago',init: 'PK' },
  { name: 'Hassan Olufemi',  email: 'hassan@stochasticlabs.io',  role: 'Read-only',   status: 'invited', mfa: false, last: '—',         init: 'HO' },
  { name: 'Quant compliance bot', email: 'compliance@bot',       role: 'Auditor',     status: 'active', mfa: true,  last: 'live',       init: 'QB' },
];

const roleMeta = {
  Owner:      { color: 'var(--loss)',          desc: 'Billing, members, all actions' },
  Admin:      { color: 'var(--accent-default)', desc: 'Members, strategies, all trades' },
  Trader:     { color: 'var(--gain)',          desc: 'Place orders, run strategies' },
  Analyst:    { color: '#a78bfa',              desc: 'Backtests, read-only positions' },
  'Read-only':{ color: 'var(--text-secondary)', desc: 'View-only across the org' },
  Auditor:    { color: 'var(--warn)',          desc: 'Activity logs only' },
};

function App() {
  const [showInvite, setShowInvite] = React.useState(false);
  return (
    <UsrShell active="team" title="Team" actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="users" size={12} />Roles</button>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowInvite(true)}><AdmIcon name="plus" size={12} />Invite member</button>
      </>
    }>
      <AdmPageHead title="Team" subtitle="Stochastic Labs · 6 seats used of 10 on Pro plan" />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Active members" value="5" delta="+1 this month" deltaKind="gain" />
        <AdmStat label="Pending invites" value="1" delta="sent 2 days ago" deltaKind="neutral" />
        <AdmStat label="Seats available" value="4" delta="of 10 on Pro" deltaKind="neutral" />
        <AdmStat label="MFA coverage" value="83%" delta="1 member without MFA" deltaKind="warn" />
      </div>

      {showInvite && (
        <div className="adm-card" style={{ padding: 18, marginBottom: 20, borderColor: 'color-mix(in srgb, var(--accent-default) 30%, var(--border-default))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Email addresses · comma separated</label>
              <input className="adm-input" placeholder="alice@team.io, bob@team.io" defaultValue="emma@stochasticlabs.io" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Role</label>
              <select className="adm-input" defaultValue="Trader">
                {Object.keys(roleMeta).filter(r => r !== 'Owner').map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="adm-btn adm-btn-primary">Send invite</button>
              <button className="adm-btn adm-btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Members</h3>
          <div className="adm-search" style={{ marginLeft: 'auto', maxWidth: 240 }}>
            <AdmIcon name="search" size={12} />
            <input placeholder="Filter by name, email, role..." />
          </div>
        </div>
        <table className="adm-table">
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>MFA</th><th>Last active</th><th></th></tr></thead>
          <tbody>
            {MEMBERS.map((m, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-app)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, border: '1px solid var(--border-subtle)' }}>{m.init}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</div>
                      <div className="col-tertiary" style={{ fontSize: 11 }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleMeta[m.role].color }} />
                    <span style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{m.role}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{roleMeta[m.role].desc}</div>
                </td>
                <td><span className={`adm-pill ${m.status === 'active' ? 'is-gain' : 'is-warn'} has-dot`} style={{ height: 18, fontSize: 10 }}>{m.status}</span></td>
                <td>
                  {m.mfa
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gain-text)', fontSize: 11.5 }}><AdmIcon name="shield-check" size={12} />Enabled</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warn-text)', fontSize: 11.5 }}><AdmIcon name="alert" size={12} />Required</span>}
                </td>
                <td className="col-tertiary">{m.last}</td>
                <td>
                  <button className="row-action" title="Edit"><AdmIcon name="edit" size={12} /></button>
                  {m.role !== 'Owner' && <button className="row-action" title="Remove"><AdmIcon name="x" size={12} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Roles overview */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 12 }}>Roles & permissions</h2>
        <div className="adm-grid-3">
          {Object.entries(roleMeta).map(([role, m]) => (
            <div key={role} className="adm-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{role}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 10 }}>{m.desc}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', letterSpacing: '0.02em', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                {role === 'Owner' && 'billing.* · members.* · trade.*'}
                {role === 'Admin' && 'members.read · trade.* · strategy.*'}
                {role === 'Trader' && 'trade.* · strategy.run · portfolio.read'}
                {role === 'Analyst' && 'backtest.run · portfolio.read'}
                {role === 'Read-only' && 'portfolio.read · markets.read'}
                {role === 'Auditor' && 'activity.read · log.export'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
