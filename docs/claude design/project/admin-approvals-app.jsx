/* Polyforge — Admin Approvals queue */

const QUEUE = [
  { id: 'apv_4a2f', kind: 'kyc-tier3',     priority: 'high',  user: 'Mikhail Volkov',   email: 'volkov.eth@proton.me', sla: '2h 14m', age: '6h ago',  amount: '—',         note: 'Tier 3 unlock · $50K+ daily limit', country: 'CY' },
  { id: 'apv_4a2e', kind: 'large-withdraw',priority: 'high',  user: 'Diego Fernández',  email: 'diego.f@yahoo.es',     sla: '0h 48m', age: '11h ago', amount: '$248,400',  note: 'USDC → Polygon wallet 0x71…8a',     country: 'ES' },
  { id: 'apv_4a2d', kind: 'venue-link',    priority: 'med',   user: 'Olivia Chen',      email: 'olivia@chenadvisory.com', sla: '4h 22m', age: '4h ago',  amount: '—',     note: 'Link Kalshi institutional account',   country: 'SG' },
  { id: 'apv_4a2c', kind: 'kyc-tier2',     priority: 'med',   user: 'Idris Mohammed',   email: 'idris.m@outlook.com',  sla: '8h 02m', age: '2h ago',  amount: '—',         note: 'Passport · proof-of-address upload',  country: 'NG' },
  { id: 'apv_4a2b', kind: 'refund',        priority: 'med',   user: 'Karina Tanaka',    email: 'karina.t@gmail.com',   sla: '12h',    age: '1h ago',  amount: '$199.00',   note: 'Annual plan · downgrade window',      country: 'CA' },
  { id: 'apv_4a2a', kind: 'venue-link',    priority: 'low',   user: 'Marco Vassallo',   email: 'm.vassallo@gmail.com', sla: '22h',    age: '12h ago', amount: '—',         note: 'Manifold sub-account · API key',       country: 'IT' },
  { id: 'apv_4a29', kind: 'kyc-tier2',     priority: 'low',   user: 'Aisha Rahimi',     email: 'aisha.r@protonmail.com', sla: '23h',  age: '14h ago', amount: '—',         note: 'Driver license · selfie',              country: 'GB' },
  { id: 'apv_4a28', kind: 'large-position', priority: 'high',  user: 'Tomás Reyes',      email: 'treyes@correo.mx',     sla: '1h 12m', age: '8h ago',  amount: '$420K',     note: 'Single-market exposure cap raise',      country: 'MX' },
  { id: 'apv_4a27', kind: 'large-withdraw',priority: 'med',   user: 'Sora Yamamoto',    email: 's.yamamoto@gmail.com', sla: '3h',     age: '5h ago',  amount: '$84,200',   note: 'USDC → bank wire (Wise)',            country: 'JP' },
  { id: 'apv_4a26', kind: 'refund',        priority: 'low',   user: 'Lukas Müller',     email: 'l.mueller@gmx.de',     sla: '18h',    age: '6h ago',  amount: '$19.00',    note: 'Dispute · charge unrecognized',        country: 'DE' },
  { id: 'apv_4a25', kind: 'kyc-tier3',     priority: 'med',   user: 'Arjun Patel',      email: 'arjun.p@aol.com',      sla: '7h',     age: '17h ago', amount: '—',         note: 'Tier 3 · enhanced due diligence',      country: 'AE' },
  { id: 'apv_4a24', kind: 'venue-link',    priority: 'low',   user: 'Jonas Bergquist',  email: 'jonas@bergquist.io',   sla: '21h',    age: '3h ago',  amount: '—',         note: 'PredictIt account · read-only',          country: 'SE' },
];

const KIND_META = {
  'kyc-tier2':      { label: 'KYC · T2',      icon: 'shield-check', tone: '' },
  'kyc-tier3':      { label: 'KYC · T3',      icon: 'shield-check', tone: 'is-info' },
  'large-withdraw': { label: 'Withdraw',      icon: 'dollar',       tone: 'is-warn' },
  'venue-link':     { label: 'Venue link',    icon: 'globe',        tone: '' },
  'refund':         { label: 'Refund',        icon: 'dollar',       tone: '' },
  'large-position': { label: 'Large pos.',    icon: 'trending',     tone: 'is-loss' },
};

function PrioPill({ p }) {
  const m = { high: { kind: 'loss', label: 'HIGH' }, med: { kind: 'warn', label: 'MED' }, low: { kind: '', label: 'LOW' } };
  return <AdmPill kind={m[p].kind}>{m[p].label}</AdmPill>;
}

