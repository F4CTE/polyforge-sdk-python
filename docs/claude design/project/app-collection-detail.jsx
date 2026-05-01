/* Polyforge — Collection Detail
   Single collection view: items list, share controls, recent activity. */

const CD_ITEMS = [
  { id: 1, ticker: 'FED-CUT-JUL',     title: 'Will the Fed cut rates 25bps in July?',   yes: 64.2, vol: '$8.4M',  end: 'Jul 31' },
  { id: 2, ticker: 'FED-CUT-SEP',     title: 'Will the Fed cut rates 25bps in September?', yes: 72.0, vol: '$5.2M',  end: 'Sep 18' },
  { id: 3, ticker: 'FED-DEC-DOTS-3',  title: 'Will Dec dot plot show 3+ cuts in 2025?',  yes: 38.4, vol: '$2.8M',  end: 'Dec 18' },
  { id: 4, ticker: 'FED-CUT-NOV',     title: 'Will the Fed cut rates 25bps in November?', yes: 56.8, vol: '$3.6M',  end: 'Nov 06' },
  { id: 5, ticker: 'FED-PAUSE-JUL',   title: 'Will the Fed pause in July?',              yes: 34.0, vol: '$4.2M',  end: 'Jul 31' },
  { id: 6, ticker: 'FED-CUT-50-2025', title: 'Cumulative 50bps+ of cuts by year-end?',   yes: 78.4, vol: '$6.8M',  end: 'Dec 31' },
  { id: 7, ticker: 'FED-CHAIR-2026',  title: 'Will Powell remain Fed chair through 2026?', yes: 84.0, vol: '$1.4M', end: 'Jan 31' },
  { id: 8, ticker: 'CPI-MAY-COOL',    title: 'Will May CPI YoY come in below 3.0%?',     yes: 48.2, vol: '$2.4M',  end: 'May 14' },
];

const CD_ACTIVITY = [
  { who: 'You',          act: 'added FED-CUT-NOV', when: '2h ago' },
  { who: 'mfischer',     act: 'starred this collection', when: '4h ago' },
  { who: 'You',          act: 'added FED-CHAIR-2026', when: 'yesterday' },
  { who: 'jchen',        act: 'started following', when: 'yesterday' },
  { who: 'You',          act: 'updated description', when: '2 days ago' },
  { who: 'akhan',        act: 'shared with team', when: '3 days ago' },
];

function App() {
  return (
    <UsrShell active="collections" title="Fed Watch 2025"
      crumbs={[{ label: 'Collections', href: 'App-Collections.html' }, { label: 'Fed Watch 2025' }]}
      actions={<>
        <button className="adm-btn"><AdmIcon name="share" size={12} />Share</button>
        <button className="adm-btn"><AdmIcon name="edit" size={12} />Edit</button>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />Add markets</button>
      </>}
    >
      {/* Header card */}
      <div className="adm-card" style={{ padding: 22, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#0066ff' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Fed Watch 2025</h1>
              <span className="adm-pill is-info" style={{ fontSize: 10 }}>SHARED</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 640 }}>
              Every active rate-cut, dot-plot, and FOMC-meeting market. Updated weekly with new markets as the Fed calendar progresses.
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span>Created <span className="mono" style={{ color: 'var(--text-secondary)' }}>Jan 18</span></span>
              <span>·</span>
              <span><span className="mono" style={{ color: 'var(--text-secondary)' }}>{CD_ITEMS.length}</span> markets</span>
              <span>·</span>
              <span><span className="mono" style={{ color: 'var(--text-secondary)' }}>184</span> followers</span>
              <span>·</span>
              <span>Updated 2h ago</span>
            </div>
          </div>
          <button className="adm-btn"><AdmIcon name="star" size={12} />Following</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Items table */}
        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Markets</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="adm-btn" style={{ fontSize: 11 }}>Sort: volume</button>
              <button className="adm-btn" style={{ fontSize: 11 }}>Filter</button>
            </div>
          </div>
          <table className="adm-table">
            <thead><tr>
              <th>Ticker</th><th>Market</th>
              <th style={{ textAlign: 'right' }}>YES</th>
              <th style={{ textAlign: 'right' }}>Volume</th>
              <th>Resolves</th>
            </tr></thead>
            <tbody>
              {CD_ITEMS.map(m => (
                <tr key={m.id}>
                  <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{m.ticker}</td>
                  <td style={{ fontSize: 12.5 }}>
                    <a href="App-Market-Detail.html" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>{m.title}</a>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: m.yes >= 60 ? 'var(--gain-text)' : m.yes >= 40 ? 'var(--text-primary)' : 'var(--loss-text)' }}>
                    {m.yes.toFixed(1)}¢
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5 }}>{m.vol}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity */}
        <div className="adm-card" style={{ padding: 16, height: 'fit-content' }}>
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Recent activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CD_ACTIVITY.map((a, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, paddingBottom: 10, borderBottom: i < CD_ACTIVITY.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.who}</div>
                <div>{a.act}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);