/* Polyforge — Admin Dashboard
   Flagship layout. Sets visual tone for the other admin pages.
   Composition: KPI strip → live ops band → table + side cards. */

const KPI = [
  { label: 'Active subscribers', value: '14,827', delta: '+342 this week', deltaKind: 'gain', icon: 'users', iconKind: 'is-info',
    spark: [82, 84, 83, 86, 88, 87, 90, 92, 94, 96, 99, 102, 104, 108, 112, 118, 124, 128, 132, 138, 144, 148, 152, 158], sparkKind: 'gain' },
  { label: 'MRR', value: '$487,250', delta: '+8.4% MoM', deltaKind: 'gain', icon: 'dollar', iconKind: 'is-gain',
    spark: [310, 318, 322, 330, 336, 344, 350, 358, 364, 372, 380, 388, 394, 402, 412, 420, 432, 444, 456, 462, 470, 476, 482, 487], sparkKind: 'gain' },
  { label: 'Strategies live', value: '3,142', delta: '+47 in 24h', deltaKind: 'gain', icon: 'blocks', iconKind: '',
    spark: [120, 128, 134, 144, 152, 168, 184, 196, 212, 228, 246, 262, 278, 294, 312, 328, 344, 360, 374, 388, 402, 414, 426, 442] },
  { label: '24h volume', value: '$182.4M', delta: '−12.3% vs avg', deltaKind: 'loss', icon: 'bar-chart', iconKind: 'is-warn',
    spark: [240, 220, 230, 250, 260, 280, 290, 270, 250, 230, 220, 210, 200, 190, 180, 170, 200, 220, 240, 200, 180, 190, 200, 182], sparkKind: 'loss' },
];

const STATUS_DOTS = [
  { label: 'API gateway',      v: 'us-east-1', state: 'gain', metric: 'p50 22ms · p95 84ms' },
  { label: 'Strategy engine',  v: 'cluster a', state: 'gain', metric: '3,142 / 3,200 cap' },
  { label: 'Sentiment ingest', v: 'kafka-3',  state: 'warn', metric: '+12s lag' },
  { label: 'Postgres primary', v: 'pg-prod-1', state: 'gain', metric: 'replication 0.4s' },
  { label: 'Polymarket CLOB',  v: 'wss · prod', state: 'loss', metric: 'reconnecting · 3 retries' },
  { label: 'Polygon RPC',      v: 'alchemy',   state: 'gain', metric: '11,420 msg/s' },
  { label: 'Resolution oracle',v: 'UMA · live',state: 'gain', metric: '4 markets in dispute' },
  { label: 'Stripe webhooks',  v: 'live',      state: 'gain', metric: '0 failed in 1h' },
  { label: 'Email transport',  v: 'postmark', state: 'gain', metric: 'queue 14' },
];

const RECENT_USERS = [
  { id: 'usr_8a1f', name: 'Aisha Rahimi',     plan: 'Pro',  joined: '00:14:22', country: 'GB', flag: false },
  { id: 'usr_8a1e', name: 'Jonas Bergquist',  plan: 'Plus', joined: '00:09:48', country: 'SE', flag: false },
  { id: 'usr_8a1d', name: 'Marco Vassallo',   plan: 'Pro',  joined: '00:07:11', country: 'IT', flag: false },
  { id: 'usr_8a1c', name: 'Priya Iyer',       plan: 'Free', joined: '00:04:33', country: 'IN', flag: true,  flagReason: 'kyc' },
  { id: 'usr_8a1b', name: 'Tomás Reyes',      plan: 'Pro',  joined: '00:01:09', country: 'MX', flag: false },
];