function App() {
  const [tab, setTab] = React.useState('all');
  const [focused, setFocused] = React.useState(QUEUE[0]);

  const filtered = tab === 'all' ? QUEUE : QUEUE.filter(q => q.kind.startsWith(tab) || q.kind === tab);

  return (
    <AdmShell active="approvals" title="Approvals" crumbs={[{ label: 'People' }]} actions={
      <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />SLA rules</button>
    }>
      <AdmPageHead
        title="Approvals queue"
        sub={<>{QUEUE.length} pending · 4 SLA-critical · median resolution <span className="mono" style={{color:'var(--text-secondary)'}}>2h 18m</span></>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Pending" value="12" icon="ticket" />
        <AdmStat label="SLA breach risk" value="4" delta="2 within 1h" deltaKind="loss" icon="clock" iconKind="is-loss" />
        <AdmStat label="Approved · 24h" value="38" delta="92% on time" deltaKind="gain" icon="circle-check" iconKind="is-gain" />
        <AdmStat label="Rejected · 24h" value="6" delta="3 fraud" deltaKind="loss" icon="circle-x" iconKind="is-loss" />
      </div>

      <div className="adm-grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        {/* Queue list */}
        <div className="adm-table-wrap">
          <div className="adm-table-tools">
            <AdmFilter active={tab==='all'} count={QUEUE.length} onClick={()=>setTab('all')}>All</AdmFilter>
            <AdmFilter active={tab==='kyc'} count="3" onClick={()=>setTab('kyc')}>KYC</AdmFilter>
            <AdmFilter active={tab==='large-withdraw'} count="2" onClick={()=>setTab('large-withdraw')}>Withdrawals</AdmFilter>
            <AdmFilter active={tab==='venue-link'} count="3" onClick={()=>setTab('venue-link')}>Venue</AdmFilter>
            <AdmFilter active={tab==='refund'} count="2" onClick={()=>setTab('refund')}>Refund</AdmFilter>
            <AdmFilter active={tab==='large-position'} count="1" onClick={()=>setTab('large-position')}>Large pos.</AdmFilter>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>User</th>
                <th>Detail</th>
                <th>Priority</th>
                <th>SLA</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const meta = KIND_META[q.kind];
                const slaCrit = q.sla.startsWith('0h') || (q.sla.startsWith('1h') && q.priority === 'high');
                return (
                  <tr key={q.id} className={focused.id === q.id ? 'is-selected' : ''} onClick={()=>setFocused(q)} style={{cursor:'pointer'}}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={`adm-stat-icon ${meta.tone}`} style={{ width: 24, height: 24 }}><AdmIcon name={meta.icon} size={12} /></div>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{q.user}</div>
                      <div className="col-id">{q.country} · {q.email.split('@')[1]}</div>
                    </td>
                    <td className="col-secondary" style={{ fontSize: 12 }}>
                      {q.amount !== '—' && <span className="mono" style={{color:'var(--text-primary)',marginRight:8,fontWeight:600}}>{q.amount}</span>}
                      {q.note}
                    </td>
                    <td><PrioPill p={q.priority} /></td>
                    <td className="col-mono" style={{ color: slaCrit ? 'var(--loss-text)' : 'var(--text-secondary)', fontWeight: slaCrit ? 600 : 400 }}>{q.sla}</td>
                    <td className="col-mono col-tertiary">{q.age}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Focused inspector */}
        <div className="adm-card" style={{ alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className={`adm-stat-icon ${KIND_META[focused.kind].tone}`} style={{ width: 32, height: 32 }}><AdmIcon name={KIND_META[focused.kind].icon} size={15} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{KIND_META[focused.kind].label} · {focused.user}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{focused.id}</div>
            </div>
            <PrioPill p={focused.priority} />
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            {focused.amount !== '—' && (
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{focused.amount}</div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{focused.note}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { k: 'Submitted', v: focused.age },
              { k: 'SLA left', v: focused.sla, mono: true, tone: focused.sla.startsWith('0h') ? 'loss' : '' },
              { k: 'Country', v: focused.country },
              { k: 'Risk score', v: '34/100' },
            ].map((r) => (
              <div key={r.k}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 3 }}>{r.k}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: r.tone === 'loss' ? 'var(--loss-text)' : 'var(--text-primary)', fontFamily: r.mono ? 'Geist Mono, monospace' : 'inherit' }}>{r.v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Compliance checks</div>
            {[
              { k: 'KYC tier 2 verified',     ok: true },
              { k: 'Sanctions screen',        ok: true },
              { k: 'PEP check',               ok: true },
              { k: 'Source of funds',         ok: false, note: 'Bank statement pending' },
              { k: 'Velocity within limits',  ok: true },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                <AdmIcon name={c.ok ? 'circle-check' : 'circle-x'} size={13} className={c.ok ? '' : 'is-loss'} />
                <span style={{ flex: 1, color: c.ok ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{c.k}</span>
                {c.note && <span style={{ fontSize: 10.5, color: 'var(--warning)', fontFamily: 'Geist Mono, monospace' }}>{c.note}</span>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Decision note</div>
            <textarea placeholder="Reasoning for audit log…" style={{width:'100%',background:'var(--bg-app)',border:'1px solid var(--border-default)',borderRadius:6,padding:10,color:'var(--text-primary)',fontSize:12,fontFamily:'inherit',minHeight:70,resize:'vertical'}} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn adm-btn-primary" style={{flex:1}}><AdmIcon name="check" size={12} />Approve</button>
            <button className="adm-btn adm-btn-secondary" style={{flex:1}}>Request more</button>
            <button className="adm-btn adm-btn-danger" style={{flex:1}}><AdmIcon name="x" size={12} />Reject</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--text-tertiary)', textAlign: 'center', fontFamily: 'Geist Mono, monospace' }}>
            ⌘↵ approve · ⌘⇧↵ reject · J/K to navigate
          </div>
        </div>
      </div>
    </AdmShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
