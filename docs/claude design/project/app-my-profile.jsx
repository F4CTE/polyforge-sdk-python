/* Polyforge — My Profile (private/edit view)
   Public-facing identity the user controls. Edit display, share link, see how others view you. */

const MY = {
  username: 'unholyfist.eth',
  displayName: 'Unholy Fist',
  bio: 'Macro & politics markets · ex-prop trader · DM open for desk inquiries',
  avatar: 'UF',
  joined: 'Jan 14, 2026',
  followers: 1284,
  following: 184,
  badges: [
    { id: 'top1',   label: 'Top 1% · 30d',     kind: 'gain' },
    { id: 'verif',  label: 'Verified',          kind: '' },
    { id: 'early',  label: 'Early access',      kind: '' },
  ],
};

const MY_KPIS = [
  { label: 'P&L · 30d',    value: '+$24,210', delta: '+12.4%',  deltaKind: 'gain' },
  { label: 'Win rate',     value: '68%',      delta: '142 trades', deltaKind: 'neutral' },
  { label: 'Strategies',   value: '4 live',   delta: '2 paper',   deltaKind: 'neutral' },
  { label: 'Followers',    value: '1,284',    delta: '+24 · 7d',  deltaKind: 'gain' },
];

const MY_PUBLIC_STRATEGIES = [
  { name: 'Macro · Fed cycle', visibility: 'public',  followers: 412, edge30: '+18.4%', shared: true },
  { name: 'Politics whale mirror', visibility: 'public', followers: 268, edge30: '+12.8%', shared: true },
  { name: 'Crypto ETF · YES heavy', visibility: 'private', followers: 0, edge30: '+22.1%', shared: false },
  { name: 'Sports · Sharp counter', visibility: 'private', followers: 0, edge30: '+8.2%',  shared: false },
];

function App() {
  const [tab, setTab] = React.useState('overview');
  const profileUrl = `polyforge.app/u/${MY.username}`;

  return (
    <UsrShell active="profile" title="My profile" crumbs={[{ label: 'Profile' }]}>
      {/* Header card */}
      <div className="adm-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div className="usr-whale-avatar" style={{ width: 72, height: 72, fontSize: 24, fontWeight: 600 }}>{MY.avatar}</div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{MY.displayName}</h2>
              <span className="mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>@{MY.username}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {MY.badges.map(b => (
                <span key={b.id} className={`adm-pill ${b.kind ? 'is-' + b.kind : ''}`} style={{ fontSize: 10 }}>{b.label}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5, maxWidth: 600 }}>{MY.bio}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{MY.followers.toLocaleString()}</strong> followers</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{MY.following}</strong> following</span>
              <span>Joined {MY.joined}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="App-Public-Profile.html" className="adm-btn">View public profile</a>
            <button className="adm-btn adm-btn-primary">Edit profile</button>
          </div>
        </div>

        {/* Share link */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <AdmIcon name="link" size={14} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{profileUrl}</span>
          <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>Copy link</button>
          <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>Share on X</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {MY_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.deltaKind} />)}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 16, display: 'flex', gap: 0 }}>
        {[
          { id: 'overview',   label: 'Overview' },
          { id: 'strategies', label: 'Public strategies' },
          { id: 'edit',       label: 'Edit profile' },
          { id: 'visibility', label: 'Visibility' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`} style={{ borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="adm-grid-2">
          <div className="adm-card" style={{ padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>What others see</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Your public profile shows your display name, bio, badges, public strategies, and aggregate stats —
              never your wallet address, individual fills, or private strategy logic.
            </p>
            <a href="App-Public-Profile.html" style={{ display: 'inline-block', marginTop: 12, fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none' }}>Preview public profile →</a>
          </div>
          <div className="adm-card" style={{ padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Privacy at a glance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Profile visibility</span>
                <span className="adm-pill" style={{ fontSize: 10 }}>Public</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>P&L disclosure</span>
                <span className="adm-pill" style={{ fontSize: 10 }}>% only</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Position sizes</span>
                <span className="adm-pill is-loss" style={{ fontSize: 10 }}>Hidden</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Activity feed</span>
                <span className="adm-pill" style={{ fontSize: 10 }}>Followers only</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'strategies' && (
        <div className="adm-card" style={{ padding: 0 }}>
          <table className="adm-table">
            <thead><tr>
              <th>Strategy</th>
              <th>Visibility</th>
              <th style={{ textAlign: 'right' }}>Followers</th>
              <th style={{ textAlign: 'right' }}>30d edge</th>
              <th style={{ width: 120 }}></th>
            </tr></thead>
            <tbody>
              {MY_PUBLIC_STRATEGIES.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</td>
                  <td><span className={`adm-pill ${s.visibility === 'public' ? 'is-gain' : ''}`} style={{ fontSize: 10 }}>{s.visibility}</span></td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{s.followers}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--gain-text)' }}>{s.edge30}</td>
                  <td><button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>{s.visibility === 'public' ? 'Make private' : 'Publish'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'edit' && (
        <div className="adm-card" style={{ padding: 24, maxWidth: 720 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Display name</label>
              <input className="adm-input" defaultValue={MY.displayName} style={{ width: '100%', padding: '8px 12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Username</label>
              <input className="adm-input mono" defaultValue={MY.username} style={{ width: '100%', padding: '8px 12px' }} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Profile URL: {profileUrl}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Bio</label>
              <textarea className="adm-input" defaultValue={MY.bio} rows={3} style={{ width: '100%', padding: '8px 12px', resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{MY.bio.length} / 280</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="adm-btn adm-btn-primary">Save changes</button>
              <button className="adm-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'visibility' && (
        <div className="adm-card" style={{ padding: 0, maxWidth: 720 }}>
          {[
            { label: 'Profile visibility',  desc: 'Anyone can find and view your profile', value: 'Public' },
            { label: 'P&L disclosure',      desc: 'Show percentage returns; hide dollar amounts', value: 'Percentage only' },
            { label: 'Position sizes',      desc: 'Hide individual position $ values from public view', value: 'Hidden' },
            { label: 'Activity feed',       desc: 'Who can see your trade activity', value: 'Followers only' },
            { label: 'DMs',                 desc: 'Who can message you', value: 'Followers only' },
          ].map((row, i, arr) => (
            <div key={i} style={{
              padding: '16px 20px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{row.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{row.desc}</div>
              </div>
              <select className="adm-input" defaultValue={row.value} style={{ width: 180, padding: '6px 10px', fontSize: 12 }}>
                <option>{row.value}</option>
                <option>Public</option>
                <option>Followers only</option>
                <option>Hidden</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);