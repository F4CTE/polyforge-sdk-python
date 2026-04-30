/* Polyforge — Admin User Detail */

const USER = {
  id: 'usr_71c2',
  name: 'Mikhail Volkov',
  email: 'volkov.eth@proton.me',
  plan: 'Pro',
  mrr: 49,
  joined: 'Apr 2, 2024',
  country: 'Cyprus',
  ip: '178.32.114.22',
  ipCountry: 'CY · Limassol',
  device: 'macOS 14.4 · Safari 17',
  twofa: 'TOTP',
  kyc: 'Tier 2',
  ltv: '$847',
  lifetime: '12mo',
  refBy: 'usr_3b22',
  invites: 4,
  status: 'flagged',
};

const RISK_TIMELINE = [
  { t: '12m ago',  sev: 'loss', title: 'Drawdown −18.4% on YES · SCOTUS-TIKTOK',  detail: 'Strategy "rumor-fader-pre" · single-market exposure 38%', open: true },
  { t: '4h ago',   sev: 'warn', title: 'Velocity warning · 84% of daily',   detail: '$1.2M notional across 5 markets in 12m', open: false },
  { t: '2d ago',   sev: 'warn', title: 'New device login · Limassol',       detail: 'TOTP confirmed · IP changed from RU → CY', open: false },
  { t: '14d ago',  sev: 'info', title: 'API key rotated',                    detail: 'User-initiated from settings', open: false },
];

const ORDERS = [
  { id: 'ord_FX-92177', t: '00:00:09', side: 'YES', mkt: 'SCOTUS-TIKTOK',  venue: 'Polymarket',qty: '12,000 sh', px: '0.42¢', state: 'FILL', pnl: '+$184' },
  { id: 'ord_FX-92172', t: '00:04:14', side: 'NO',  mkt: 'CPI-MAR-LT3',    venue: 'Kalshi',    qty: '4,000 sh',  px: '0.38¢', state: 'FILL', pnl: '+$22'  },
  { id: 'ord_FX-92168', t: '00:08:33', side: 'YES', mkt: 'SCOTUS-TIKTOK',  venue: 'Polymarket',qty: '8,400 sh',  px: '0.41¢', state: 'FILL', pnl: '−$74'  },
  { id: 'ord_FX-92161', t: '00:14:02', side: 'YES', mkt: 'SCOTUS-TIKTOK',  venue: 'Polymarket',qty: '7,200 sh',  px: '0.44¢', state: 'FILL', pnl: '−$192' },
  { id: 'ord_FX-92155', t: '00:21:48', side: 'NO',  mkt: 'OSCAR-BP-A',     venue: 'Kalshi',    qty: '3,600 sh',  px: '0.62¢', state: 'PART', pnl: '−$48'  },
  { id: 'ord_FX-92149', t: '00:32:11', side: 'YES', mkt: 'SCOTUS-TIKTOK',  venue: 'Polymarket',qty: '8,000 sh',  px: '0.40¢', state: 'CANC', pnl: '$0'    },
];

const STRATEGIES = [
  { name: 'rumor-fader-pre',     visibility: 'private', deployed: '2d ago',  pnl30d: '−18.4%', vol30d: '$4.2M', state: 'active',  alert: true },
  { name: 'fed-rate-cut-tracker',visibility: 'forked',  deployed: '14d ago', pnl30d: '+12.1%', vol30d: '$2.1M', state: 'active',  alert: false },
  { name: 'oscars-favorite-hedge',visibility:'private', deployed: '32d ago', pnl30d: '+4.2%',  vol30d: '$1.4M', state: 'paused', alert: false },
  { name: 'poll-fade-elections', visibility: 'private', deployed: '60d ago', pnl30d: '+1.1%',  vol30d: '$0.7M', state: 'active',  alert: false },
];

const SESSIONS = [
  { device: 'Safari 17 · macOS 14.4',  ip: '178.32.114.22', loc: 'CY · Limassol',  last: 'now',     curr: true },
  { device: 'iOS 17 · iPhone 15 Pro',  ip: '178.32.114.18', loc: 'CY · Limassol',  last: '32m ago', curr: false },
  { device: 'API · key fk_live_…3a2f', ip: '15.220.18.4',   loc: 'AWS us-east-1',  last: '2h ago',  curr: false },
];

