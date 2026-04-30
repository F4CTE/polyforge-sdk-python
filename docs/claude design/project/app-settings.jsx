/* Polyforge — Settings (profile · security · billing · trading · notifs · danger) */

const TABS = [
  { id: 'profile',  label: 'Profile',       icon: 'user' },
  { id: 'security', label: 'Security',      icon: 'lock' },
  { id: 'trading',  label: 'Trading',       icon: 'bar-chart' },
  { id: 'billing',  label: 'Billing',       icon: 'dollar' },
  { id: 'notifs',   label: 'Notifications', icon: 'bell' },
  { id: 'danger',   label: 'Danger zone',   icon: 'alert' },
];

function Section({ title, desc, children, danger = false }) {
  return (
    <div
      className="adm-card"
      style={{
        padding: 22,
        marginBottom: 16,
        ...(danger ? {
          borderColor: 'color-mix(in srgb, var(--loss) 30%, var(--border-default))',
          background:  'color-mix(in srgb, var(--loss) 4%, var(--bg-card))',
        } : {}),
      }}
    >
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 4, color: danger ? 'var(--loss-text)' : undefined }}>{title}</h3>
      {desc && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 16 }}>{desc}</p>}
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: 18,
      alignItems: 'flex-start',
      padding: '14px 0',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ on = false, onChange }) {
  const [v, setV] = React.useState(on);
  function handle() {
    const next = !v;
    setV(next);
    onChange && onChange(next);
  }
  return (
    <button
      onClick={handle}
      role="switch"
      aria-checked={v}
      style={{
        width: 36, height: 20, borderRadius: 12,
        background: v ? 'var(--accent-default)' : 'var(--bg-app)',
        border: '1px solid var(--border-default)',
        position: 'relative', cursor: 'pointer', padding: 0,
        transition: 'background 120ms',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 1,
        left: v ? 17 : 1,
        width: 16, height: 16,
        borderRadius: '50%',
        background: 'white',
        transition: 'left 120ms',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/* ---- Profile tab ---- */
function ProfileTab() {
  return (
    <>
      <Section title="Profile" desc="Public information visible across your team and on shared backtests.">
        <Field label="Avatar" hint="JPG or PNG, square, max 2 MB.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--bg-app)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 18,
              border: '1px solid var(--border-subtle)',
            }}>AD</div>
            <button className="adm-btn adm-btn-ghost"><AdmIcon name="upload" size={12} />Upload</button>
            <button className="adm-btn adm-btn-ghost">Remove</button>
          </div>
        </Field>
        <Field label="Display name">
          <input className="adm-input" defaultValue="Ada Diallo" />
        </Field>
        <Field label="Username" hint="polyforge.io/u/ada-diallo">
          <input className="adm-input" defaultValue="ada-diallo" />
        </Field>
        <Field label="Email" hint="Used for login and notifications.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="adm-input" defaultValue="ada@stochasticlabs.io" style={{ flex: 1 }} />
            <span className="adm-pill is-gain has-dot" style={{ alignSelf: 'center', height: 22 }}>verified</span>
          </div>
        </Field>
        <Field label="Timezone">
          <select className="adm-input" defaultValue="UTC">
            <option>UTC</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
            <option>Asia/Tokyo</option>
          </select>
        </Field>
        <Field label="Bio" hint="Shown on your public strategies.">
          <textarea className="adm-input" rows={3} defaultValue="Ex-renaissance quant. Building event-driven strategies on prediction markets." />
        </Field>
      </Section>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="adm-btn adm-btn-ghost">Reset</button>
        <button className="adm-btn adm-btn-primary">Save changes</button>
      </div>
    </>
  );
}

/* ---- Security tab ---- */
function SecurityTab() {
  const SESSIONS = [
    { dev: 'MacBook Pro · Safari', loc: 'New York, NY · 64.181.204.12',  last: 'now',        cur: true  },
    { dev: 'iPhone 15 · Safari',   loc: 'New York, NY · 67.245.10.224',  last: '2 hours ago', cur: false },
    { dev: 'Linux · Firefox',      loc: 'Lisbon, PT · 188.250.40.18',    last: '4 days ago',  cur: false },
  ];
  return (
    <>
      <Section title="Password">
        <Field label="Current password">
          <input className="adm-input" type="password" defaultValue="············" />
        </Field>
        <Field label="New password" hint="Min 12 characters · 1 number · 1 symbol.">
          <input className="adm-input" type="password" placeholder="············" />
        </Field>
        <Field label="Confirm new">
          <input className="adm-input" type="password" placeholder="············" />
        </Field>
      </Section>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="adm-btn adm-btn-ghost">Cancel</button>
        <button className="adm-btn adm-btn-primary">Update password</button>
      </div>

      <Section title="Two-factor authentication" desc="Required for live trading and withdrawals.">
        <Field label="Authenticator app" hint="Google Authenticator, 1Password, Authy.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="adm-pill is-gain has-dot" style={{ height: 22 }}>enabled</span>
            <button className="adm-btn adm-btn-ghost">Reconfigure</button>
          </div>
        </Field>
        <Field label="Hardware key" hint="WebAuthn / YubiKey. Strongest for live withdrawals.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="adm-pill" style={{ height: 22 }}>not configured</span>
            <button className="adm-btn adm-btn-secondary">Add key</button>
          </div>
        </Field>
        <Field label="Backup codes" hint="Single-use codes for account recovery.">
          <button className="adm-btn adm-btn-ghost">
            <AdmIcon name="download" size={12} />Regenerate &amp; download
          </button>
        </Field>
      </Section>

      <Section title="Active sessions" desc={`${SESSIONS.length} active sessions. Revoke any you don't recognize.`}>
        {SESSIONS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AdmIcon name={s.dev.startsWith('iPhone') ? 'smartphone' : 'monitor'} size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                {s.dev}
                {s.cur && <span className="adm-pill is-gain" style={{ marginLeft: 8, height: 16, fontSize: 9.5 }}>this device</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.loc} · last active {s.last}</div>
            </div>
            {!s.cur && <button className="adm-btn adm-btn-ghost">Revoke</button>}
          </div>
        ))}
        <button className="adm-btn adm-btn-danger" style={{ marginTop: 14 }}>Revoke all other sessions</button>
      </Section>
    </>
  );
}