const RISK_FLAGS = [
  { sev: 'loss', t: '12m ago', user: 'usr_71c2', headline: 'Drawdown −18.4% on ELEC28-DEM',     detail: 'Strategy "contrarian-poll" · size 28% bankroll',     who: 'M. Volkov' },
  { sev: 'loss', t: '34m ago', user: 'usr_4a91', headline: 'Self-cross pattern · 7 markets',     detail: '32 self-fills in 4m · same-wallet maker+taker',       who: 'A. Patel' },
  { sev: 'warn', t: '1h ago',  user: 'usr_92ff', headline: 'Velocity spike · $1.2M / 5m',         detail: 'Daily limit at 84% · approvals queue',                who: 'S. Yamamoto' },
  { sev: 'warn', t: '2h ago',  user: 'usr_5b18', headline: 'Failed 3DS · 4 cards in 6m',          detail: 'Stripe declined · IP changed twice',                  who: 'L. Müller' },
  { sev: 'warn', t: '3h ago',  user: 'usr_22a7', headline: 'API key leaked on GitHub gist',       detail: 'Auto-revoked · user emailed',                          who: 'system' },
];

const TOP_STRATEGIES = [
  { name: 'fed-rate-cut-tracker',author: 'k. yamamoto',  pnl: '+34.2%', users: 412, vol: '$8.2M',  spark: [10,12,14,18,22,28,32,38,42,48,54,62,68,74,82,88,94,102,108,116,124,130,136,142], k: 'gain' },
  { name: 'oscars-favorite-hedge',author: 'arianne.dev', pnl: '+18.7%', users: 287, vol: '$4.1M',  spark: [40,42,44,46,48,52,56,58,62,66,68,70,74,78,80,82,86,90,94,98,100,104,108,112], k: 'gain' },
  { name: 'poll-fade-elections',author: 'bjorn.eth',    pnl: '+12.4%', users: 198, vol: '$2.8M',  spark: [60,58,62,60,64,62,66,64,68,66,70,68,72,70,74,72,76,74,78,76,80,78,82,80] },
  { name: 'resolution-arb',     author: 'tess.k',       pnl: '+9.1%',  users: 156, vol: '$1.9M',  spark: [50,52,54,52,56,58,56,60,62,60,64,66,64,68,70,68,72,74,72,76,78,76,80,82] },
  { name: 'nfl-spread-momentum',author: 'noah.q',       pnl: '−4.8%',  users: 84,  vol: '$0.7M',  spark: [80,78,82,76,72,74,68,64,66,60,58,54,56,50,48,52,46,44,48,42,40,44,38,36], k: 'loss' },
];

