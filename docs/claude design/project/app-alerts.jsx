/* Polyforge — Alerts
   Price/event/whale alerts. Active rules + recent triggers + create form. */

const AL_ACTIVE = [
  { id: 'AL-184', kind: 'price',     market: 'FED-CUT-JUL · YES', condition: '≥ ¢72', channels: ['app', 'email'], created: 'Apr 28', triggered: 0 },
  { id: 'AL-178', kind: 'price',     market: 'BTC-150K-DEC · YES', condition: '≤ ¢40 OR ≥ ¢60', channels: ['app', 'sms'], created: 'Apr 24', triggered: 2 },
  { id: 'AL-172', kind: 'whale',     market: 'NVDA-EARN-Q1', condition: 'Whale enters with ≥ $50K', channels: ['app', 'email', 'discord'], created: 'Apr 20', triggered: 4 },
  { id: 'AL-164', kind: 'volume',    market: 'TARIFF-CHN-25', condition: '24h volume > $2M', channels: ['app'], created: 'Apr 14', triggered: 1 },
  { id: 'AL-158', kind: 'resolution',market: 'OSCARS-OPP', condition: 'Resolves YES', channels: ['app', 'email'], created: 'Apr 10', triggered: 0 },
  { id: 'AL-150', kind: 'news',      market: 'ETH-ETF-Q3', condition: 'Match: "SEC approval" · "ETF inflows"', channels: ['app'], created: 'Apr 6', triggered: 7 },
];

const AL_TRIGGERED = [
  { id: 'TR-2841', alertId: 'AL-150', when: '14m ago', market: 'ETH-ETF-Q3', kind: 'news',     msg: 'Reuters: "SEC approval timeline accelerated to Q2" · 18 mentions in 4h' },
  { id: 'TR-2837', alertId: 'AL-172', when: '38m ago', market: 'NVDA-EARN-Q1', kind: 'whale',  msg: '0xCa5p…7d22 entered YES with $84K · 12% size increase' },
  { id: 'TR-2830', alertId: 'AL-178', when: '2h ago',  market: 'BTC-150K-DEC', kind: 'price',  msg: 'Price hit ¢61 · crossed upper threshold ¢60' },
  { id: 'TR-2824', alertId: 'AL-150', when: '4h ago',  market: 'ETH-ETF-Q3', kind: 'news',     msg: 'Bloomberg: "ETF inflows top $200M for third day"' },
  { id: 'TR-2818', alertId: 'AL-164', when: '8h ago',  market: 'TARIFF-CHN-25', kind: 'volume',msg: '24h volume reached $2.4M · threshold crossed' },
  { id: 'TR-2812', alertId: 'AL-172', when: '1d ago',  market: 'NVDA-EARN-Q1', kind: 'whale',  msg: '0x9aB1…3f7e entered with $62K' },
];

const AL_KIND_COLOR = {
  price:      { color: 'var(--accent-default)',  icon: 'trending-up', label: 'Price' },
  whale:      { color: '#a78bfa',                 icon: 'whale',       label: 'Whale' },
  volume:     { color: '#10b981',                 icon: 'bar-chart',   label: 'Volume' },
  resolution: { color: '#f59e0b',                 icon: 'check',       label: 'Resolution' },
  news:       { color: '#ef4444',                 icon: 'newspaper',   label: 'News' },
};

const AL_CHANNEL_LABEL = { app: 'In-app', email: 'Email', sms: 'SMS', discord: 'Discord' };