/* ---- Trading tab ---- */
function TradingTab() {
  return (
    <>
      <Section title="Defaults" desc="Used when you don't override per strategy.">
        <Field label="Default mode" hint="New strategies start here.">
          <select className="adm-input" defaultValue="paper">
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </Field>
        <Field label="Default size · USD">
          <input className="adm-input" type="number" defaultValue="100" />
        </Field>
        <Field label="Default order type">
          <select className="adm-input">
            <option>Limit</option>
            <option>TWAP</option>
            <option>Market (taker)</option>
          </select>
        </Field>
        <Field label="Slippage tolerance">
          <input className="adm-input" defaultValue="2 cents" />
        </Field>
        <Field label="Confirm before live trade" hint="Require typed confirmation when promoting paper → live.">
          <Toggle on={true} />
        </Field>
      </Section>

      <Section title="Risk guardrails" desc="Hard caps applied across all live strategies.">
        <Field label="Max position concentration" hint="As % of total capital deployed.">
          <input className="adm-input" defaultValue="25%" />
        </Field>
        <Field label="Daily drawdown kill-switch" hint="Pauses all live strategies if breached.">
          <input className="adm-input" defaultValue="−6%" />
        </Field>
        <Field label="Daily order budget">
          <input className="adm-input" defaultValue="$2,000" />
        </Field>
        <Field label="Allow trading during illiquid hours" hint="Market depth below $5k notional.">
          <Toggle on={false} />
        </Field>
      </Section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="adm-btn adm-btn-ghost">Reset to defaults</button>
        <button className="adm-btn adm-btn-primary">Save changes</button>
      </div>
    </>
  );
}

/* ---- Billing tab ---- */
function BillingTab() {
  const USAGE = [
    { l: 'Strategies',    v: '5 / unlimited', pct: 0  },
    { l: 'Seats',         v: '6 / 10',        pct: 60 },
    { l: 'Backtest hours', v: '38 / 100',     pct: 38 },
  ];
  return (
    <>
      <Section title="Plan">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'color-mix(in srgb, var(--accent-default) 8%, transparent)',
          borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--accent-default) 30%, var(--border-default))',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Pro · $99/mo</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Unlimited strategies · 10 seats · whale alerts · priority routing</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn adm-btn-ghost">Compare plans</button>
            <button className="adm-btn adm-btn-secondary">Manage</button>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          Renews May 22, 2026 · paid via Visa ****4421
        </div>
      </Section>

      <Section title="Usage · this period">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {USAGE.map((u, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.l}</div>
              <div style={{ fontSize: 14, fontFamily: 'Geist Mono, monospace', fontWeight: 600, marginBottom: 6 }}>{u.v}</div>
              <div style={{ height: 4, background: 'var(--bg-app)', borderRadius: 99, overflow: 'hidden' }}>
                {u.pct > 0 && <div style={{ width: `${u.pct}%`, height: '100%', background: 'var(--accent-default)' }} />}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Payment methods">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 24, borderRadius: 4,
              background: 'linear-gradient(135deg, #1a1f71 0%, #1434cb 100%)',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
            }}>VISA</div>
            <div>
              <div style={{ fontSize: 12.5 }}>Visa ending in 4421</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Expires 09/2028 · default</div>
            </div>
          </div>
          <button className="adm-btn adm-btn-ghost">Edit</button>
        </div>
        <button className="adm-btn adm-btn-secondary" style={{ marginTop: 12 }}>
          <AdmIcon name="plus" size={12} />Add payment method
        </button>
      </Section>
    </>
  );
}

