/* Polyforge — Whales · Following
   The wallets you've added to your watchlist. */

const WF_LIST = [
  { who: 'unholyfist.eth', avatar: 'UF', addr: '0x82aF…d9c1', edge30: '+24.2%', winRate: '78%', trades: 142, vol: '$2.4M', notif: 'all', followed: '6 weeks ago', mirroring: true,  pinned: true },
  { who: '0xtidemark',     avatar: 'TM', addr: '0x4cE2…81b3', edge30: '+22.1%', winRate: '74%', trades: 96,  vol: '$1.8M', notif: 'large',followed: '4 weeks ago', mirroring: false },
  { who: 'cassandra.x',    avatar: 'CX', addr: '0x9af1…7e48', edge30: '+18.6%', winRate: '71%', trades: 186, vol: '$840K', notif: 'all', followed: '3 weeks ago', mirroring: true },
  { who: 'plinkochamp.eth',avatar: 'PC', addr: '0xb84a…2fD0', edge30: '+14.4%', winRate: '69%', trades: 84,  vol: '$1.2M', notif: 'off', followed: '2 weeks ago',  mirroring: false },
  { who: 'parlaymoney',    avatar: 'PM', addr: '0x12e8…a6c4', edge30: '+9.8%',  winRate: '64%', trades: 320, vol: '$680K', notif: 'large',followed: '1 week ago',   mirroring: false },
  { who: 'bigbrain.poly',  avatar: 'BB', addr: '0x77d4…be10', edge30: '+8.1%',  winRate: '62%', trades: 248, vol: '$540K', notif: 'all', followed: '4 days ago',   mirroring: false },
  { who: 'oracleseer',     avatar: 'OS', addr: '0x3a98…c4e2', edge30: '+6.4%',  winRate: '58%', trades: 84,  vol: '$420K', notif: 'off', followed: '2 days ago',   mirroring: false },
];

const WF_NOTIF_LABEL = { all: 'All trades', large: '$10k+ only', off: 'Muted' };
const WF_NOTIF_KIND  = { all: '',          large: '',           off: 'is-loss' };

function App() {
  const [pinned, setPinned] = React.useState(['unholyfist.eth']);
  const togglePin = (who) => setPinned(p => p.includes(who) ? p.filter(x => x !== who) : [...p, who]);

  return (
    <UsrShell active="whales" title="Whales · Following" crumbs={[
      { label: 'Whales', href: 'App-Whales.html' },
      { label: 'Following' },
    ]}>
      <AdmPageHead
        title="Following"
        sub={`${WF_LIST.length} wallets · ${WF_LIST.filter(w => w.mirroring).length} auto-mirroring · notifications grouped by signal strength`}
      />

      <div className="adm-tabs" style={{ marginBottom: 20 }}>
        <a href="App-Whales.html" className="adm-tab">Live feed</a>
        <a href="App-Whales-Heatmap.html" className="adm-tab">Heatmap</a>
        <a href="App-Whales-Following.html" className="adm-tab is-active">Following</a>
      </div>

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Followed wallets" value={WF_LIST.length} />
        <AdmStat label="Auto-mirroring"   value={WF_LIST.filter(w => w.mirroring).length} delta="2 strategies live" deltaKind="gain" />
        <AdmStat label="Mirror P&L · 30d" value="+$612" delta="+8.1%" deltaKind="gain" />
        <AdmStat label="New signals · 24h" value="14" delta="3 unread" deltaKind="gain" />
      </div>

      <div className="adm-card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Wallets you follow</h3>
          <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
            <button className="adm-filter is-active">All</button>
            <button className="adm-filter">Mirroring</button>
            <button className="adm-filter">Pinned</button>
            <button className="adm-filter">Muted</button>
          </div>
          <button className="adm-btn">+ Follow new</button>
        </div>

        <table className="adm-table">
          <thead><tr>
            <th></th>
            <th>Wallet</th>
            <th style={{ textAlign: 'right' }}>30d edge</th>
            <th style={{ textAlign: 'right' }}>Win rate</th>
            <th style={{ textAlign: 'right' }}>Trades</th>
            <th>Notifications</th>
            <th>Followed</th>
            <th style={{ width: 160 }}></th>
          </tr></thead>
          <tbody>
            {WF_LIST.map(w => (
              <tr key={w.who}>
                <td style={{ width: 32 }}>
                  <button onClick={() => togglePin(w.who)} aria-label="Pin" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: pinned.includes(w.who) ? 'var(--accent-text)' : 'var(--text-tertiary)',
                    fontSize: 14, padding: 0,
                  }}>{pinned.includes(w.who) ? '★' : '☆'}</button>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="usr-whale-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{w.avatar}</div>
                    <div>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{w.who}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{w.addr}</div>
                    </div>
                    {w.mirroring && <span className="adm-pill is-gain" style={{ fontSize: 9, marginLeft: 4 }}>MIRROR</span>}
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--gain-text)' }}>{w.edge30}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{w.winRate}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{w.trades}</td>
                <td><span className={`adm-pill ${WF_NOTIF_KIND[w.notif]}`} style={{ fontSize: 10 }}>{WF_NOTIF_LABEL[w.notif]}</span></td>
                <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{w.followed}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <a href="App-Whales-Profile.html" className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>View</a>
                    <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>Unfollow</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);