const ACTIVITY = [
  { t: '00:00:14', kind: 'sub',    text: <>Aisha R. upgraded Free → <span style={{color:'var(--accent-text)'}}>Pro</span> · $49/mo</> },
  { t: '00:00:09', kind: 'fill',   text: <>Fill <span className="mono">#FX-92177</span> · ELEC28-DEM · YES @ 0.42 · <span style={{color:'var(--gain-text)'}}>+$1,240</span></> },
  { t: '00:00:04', kind: 'flag',   text: <>Risk flag <span style={{color:'var(--loss-text)'}}>HIGH</span> · usr_4a91 self-cross · 7 markets</> },
  { t: '23:59:51', kind: 'deploy', text: <>Strategy <span className="mono">fed-rate-cut-tracker</span> deployed by 12 users</> },
  { t: '23:59:28', kind: 'venue',  text: <>Polymarket CLOB <span style={{color:'var(--loss-text)'}}>reconnect</span> · attempt 2/5</> },
  { t: '23:58:57', kind: 'sub',    text: <>Marco V. — invoice <span className="mono">in_881f</span> paid · $199</> },
  { t: '23:58:14', kind: 'admin',  text: <>K. Tanaka approved 3 KYC reviews</> },
  { t: '23:57:44', kind: 'fill',   text: <>Fill <span className="mono">#FX-92176</span> · FED-CUT-JUL · NO @ 0.27 · <span style={{color:'var(--loss-text)'}}>−$182</span></> },
  { t: '23:57:11', kind: 'sub',    text: <>Tomás R. signed up · referred by usr_3b22</> },
  { t: '23:56:42', kind: 'admin',  text: <>Feature flag <span className="mono">use_v2_orderbook</span> rolled to 25%</> },
];

function ActivityIcon({ kind }) {
  const map = { sub: 'dollar', fill: 'check', flag: 'alert', deploy: 'blocks', venue: 'globe', admin: 'lock' };
  const tone = { sub: 'is-gain', fill: '', flag: 'is-loss', deploy: '', venue: 'is-warn', admin: 'is-info' };
  return <div className={`adm-stat-icon ${tone[kind] || ''}`} style={{ width: 22, height: 22, flexShrink: 0 }}><AdmIcon name={map[kind] || 'circle-check'} size={11} /></div>;
}

function VolumeChart() {
  // 48 half-hour buckets
  const data = [
    32,28,24,22,20,18,16,14,16,18,22,28,34,42,52,64,72,80,86,92,98,102,
    108,112,118,124,128,132,138,144,148,152,156,158,162,164,160,156,150,144,
    138,132,124,116,108,98,88,78
  ];
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 140, paddingTop: 8 }}>
      {data.map((v, i) => {
        const h = (v / max) * 130;
        const isPeak = v === max;
        return (
          <div key={i} style={{ flex: 1, height: h, background: isPeak ? 'var(--accent-default)' : 'var(--accent-subtle)', borderTop: isPeak ? '2px solid var(--accent-text)' : '1px solid var(--accent-border)', borderRadius: '2px 2px 0 0', position: 'relative' }} title={`${i*30}m: $${(v*0.4).toFixed(1)}M`}>
            {isPeak && (
              <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--accent-text)', fontWeight: 600 }}>
                ${(v*0.4).toFixed(1)}M
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function App() {
  return (
    <AdmShell active="dashboard" title="Dashboard" actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export</button>
    }>
      <AdmPageHead
        title="Mission control"
        sub={<>Live read across users, revenue, and the trading engine. Last refreshed <span style={{ color: 'var(--text-secondary)', fontFamily: 'Geist Mono, monospace' }}>2s ago</span> · auto every <span className="mono">15s</span></>}
        actions={<>
          <div className="adm-filter"><AdmIcon name="clock" size={12} /> Last 24h <AdmIcon name="chevron-down" size={11} /></div>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="refresh" size={12} />Refresh</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New broadcast</button>
        </>}
      />

      {/* KPI strip */}
      <div className="adm-stat-grid">
        {KPI.map((k) => <AdmStat key={k.label} {...k} />)}
      </div>

      {/* Live ops band */}
      <div className="adm-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="adm-dot is-gain" />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>System health</div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>8 services · 1 degraded · 1 incident</span>
          <a href="Admin-Health.html" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Open <AdmIcon name="arrow-up-right" size={11} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
          {STATUS_DOTS.map((s, i) => (
            <div key={s.label} style={{ padding: '12px 16px', borderRight: i % 4 !== 3 ? '1px solid var(--border-subtle)' : 'none', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`adm-dot is-${s.state}`} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 10.5, fontFamily: 'Geist Mono, monospace', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  <span style={{ marginRight: 8 }}>{s.v}</span>{s.metric}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volume chart + activity feed */}
      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="bar-chart" size={14} /></div>
            <h3 className="adm-card-title">24h trading volume</h3>
            <div className="adm-card-action" style={{ display: 'flex', gap: 4 }}>
              <button className="adm-btn adm-btn-sm adm-btn-secondary">Volume</button>
              <button className="adm-btn adm-btn-sm adm-btn-ghost">Fees</button>
              <button className="adm-btn adm-btn-sm adm-btn-ghost">Fills</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>$182.4M</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--loss-text)' }}>−12.3% vs 7d avg</div>
            <div style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>peak 14:30 UTC · $65.2M</div>
          </div>
          <VolumeChart />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
          </div>
        </div>

        <div className="adm-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="adm-card-head" style={{ padding: '14px 18px 0', marginBottom: 8 }}>
            <div className="adm-card-icon"><AdmIcon name="activity" size={14} /></div>
            <h3 className="adm-card-title">Live activity</h3>
            <span className="adm-pill has-dot is-pulse is-gain" style={{ marginLeft: 8 }}>LIVE</span>
            <div className="adm-card-action">
              <a href="Admin-Logs.html" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Audit log →</a>
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 320, padding: '0 18px 14px' }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <ActivityIcon kind={a.kind} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {a.text}
                </div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)', flexShrink: 0 }}>{a.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top strategies + risk flags */}
      <div className="adm-grid-2">
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Top strategies · 24h</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <AdmFilter active count="142">All</AdmFilter>
              <AdmFilter count="84">Public</AdmFilter>
              <AdmFilter count="58">Private</AdmFilter>
              <a href="Admin-Strategies.html" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', alignSelf: 'center', marginLeft: 8 }}>View all →</a>
            </div>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>P&L</th>
                <th>Trend</th>
                <th className="col-num">Users</th>
                <th className="col-num">Volume</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {TOP_STRATEGIES.map((s) => (
                <tr key={s.name}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>by {s.author}</div>
                  </td>
                  <td className="col-num" style={{ color: s.pnl.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)', fontWeight: 600 }}>{s.pnl}</td>
                  <td style={{ width: 100, paddingTop: 0, paddingBottom: 0 }}>
                    <div style={{ width: 80 }}>
                      <AdmSpark points={s.spark} kind={s.k} height={24} />
                    </div>
                  </td>
                  <td className="col-num">{s.users}</td>
                  <td className="col-num col-secondary">{s.vol}</td>
                  <td style={{ width: 32 }}><button className="row-action"><AdmIcon name="more" size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="adm-dot is-loss" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Risk flags</div>
              <span className="adm-pill is-loss" style={{ marginLeft: 4 }}>5 OPEN</span>
            </div>
            <a href="Admin-Flags.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Open queue →</a>
          </div>
          <div>
            {RISK_FLAGS.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: i < RISK_FLAGS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: f.sev === 'loss' ? 'var(--loss)' : 'var(--warning)', marginTop: 2, marginBottom: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <AdmPill kind={f.sev}>{f.sev === 'loss' ? 'HIGH' : 'MED'}</AdmPill>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{f.user}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginLeft: 'auto', fontFamily: 'Geist Mono, monospace' }}>{f.t}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, marginBottom: 2 }}>{f.headline}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{f.detail}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button className="adm-btn adm-btn-sm adm-btn-secondary">Review</button>
                    <button className="adm-btn adm-btn-sm adm-btn-ghost">Snooze</button>
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)' }}>assigned to <span style={{ color: 'var(--text-secondary)' }}>{f.who}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent users + revenue mini */}
      <AdmSectionHead title="More signals" />
      <div className="adm-grid-2">
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>New signups · last hour</div>
            <a href="Admin-Users.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All users →</a>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Geo</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RECENT_USERS.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AdmAvatar name={u.name} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.name}
                          {u.flag && <span title={u.flagReason} style={{ display: 'inline-grid', placeItems: 'center', width: 14, height: 14, borderRadius: 99, background: 'var(--warning-subtle)', color: 'var(--warning)' }}><AdmIcon name="alert" size={9} /></span>}
                        </div>
                        <div className="col-id">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><AdmPill kind={u.plan === 'Pro' ? 'accent' : u.plan === 'Plus' ? 'info' : ''}>{u.plan}</AdmPill></td>
                  <td className="col-mono">{u.country}</td>
                  <td className="col-mono col-tertiary">{u.joined}</td>
                  <td style={{ width: 32 }}><a href="Admin-User-Detail.html" className="row-action"><AdmIcon name="arrow-up-right" size={13} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="dollar" size={14} /></div>
            <h3 className="adm-card-title">Revenue mix · last 30d</h3>
            <a href="Admin-Revenue.html" className="adm-card-action" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>Detail →</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 24, fontWeight: 600 }}>$487,250</div>
            <div style={{ fontSize: 11, color: 'var(--gain-text)', fontFamily: 'Geist Mono, monospace' }}>+8.4% MoM</div>
          </div>
          {[
            { label: 'Pro · $49/mo',    value: '$294,500', pct: 60.4, n: '6,010 subs' },
            { label: 'Plus · $19/mo',   value: '$112,860', pct: 23.2, n: '5,940 subs' },
            { label: 'Marketplace fees', value: '$58,420',  pct: 12.0, n: '$5.8M GMV · 1%' },
            { label: 'API overage',     value: '$21,470',  pct: 4.4,  n: '472 customers' },
          ].map((r) => (
            <div key={r.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)' }}>{r.value}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>{r.pct}%</span>
              </div>
              <div className="adm-bar"><span style={{ width: `${r.pct}%` }} /></div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'Geist Mono, monospace' }}>{r.n}</div>
            </div>
          ))}
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
