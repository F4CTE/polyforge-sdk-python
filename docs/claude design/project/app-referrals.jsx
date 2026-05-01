/* Polyforge — Referrals
   Earn fee credits by inviting other traders. */

const RF_KPIS = [
  { label: 'Lifetime credits', value: '$284.40', delta: '↑ $48 last 30d', kind: 'gain' },
  { label: 'Active referrals', value: '12',      delta: '4 trading',     kind: 'gain' },
  { label: 'Pending',          value: '6',       delta: 'awaiting first deposit', kind: 'neutral' },
  { label: 'Tier',             value: 'Builder', delta: '8 more for Pioneer', kind: 'neutral' },
];

const RF_REFERRALS = [
  { name: 'Marcus Fischer',  status: 'active',  joined: 'Mar 14', volume: '$84.2k', earned: '$84.20' },
  { name: 'Jenna Chen',      status: 'active',  joined: 'Apr 02', volume: '$48.4k', earned: '$48.40' },
  { name: 'Alex Khan',       status: 'active',  joined: 'Apr 18', volume: '$22.6k', earned: '$22.60' },
  { name: 'Sarah Lim',       status: 'active',  joined: 'Apr 24', volume: '$18.4k', earned: '$18.40' },
  { name: 'Tom Bauer',       status: 'pending', joined: 'Apr 28', volume: '—',      earned: '$0.00' },
  { name: 'Priya Rao',       status: 'pending', joined: 'Apr 28', volume: '—',      earned: '$0.00' },
  { name: 'David Park',      status: 'active',  joined: 'Mar 22', volume: '$12.8k', earned: '$12.80' },
  { name: 'Lisa Wong',       status: 'churned', joined: 'Feb 10', volume: '$2.4k',  earned: '$2.40' },
];

const RF_TIERS = [
  { name: 'Trader',   min: 0,  rate: '5%',  current: false, perks: ['5% of referral fees', 'Standard support'] },
  { name: 'Builder',  min: 5,  rate: '10%', current: true,  perks: ['10% of referral fees', 'Priority support', 'Custom referral link'] },
  { name: 'Pioneer',  min: 20, rate: '15%', current: false, perks: ['15% of referral fees', 'Direct line to founders', 'Branded landing page'] },
  { name: 'Partner',  min: 50, rate: '20%', current: false, perks: ['20% of referral fees', 'Co-marketing opportunities', 'Revenue share on resold strategies'] },
];

function App() {
  const [copied, setCopied] = React.useState(false);
  const link = 'polyforge.com/r/anna-koval';

  return (
    <UsrShell active="referrals" title="Referrals" crumbs={[{ label: 'Referrals' }]}>
      <AdmPageHead
        title="Refer & earn"
        sub="Earn 10% of trading fees from every trader you bring on · paid in fee credits, no cap"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        {RF_KPIS.map(k => <AdmStat key={k.label} label={k.label} value={k.value} delta={k.delta} deltaKind={k.kind} />)}
      </div>

      {/* Hero invite card */}
      <div className="adm-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Your referral link</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Share this with traders, builders, and quants. Both you and your invitee get <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>$25</span> in fee credits when they make their first deposit.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input readOnly value={link} className="adm-input mono" style={{ flex: 1, fontSize: 12 }} />
              <button className="adm-btn adm-btn-primary" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                <AdmIcon name="copy" size={12} />{copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="adm-btn adm-btn-secondary adm-btn-sm"><AdmIcon name="mail" size={11} />Email</button>
              <button className="adm-btn adm-btn-secondary adm-btn-sm">X / Twitter</button>
              <button className="adm-btn adm-btn-secondary adm-btn-sm">Telegram</button>
              <button className="adm-btn adm-btn-secondary adm-btn-sm">Discord</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>How it works</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: 1, t: 'Share your link', d: 'Send to traders interested in prediction markets' },
                { n: 2, t: 'They sign up + deposit', d: 'You both earn $25 in fee credits' },
                { n: 3, t: 'Earn ongoing', d: '10% of their trading fees, paid weekly' },
              ].map(s => (
                <li key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div className="mono tabnum" style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-tertiary)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 10.5, fontWeight: 600,
                  }}>{s.n}</div>
                  <div style={{ flex: 1, paddingTop: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{s.t}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.45 }}>{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Referrals table */}
        <div className="adm-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Your referrals</h3>
          </div>
          <table className="adm-table">
            <thead><tr>
              <th>Trader</th><th>Status</th><th>Joined</th>
              <th style={{ textAlign: 'right' }}>30d volume</th>
              <th style={{ textAlign: 'right' }}>You earned</th>
            </tr></thead>
            <tbody>
              {RF_REFERRALS.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</td>
                  <td>
                    <span className={`adm-pill ${r.status === 'active' ? 'is-gain' : r.status === 'pending' ? 'is-warn' : 'is-loss'}`} style={{ fontSize: 9.5 }}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.joined}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5 }}>{r.volume}</td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: r.earned !== '$0.00' ? 'var(--gain-text)' : 'var(--text-tertiary)' }}>
                    {r.earned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tier ladder */}
        <div className="adm-card" style={{ padding: 18 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Tier ladder</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RF_TIERS.map(t => (
              <div key={t.name} style={{
                padding: 12,
                background: t.current ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                border: `1px solid ${t.current ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                    {t.current && <span className="adm-pill is-info" style={{ fontSize: 9 }}>CURRENT</span>}
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: t.current ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{t.rate}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {t.min === 0 ? 'Default tier' : `${t.min}+ active referrals`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {t.perks.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AdmIcon name="check" size={10} /> {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);