/* ---- Notifications tab ---- */
const NOTIF_ROWS = [
  { l: 'Order fills',                              email: true,  push: true,  sms: false },
  { l: 'Whale signals you follow',                 email: true,  push: true,  sms: false },
  { l: 'Strategy errors',                          email: true,  push: true,  sms: true  },
  { l: 'Risk events · drawdown / kill-switch',     email: true,  push: true,  sms: true  },
  { l: 'Daily P&L summary',                        email: true,  push: false, sms: false },
  { l: 'Marketplace updates',                      email: false, push: false, sms: false },
  { l: 'Product news',                             email: true,  push: false, sms: false },
];

const COL_GRID = { display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12 };

function NotifsTab() {
  return (
    <>
      <Section title="Notification preferences" desc="Choose what to receive and where.">
        {/* Column headers */}
        <div style={{
          ...COL_GRID,
          padding: '8px 0',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <span />
          <span>Email</span>
          <span>Push</span>
          <span>SMS</span>
        </div>

        {NOTIF_ROWS.map((row, i) => (
          <div key={i} style={{
            ...COL_GRID,
            alignItems: 'center',
            padding: '12px 0',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 12.5 }}>{row.l}</span>
            <Toggle on={row.email} />
            <Toggle on={row.push} />
            <Toggle on={row.sms} />
          </div>
        ))}
      </Section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="adm-btn adm-btn-ghost">Reset to defaults</button>
        <button className="adm-btn adm-btn-primary">Save preferences</button>
      </div>
    </>
  );
}

/* ---- Danger zone tab ---- */
function DangerTab() {
  return (
    <Section title="Danger zone" desc="Irreversible. Read carefully." danger>
      <Field label="Pause all strategies" hint="Stops new orders. Existing fills are kept.">
        <button className="adm-btn adm-btn-secondary">Pause everything</button>
      </Field>
      <Field label="Cancel all open orders" hint="Across both venues, all strategies.">
        <button className="adm-btn adm-btn-secondary">Cancel all (4)</button>
      </Field>
      <Field label="Export &amp; wipe paper account" hint="Resets paper balance to $50,000.">
        <button className="adm-btn adm-btn-secondary">Reset paper</button>
      </Field>
      <Field label="Close account" hint="Withdraw all funds first. Activity log is retained 7 years.">
        <button className="adm-btn adm-btn-danger">Permanently delete account</button>
      </Field>
    </Section>
  );
}

/* ---- Root ---- */
function App() {
  const [tab, setTab] = React.useState('profile');

  const TAB_CONTENT = {
    profile:  <ProfileTab />,
    security: <SecurityTab />,
    trading:  <TradingTab />,
    billing:  <BillingTab />,
    notifs:   <NotifsTab />,
    danger:   <DangerTab />,
  };

  return (
    <UsrShell active="settings" title="Settings">
      <AdmPageHead title="Settings" subtitle="Manage your account, security, trading defaults, and billing." />

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Sidebar nav */}
        <aside style={{ alignSelf: 'start', position: 'sticky', top: 84 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 10px', borderRadius: 6,
                background: tab === t.id ? 'var(--bg-hover)' : 'transparent',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none', fontSize: 12.5, cursor: 'pointer',
                marginBottom: 2,
                fontWeight: tab === t.id ? 500 : 400,
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'background 100ms, color 100ms',
              }}
            >
              <AdmIcon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </aside>

        {/* Tab content */}
        <div style={{ minWidth: 0 }}>
          {TAB_CONTENT[tab]}
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