function App() {
  const [tab, setTab] = React.useState('active');
  const [channels, setChannels] = React.useState({ app: true, email: false, sms: false, discord: false });
  const toggle = id => setChannels(c => ({ ...c, [id]: !c[id] }));

  return (
    <UsrShell active="alerts" title="Alerts" crumbs={[{ label: 'Alerts' }]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New alert</button>
    }>
      <AdmPageHead
        title="Alerts"
        sub="Real-time triggers · price · whale · volume · news · resolution · routed to your channels"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Active alerts"   value={AL_ACTIVE.length} delta="across 6 markets" deltaKind="neutral" />
        <AdmStat label="Triggered today" value="14" delta="3 in last hour" deltaKind="warn" />
        <AdmStat label="Triggered (30d)" value="284" delta="↑ 18% vs prev" deltaKind="warn" />
        <AdmStat label="Channels"        value="4" delta="App · Email · SMS · Discord" deltaKind="neutral" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', display: 'flex', marginBottom: 12 }}>
            {[
              { id: 'active', label: `Active (${AL_ACTIVE.length})` },
              { id: 'triggered', label: `Triggered (${AL_TRIGGERED.length})` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`} style={{
                borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent',
                padding: '10px 16px', fontSize: 12.5,
                marginBottom: -1, transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'active' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <table className="adm-table">
                <thead><tr>
                  <th>ID</th><th>Type</th><th>Market</th><th>Condition</th><th>Channels</th>
                  <th style={{ textAlign: 'center' }}>Fired</th><th></th>
                </tr></thead>
                <tbody>
                  {AL_ACTIVE.map(a => {
                    const k = AL_KIND_COLOR[a.kind];
                    return (
                      <tr key={a.id}>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: k.color }} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{k.label}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: 11.5, fontWeight: 500 }}>{a.market}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.condition}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {a.channels.map(c => (
                              <span key={c} className="adm-pill" style={{ fontSize: 9.5 }}>{AL_CHANNEL_LABEL[c]}</span>
                            ))}
                          </div>
                        </td>
                        <td className="mono" style={{ textAlign: 'center', fontSize: 12, color: a.triggered ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{a.triggered}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ height: 24, fontSize: 10.5, padding: '0 8px' }}>Edit</button>
                            <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ height: 24, fontSize: 10.5, padding: '0 8px', color: 'var(--loss-text)' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'triggered' && (
            <div className="adm-card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {AL_TRIGGERED.map((t, i) => {
                  const k = AL_KIND_COLOR[t.kind];
                  return (
                    <div key={t.id} style={{ padding: '14px 18px', borderBottom: i < AL_TRIGGERED.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: k.color }}>
                        <AdmIcon name={k.icon} size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{k.label} alert</span>
                          <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{t.market}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{t.when}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.msg}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick create */}
        <div className="adm-card" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Quick alert</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {Object.entries(AL_KIND_COLOR).slice(0, 3).map(([id, k]) => (
                <button key={id} className="adm-btn adm-btn-secondary" style={{ height: 28, fontSize: 11, padding: '0 8px', justifyContent: 'center' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: k.color, marginRight: 4 }} />
                  {k.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginTop: 4 }}>
              {Object.entries(AL_KIND_COLOR).slice(3).map(([id, k]) => (
                <button key={id} className="adm-btn adm-btn-secondary" style={{ height: 28, fontSize: 11, padding: '0 8px', justifyContent: 'center' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: k.color, marginRight: 4 }} />
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Market</label>
            <input className="adm-input mono" defaultValue="FED-CUT-JUL" style={{ padding: '6px 10px', fontSize: 12 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Condition</label>
            <select className="adm-input" style={{ padding: '6px 10px', fontSize: 12, marginBottom: 6 }}>
              <option>Price ≥</option>
              <option>Price ≤</option>
              <option>Crosses range</option>
            </select>
            <input className="adm-input mono" defaultValue="¢72" style={{ padding: '6px 10px', fontSize: 12 }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>Notify via</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
              {Object.entries(AL_CHANNEL_LABEL).map(([id, label]) => {
                const on = channels[id];
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    aria-pressed={on}
                    className="adm-btn adm-btn-secondary"
                    style={{
                      height: 28, fontSize: 11, padding: '0 8px', justifyContent: 'center',
                      background: on ? 'var(--accent-subtle)' : undefined,
                      borderColor: on ? 'var(--accent-default)' : undefined,
                      color: on ? 'var(--accent-text)' : undefined,
                    }}
                  >
                    <AdmIcon name={on ? 'check' : 'plus'} size={11} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="adm-btn adm-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create alert</button>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);