/* Polyforge — Admin Users list */

const USERS = [
  { id: 'usr_8a1f', name: 'Aisha Rahimi',     email: 'aisha.r@protonmail.com',   plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2024-08-12', last: '2m ago',   country: 'GB', strategies: 3, vol30d: '$184K', risk: 'low',  flag: false },
  { id: 'usr_8a1e', name: 'Jonas Bergquist',  email: 'jonas@bergquist.io',       plan: 'Plus', mrr: 19,  status: 'active',   joined: '2024-09-03', last: '14m ago',  country: 'SE', strategies: 1, vol30d: '$22K',  risk: 'low',  flag: false },
  { id: 'usr_8a1d', name: 'Marco Vassallo',   email: 'm.vassallo@gmail.com',     plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2023-11-21', last: '1h ago',   country: 'IT', strategies: 7, vol30d: '$1.2M', risk: 'low',  flag: false },
  { id: 'usr_8a1c', name: 'Priya Iyer',       email: 'priya.iyer@outlook.com',   plan: 'Free', mrr: 0,   status: 'pending',  joined: '2025-02-14', last: '4m ago',   country: 'IN', strategies: 0, vol30d: '$0',    risk: 'med',  flag: 'kyc' },
  { id: 'usr_8a1b', name: 'Tomás Reyes',      email: 'treyes@correo.mx',         plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2025-02-14', last: '1m ago',   country: 'MX', strategies: 0, vol30d: '$0',    risk: 'low',  flag: false },
  { id: 'usr_71c2', name: 'Mikhail Volkov',   email: 'volkov.eth@proton.me',     plan: 'Pro',  mrr: 49,  status: 'flagged',  joined: '2024-04-02', last: '32m ago',  country: 'CY', strategies: 12, vol30d: '$8.4M', risk: 'high', flag: 'drawdown' },
  { id: 'usr_4a91', name: 'Arjun Patel',      email: 'arjun.p@aol.com',          plan: 'Pro',  mrr: 49,  status: 'flagged',  joined: '2024-12-19', last: '1h ago',   country: 'AE', strategies: 4, vol30d: '$2.1M', risk: 'high', flag: 'wash' },
  { id: 'usr_92ff', name: 'Sora Yamamoto',    email: 's.yamamoto@gmail.com',     plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2024-06-30', last: '6h ago',   country: 'JP', strategies: 2, vol30d: '$1.2M', risk: 'med',  flag: 'velocity' },
  { id: 'usr_5b18', name: 'Lukas Müller',     email: 'l.mueller@gmx.de',         plan: 'Plus', mrr: 19,  status: 'flagged',  joined: '2025-01-08', last: '2h ago',   country: 'DE', strategies: 1, vol30d: '$48K',  risk: 'med',  flag: '3ds' },
  { id: 'usr_22a7', name: 'system',           email: 'system@polyforge.app',      plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2023-08-12', last: '3h ago',   country: 'US', strategies: 8, vol30d: '$340K', risk: 'low',  flag: false },
  { id: 'usr_3b22', name: 'Karina Tanaka',    email: 'karina.t@gmail.com',       plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2024-02-19', last: '1d ago',   country: 'CA', strategies: 5, vol30d: '$520K', risk: 'low',  flag: false },
  { id: 'usr_44d8', name: 'Elena Kowalski',   email: 'e.kowalski@proton.me',     plan: 'Free', mrr: 0,   status: 'churned',  joined: '2024-03-04', last: '14d ago',  country: 'PL', strategies: 0, vol30d: '$0',    risk: 'low',  flag: false },
  { id: 'usr_55a3', name: 'Diego Fernández',  email: 'diego.f@yahoo.es',         plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2023-10-11', last: '5h ago',   country: 'ES', strategies: 9, vol30d: '$2.8M', risk: 'low',  flag: false },
  { id: 'usr_66b4', name: 'Olivia Chen',      email: 'olivia@chenadvisory.com',  plan: 'Pro',  mrr: 49,  status: 'active',   joined: '2024-07-22', last: '2d ago',   country: 'SG', strategies: 4, vol30d: '$680K', risk: 'low',  flag: false },
  { id: 'usr_77c5', name: 'Idris Mohammed',   email: 'idris.m@outlook.com',      plan: 'Plus', mrr: 19,  status: 'active',   joined: '2025-01-30', last: '4h ago',   country: 'NG', strategies: 2, vol30d: '$94K',  risk: 'low',  flag: false },
];

const SEGMENT_TILES = [
  { name: 'Power traders',   sub: 'volume > $1M / 30d',     count: '184',    delta: '+12 wk',    icon: 'trending', tone: 'is-gain' },
  { name: 'At-risk churn',   sub: 'no login in 14d · paid', count: '92',     delta: '+8 wk',     icon: 'alert',    tone: 'is-warn' },
  { name: 'Free → Pro candidates', sub: 'free · 3+ backtests', count: '418', delta: '+34 wk',    icon: 'arrow-up-right', tone: 'is-info' },
  { name: 'New this week',   sub: 'signed up in last 7d',   count: '342',    delta: '−4% WoW',   icon: 'plus',     tone: '' },
  { name: 'KYC pending',     sub: 'doc upload incomplete',  count: '47',     delta: '+9 wk',     icon: 'shield-check', tone: 'is-warn' },
  { name: 'Whale watchers',  sub: 'mirror strategy active', count: '1,284',  delta: '+102 wk',   icon: 'eye',      tone: 'is-info' },
];

function FlagTag({ flag }) {
  if (!flag) return null;
  const map = {
    kyc:      { label: 'KYC',      kind: 'warn' },
    drawdown: { label: 'DRAWDOWN', kind: 'loss' },
    wash:     { label: 'WASH',     kind: 'loss' },
    velocity: { label: 'VELOCITY', kind: 'warn' },
    '3ds':    { label: '3DS',      kind: 'warn' },
  };
  const f = map[flag] || { label: flag.toUpperCase(), kind: 'warn' };
  return <AdmPill kind={f.kind}>{f.label}</AdmPill>;
}

function StatusCell({ s }) {
  const map = {
    active:   { kind: 'gain', label: 'Active',  dot: true },
    pending:  { kind: 'warn', label: 'Pending', dot: true },
    flagged:  { kind: 'loss', label: 'Flagged', dot: true },
    churned:  { kind: '',     label: 'Churned', dot: false },
  };
  const c = map[s];
  return <AdmPill kind={c.kind} dot={c.dot}>{c.label}</AdmPill>;
}

function App() {
  const [selected, setSelected] = React.useState(new Set());
  const [filter, setFilter] = React.useState('all');
  const allIds = USERS.map(u => u.id);
  const allSelected = selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  return (
    <AdmShell active="users" title="Users" crumbs={[{ label: 'People' }]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Invite user</button>
    }>
      <AdmPageHead
        title="Users"
        sub={<>14,827 active accounts · 3,142 trading live · revenue throughput <span className="mono" style={{color:'var(--text-secondary)'}}>$487K MRR</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export CSV</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />Saved views</button>
        </>}
      />

      {/* Segment tiles */}
      <AdmSectionHead title="Segments" action={<a href="#" style={{fontSize:11,color:'var(--accent-text)',textDecoration:'none'}}>Manage segments →</a>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 24 }}>
        {SEGMENT_TILES.map((s) => (
          <a key={s.name} href="#" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, textDecoration: 'none', color: 'inherit', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'border-color 100ms' }}>
            <div className={`adm-stat-icon ${s.tone}`} style={{ width: 28, height: 28, flexShrink: 0 }}><AdmIcon name={s.icon} size={14} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2, marginBottom: 8 }}>{s.sub}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{s.count}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)' }}>{s.delta}</span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <AdmSectionHead title="All users" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="Search by name, email, user ID, IP, country…" />
          </div>
          <AdmFilter active={filter==='all'} count="14,827" onClick={()=>setFilter('all')}>All</AdmFilter>
          <AdmFilter active={filter==='active'} count="14,402" onClick={()=>setFilter('active')}>Active</AdmFilter>
          <AdmFilter active={filter==='pending'} count="47" onClick={()=>setFilter('pending')}>Pending KYC</AdmFilter>
          <AdmFilter active={filter==='flagged'} count="38" onClick={()=>setFilter('flagged')}>Flagged</AdmFilter>
          <AdmFilter active={filter==='churned'} count="340" onClick={()=>setFilter('churned')}>Churned</AdmFilter>
          <button className="adm-filter"><AdmIcon name="filter" size={11} /> +3 filters</button>
        </div>

        {selected.size > 0 && (
          <div className="adm-bulk">
            <span className="adm-bulk-count">{selected.size} selected</span>
            <span style={{ color: 'var(--text-secondary)' }}>·</span>
            <button className="adm-btn adm-btn-sm adm-btn-ghost" onClick={()=>setSelected(new Set())}>Clear</button>
            <div className="adm-bulk-actions">
              <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="mail" size={11} />Email</button>
              <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="ticket" size={11} />Add to segment</button>
              <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="dollar" size={11} />Apply credit</button>
              <button className="adm-btn adm-btn-sm adm-btn-danger"><AdmIcon name="lock" size={11} />Suspend</button>
            </div>
          </div>
        )}

        <table className="adm-table">
          <thead>
            <tr>
              <th className="col-checkbox"><input type="checkbox" className={`adm-cb${someSelected ? ' is-indeterminate' : ''}`} checked={allSelected} onChange={toggleAll} /></th>
              <th>User</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Flags</th>
              <th>Country</th>
              <th className="col-num">Strategies</th>
              <th className="col-num">30d volume</th>
              <th>Last seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.id} className={selected.has(u.id) ? 'is-selected' : ''}>
                <td><input type="checkbox" className="adm-cb" checked={selected.has(u.id)} onChange={()=>toggle(u.id)} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AdmAvatar name={u.name} />
                    <div style={{ minWidth: 0 }}>
                      <a href="Admin-User-Detail.html" style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.name}</a>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><AdmPill kind={u.plan === 'Pro' ? 'accent' : u.plan === 'Plus' ? 'info' : ''}>{u.plan}</AdmPill></td>
                <td><StatusCell s={u.status} /></td>
                <td>{u.flag ? <FlagTag flag={u.flag} /> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
                <td className="col-mono">{u.country}</td>
                <td className="col-num">{u.strategies}</td>
                <td className="col-num col-secondary">{u.vol30d}</td>
                <td className="col-mono col-tertiary">{u.last}</td>
                <td style={{ width: 32 }}><a href="Admin-User-Detail.html" className="row-action"><AdmIcon name="arrow-up-right" size={13} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="adm-table-foot">
          <span>1–15 of 14,827</span>
          <div className="adm-pagination">
            <button disabled><AdmIcon name="chevron-left" size={11} /></button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>…</button>
            <button>989</button>
            <button><AdmIcon name="chevron-right" size={11} /></button>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
