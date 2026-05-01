/* Polyforge Admin — User Segmentation
   Slice users by attributes, build cohorts, target broadcasts. */

const SG_KPIS = [
  { label: 'Total users',     value: '14,284', delta: '↑ 284 this week', kind: 'gain' },
  { label: 'Active 30d',      value: '8,642',  delta: '60.5% of base',  kind: 'gain' },
  { label: 'Saved cohorts',   value: '24',     delta: '6 in use',       kind: 'neutral' },
  { label: 'Auto-segments',   value: '8',      delta: 'updated nightly', kind: 'neutral' },
];

const SG_SEGMENTS = [
  { id: 's1',  name: 'Power traders',          size: 184,   pct: '1.3%',  attr: 'volume_30d > $500k', updated: '2h ago', color: '#0066ff', auto: true },
  { id: 's2',  name: 'High-frequency',          size: 422,   pct: '3.0%',  attr: 'orders_per_day > 50', updated: '2h ago', color: '#10b981', auto: true },
  { id: 's3',  name: 'Builder tier candidates', size: 642,   pct: '4.5%',  attr: 'volume_30d > $1M & tier = trader', updated: '6h ago', color: '#a78bfa', auto: false },
  { id: 's4',  name: 'New users (7d)',          size: 284,   pct: '2.0%',  attr: 'created_at > now-7d', updated: '2h ago', color: '#f59e0b', auto: true },
  { id: 's5',  name: 'Churning at-risk',        size: 1248,  pct: '8.7%',  attr: 'last_trade > 30d & lifetime_volume > $10k', updated: '6h ago', color: '#ef4444', auto: true },
  { id: 's6',  name: 'Mobile-only',             size: 3284,  pct: '23.0%', attr: 'web_session_count = 0', updated: 'yesterday', color: '#14b8a6', auto: false },
  { id: 's7',  name: 'EU users',                size: 4242,  pct: '29.7%', attr: 'region in [DE,FR,UK,...]', updated: 'yesterday', color: '#ec4899', auto: false },
  { id: 's8',  name: 'No deposit yet',          size: 842,   pct: '5.9%',  attr: 'deposits = 0 & created < 14d', updated: '2h ago', color: '#64748b', auto: true },
];

const SG_COMBINE = [
  { name: 'Power traders',   size: 184, color: '#0066ff' },
  { name: 'EU users',        size: 4242, color: '#ec4899' },
];

function App() {
  const [selected, setSelected] = React.useState(['s1']);
  const [name, setName] = React.useState('Untitled cohort');

  return (
    <AdmShell active="user-segmentation" title="User segmentation"
      crumbs={[{ label: 'Users', href: 'Admin-Users.html' }, { label: 'Segmentation' }]}
      actions={<>
        <button className="adm-btn"><AdmIcon name="download" size={12} />Export CSV</button>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New segment</button>
      </>}
    >
      <AdmPageHead
        title="User segmentation"
        sub="Slice the user base by attributes, save cohorts, target broadcasts and feature flags"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {SG_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.kind} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Segments table */}
        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Saved segments</h3>
            <input className="adm-input" placeholder="Search segments…" style={{ width: 200, fontSize: 11.5 }} />
          </div>
          <table className="adm-table">
            <thead><tr>
              <th style={{ width: 28 }}></th>
              <th>Segment</th>
              <th>Definition</th>
              <th style={{ textAlign: 'right' }}>Size</th>
              <th>Updated</th>
            </tr></thead>
            <tbody>
              {SG_SEGMENTS.map(s => {
                const checked = selected.includes(s.id);
                return (
                  <tr key={s.id} style={{ background: checked ? 'var(--accent-subtle)' : undefined }}>
                    <td>
                      <input type="checkbox" checked={checked} onChange={() => setSelected(p => checked ? p.filter(x => x !== s.id) : [...p, s.id])} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</span>
                        {s.auto && <span className="adm-pill is-info" style={{ fontSize: 9 }}>AUTO</span>}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.attr}</td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 500 }}>{s.size.toLocaleString()} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {s.pct}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.updated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="adm-card" style={{ padding: 18 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Cohort builder</h3>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="adm-input" style={{ width: '100%', marginBottom: 14 }} />

            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Combine selected segments</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['AND', 'OR', 'NOT'].map((op, i) => (
                <button key={op} className={`adm-btn ${i === 0 ? 'adm-btn-primary' : ''}`} style={{ fontSize: 11, flex: 1 }}>{op}</button>
              ))}
            </div>

            {/* Venn diagram */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 16, marginBottom: 14, border: '1px solid var(--border-subtle)' }}>
              <svg viewBox="0 0 280 140" style={{ width: '100%', height: 140, display: 'block' }}>
                <circle cx="100" cy="70" r="56" fill="#0066ff" fillOpacity="0.18" stroke="#0066ff" strokeWidth="1" />
                <circle cx="180" cy="70" r="56" fill="#ec4899" fillOpacity="0.18" stroke="#ec4899" strokeWidth="1" />
                <text x="64" y="72" fontSize="10" fill="var(--text-primary)" fontFamily="Geist Mono">184</text>
                <text x="64" y="86" fontSize="9" fill="var(--text-tertiary)" textAnchor="middle">Power</text>
                <text x="216" y="72" fontSize="10" fill="var(--text-primary)" fontFamily="Geist Mono">4,242</text>
                <text x="216" y="86" fontSize="9" fill="var(--text-tertiary)" textAnchor="middle">EU</text>
                <text x="140" y="72" fontSize="11" fill="var(--text-primary)" fontFamily="Geist Mono" textAnchor="middle" fontWeight="600">62</text>
                <text x="140" y="86" fontSize="9" fill="var(--text-tertiary)" textAnchor="middle">∩</text>
              </svg>
            </div>

            <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Resulting cohort size</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent-text)' }}>62 users</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>0.43% of total · power_traders ∩ eu_users</div>
            </div>
          </div>

          <div className="adm-card" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>Use this cohort in</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: 'mail',     label: 'Send broadcast email' },
                { icon: 'flag',     label: 'Target a feature flag' },
                { icon: 'gift',     label: 'Issue fee credits' },
                { icon: 'download', label: 'Export to CSV / Mixpanel' },
              ].map(a => (
                <button key={a.label} className="adm-btn" style={{ justifyContent: 'flex-start', fontSize: 11.5 }}>
                  <AdmIcon name={a.icon} size={12} /> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);