function App() {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <AdmShell active="users" title={USER.name} crumbs={[{ label: 'People' }, { label: 'Users', href: 'Admin-Users.html' }]} actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="mail" size={12} />Email</button>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="copy" size={12} />Copy ID</button>
        <button className="adm-btn adm-btn-danger" onClick={()=>setConfirmOpen(true)}><AdmIcon name="lock" size={12} />Suspend</button>
      </>
    }>
      {/* Identity card */}
      <div className="adm-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, padding: '20px 22px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <AdmAvatar name={USER.name} size="lg" tone="var(--loss)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{USER.name}</h2>
                <AdmPill kind="loss" dot pulse>FLAGGED</AdmPill>
                <AdmPill kind="accent">Pro · $49/mo</AdmPill>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span><span style={{color:'var(--text-tertiary)'}}>id</span> <span className="mono">{USER.id}</span></span>
                <span><span style={{color:'var(--text-tertiary)'}}>email</span> <span className="mono">{USER.email}</span></span>
                <span><span style={{color:'var(--text-tertiary)'}}>joined</span> {USER.joined}</span>
                <span><span style={{color:'var(--text-tertiary)'}}>ref by</span> <a href="Admin-Users.html" className="mono" style={{color:'var(--accent-text)',textDecoration:'none'}}>{USER.refBy}</a></span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" title="Notes"><AdmIcon name="edit" size={11} />Notes</button>
            <button className="adm-btn adm-btn-ghost adm-btn-sm"><AdmIcon name="more" size={12} /></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { k: 'Lifetime value', v: USER.ltv,    sub: USER.lifetime + ' on platform' },
            { k: 'KYC level',      v: USER.kyc,    sub: 'verified' },
            { k: '2FA',            v: USER.twofa,  sub: 'enabled' },
            { k: 'IP · current',   v: USER.ip,     sub: USER.ipCountry, mono: true },
            { k: 'Device',         v: 'macOS',     sub: 'Safari 17' },
            { k: 'Risk score',     v: '78 / 100',  sub: 'high', tone: 'loss' },
          ].map((m, i) => (
            <div key={m.k} style={{ padding: '14px 18px', borderRight: i < 5 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>{m.k}</div>
              <div style={{ fontFamily: m.mono ? 'Geist Mono, monospace' : 'inherit', fontSize: m.mono ? 13 : 15, fontWeight: 600, color: m.tone === 'loss' ? 'var(--loss-text)' : 'var(--text-primary)' }}>{m.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'Geist Mono, monospace' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-grid-2">
        {/* Left column */}
        <div>
          {/* Risk timeline */}
          <div className="adm-table-wrap" style={{ marginBottom: 16 }}>
            <div className="adm-table-tools">
              <span className="adm-dot is-loss" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Risk timeline</div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>1 open · 3 resolved</span>
              <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{ marginLeft: 'auto' }}><AdmIcon name="plus" size={11} />Add note</button>
            </div>
            <div>
              {RISK_TIMELINE.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: i < RISK_TIMELINE.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: r.sev === 'loss' ? 'var(--loss)' : r.sev === 'warn' ? 'var(--warning)' : 'var(--info)', marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{r.title}</span>
                      {r.open && <AdmPill kind="loss">OPEN</AdmPill>}
                      <span style={{ marginLeft: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-tertiary)' }}>{r.t}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div className="adm-table-wrap">
            <div className="adm-table-tools">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent orders</div>
              <a href="Admin-Orders.html" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>All 1,284 →</a>
            </div>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Order</th>
                  <th>Side</th>
                  <th>Market</th>
                  <th className="col-num">Qty</th>
                  <th className="col-num">Price</th>
                  <th>State</th>
                  <th className="col-num">P&L</th>
                </tr>
              </thead>
              <tbody>
                {ORDERS.map((o) => (
                  <tr key={o.id}>
                    <td className="col-mono col-tertiary">{o.t}</td>
                    <td className="col-id">{o.id}</td>
                    <td><AdmPill kind={o.side === 'BUY' ? 'gain' : 'loss'}>{o.side}</AdmPill></td>
                    <td><span className="mono">{o.mkt}</span><div style={{fontSize:10.5,color:'var(--text-tertiary)'}}>{o.venue}</div></td>
                    <td className="col-num">{o.qty}</td>
                    <td className="col-num">{o.px}</td>
                    <td>{o.state === 'FILL' ? <AdmPill kind="gain">FILL</AdmPill> : o.state === 'PART' ? <AdmPill kind="warn">PART</AdmPill> : <AdmPill>CANC</AdmPill>}</td>
                    <td className="col-num" style={{ color: o.pnl.startsWith('+') ? 'var(--gain-text)' : o.pnl.startsWith('−') ? 'var(--loss-text)' : 'var(--text-tertiary)', fontWeight: 600 }}>{o.pnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Strategies */}
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <div className="adm-card-head">
              <div className="adm-card-icon"><AdmIcon name="blocks" size={14} /></div>
              <h3 className="adm-card-title">Strategies</h3>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{STRATEGIES.length} deployed</span>
            </div>
            {STRATEGIES.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <div className={`adm-stat-icon ${s.alert ? 'is-loss' : ''}`} style={{ width: 26, height: 26, flexShrink: 0 }}><AdmIcon name="blocks" size={12} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }} className="mono">{s.name}</span>
                    {s.alert && <AdmPill kind="loss">ALERT</AdmPill>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.visibility} · deployed {s.deployed}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, fontWeight: 600, color: s.pnl30d.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{s.pnl30d}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.vol30d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <div className="adm-card-head">
              <div className="adm-card-icon"><AdmIcon name="server" size={14} /></div>
              <h3 className="adm-card-title">Active sessions</h3>
              <button className="adm-btn adm-btn-sm adm-btn-ghost" style={{marginLeft:'auto'}}>Revoke all</button>
            </div>
            {SESSIONS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{s.device}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.ip} · {s.loc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.curr ? <AdmPill kind="gain" dot pulse>NOW</AdmPill> : <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.last}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Billing */}
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <div className="adm-card-head">
              <div className="adm-card-icon"><AdmIcon name="dollar" size={14} /></div>
              <h3 className="adm-card-title">Billing</h3>
              <button className="adm-btn adm-btn-sm adm-btn-ghost" style={{marginLeft:'auto'}}>Stripe →</button>
            </div>
            {[
              { k: 'Plan', v: 'Pro · $49/month' },
              { k: 'Next charge', v: 'Mar 12, 2025' },
              { k: 'Card', v: '•••• 4242 · Visa' },
              { k: 'Lifetime', v: '$847.00' },
              { k: 'Outstanding', v: '$0.00' },
            ].map((r) => (
              <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-subtle)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{r.k}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: r.k === 'Card' || r.k.includes('Lifetime') || r.k.includes('Outstanding') ? 'Geist Mono, monospace' : 'inherit' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{flex:1}}>Apply credit</button>
              <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{flex:1}}>Refund</button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="adm-card" style={{ borderColor: 'color-mix(in srgb, var(--loss) 30%, var(--border-subtle))' }}>
            <div className="adm-card-head">
              <div className="adm-card-icon" style={{color:'var(--loss-text)'}}><AdmIcon name="alert" size={14} /></div>
              <h3 className="adm-card-title" style={{color:'var(--loss-text)'}}>Danger zone</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="adm-btn adm-btn-secondary" style={{justifyContent:'flex-start'}}><AdmIcon name="lock" size={12} />Force password reset</button>
              <button className="adm-btn adm-btn-secondary" style={{justifyContent:'flex-start'}}><AdmIcon name="shield-alert" size={12} />Revoke all API keys</button>
              <button className="adm-btn adm-btn-secondary" style={{justifyContent:'flex-start'}}>Halt all strategies</button>
              <button className="adm-btn adm-btn-danger" onClick={()=>setConfirmOpen(true)}><AdmIcon name="lock" size={12} />Suspend account</button>
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="adm-modal-scrim" onClick={()=>setConfirmOpen(false)}>
          <div className="adm-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="adm-modal-head">
              <div className="adm-modal-icon"><AdmIcon name="alert" size={18} /></div>
              <div style={{flex:1}}>
                <h3 className="adm-modal-title">Suspend Mikhail Volkov?</h3>
                <p className="adm-modal-sub">All sessions revoked. Active strategies halted in flatten-only mode. User receives email notification.</p>
              </div>
            </div>
            <div className="adm-modal-body">
              <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reason (required)</div>
              <select style={{width:'100%',background:'var(--bg-app)',border:'1px solid var(--border-default)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:12,fontFamily:'inherit',marginBottom:10}}>
                <option>Wash trading — confirmed</option>
                <option>KYC failure</option>
                <option>Fraudulent payment</option>
                <option>TOS violation</option>
                <option>Customer request</option>
              </select>
              <textarea placeholder="Notes for audit log…" style={{width:'100%',background:'var(--bg-app)',border:'1px solid var(--border-default)',borderRadius:6,padding:'8px 10px',color:'var(--text-primary)',fontSize:12,fontFamily:'inherit',minHeight:60,resize:'vertical'}} />
            </div>
            <div className="adm-modal-foot">
              <button className="adm-btn adm-btn-ghost" onClick={()=>setConfirmOpen(false)}>Cancel</button>
              <button className="adm-btn adm-btn-danger">Suspend account</button>
            </div>
          </div>
        </div>
      )}
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
