/* Polyforge — Trading Account Settings
   Per-account config: limits, risk, default behaviors, fee tier. */

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div style={{ alignSelf: 'center' }}>{children}</div>
    </div>
  );
}

function App() {
  const [tab, setTab] = React.useState('account');
  const tabs = [
    { id: 'account',  label: 'Account' },
    { id: 'limits',   label: 'Limits' },
    { id: 'risk',     label: 'Risk' },
    { id: 'fees',     label: 'Fees' },
    { id: 'auto',     label: 'Automation' },
  ];

  return (
    <UsrShell active="settings" title="Trading account"
      crumbs={[{ label: 'Settings', href: 'App-Settings.html' }, { label: 'Trading account' }]}
      actions={<>
        <button className="adm-btn">Cancel</button>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="check" size={12} />Save changes</button>
      </>}
    >
      <AdmPageHead
        title="Trading account"
        sub="Configure default behaviors, limits, and risk controls for your live trading account"
      />

      {/* Account header */}
      <div className="adm-card" style={{ padding: 18, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)' }}>
            <AdmIcon name="wallet" size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Anna Koval — Live</div>
              <span className="adm-pill is-gain" style={{ fontSize: 9.5 }}>VERIFIED</span>
              <span className="adm-pill is-info" style={{ fontSize: 9.5 }}>BUILDER TIER</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              0xAB12…f4E2 · Polymarket UMA address
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>$48,420</div>Available</div>
          <div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>$84,260</div>Equity</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`adm-tab ${tab === t.id ? 'is-active' : ''}`}
            style={{
              padding: '10px 16px',
              borderBottom: tab === t.id ? '2px solid var(--accent-default)' : '2px solid transparent',
              fontSize: 12.5, marginBottom: -1,
            }}>{t.label}</button>
        ))}
      </div>

      <div className="adm-card" style={{ padding: '4px 22px 22px' }}>
        {tab === 'account' && <>
          <Field label="Account name" hint="Display name for this trading account in your portfolio.">
            <input defaultValue="Anna Koval — Live" className="adm-input" style={{ width: 320 }} />
          </Field>
          <Field label="Base currency" hint="USDC is the only settlement currency on Polymarket.">
            <select className="adm-input" defaultValue="USDC" style={{ width: 200 }}>
              <option>USDC</option>
            </select>
          </Field>
          <Field label="Time zone" hint="Used for daily/weekly aggregations and statement generation.">
            <select className="adm-input" defaultValue="UTC" style={{ width: 200 }}>
              <option>UTC</option>
              <option>US/Eastern</option>
              <option>US/Pacific</option>
              <option>Europe/London</option>
              <option>Asia/Singapore</option>
            </select>
          </Field>
          <Field label="Account mode" hint="Live trades real funds. Paper simulates fills against live prices.">
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="adm-btn adm-btn-primary">Live</button>
              <button className="adm-btn">Paper</button>
            </div>
          </Field>
        </>}

        {tab === 'limits' && <>
          <Field label="Max position size" hint="Hard cap on notional per single market.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ color: 'var(--text-tertiary)' }}>$</span>
              <input defaultValue="25000" className="adm-input mono" style={{ width: 160 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>per market</span>
            </div>
          </Field>
          <Field label="Max daily loss" hint="If realized + unrealized P&L hits this threshold, all open strategies pause.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ color: 'var(--text-tertiary)' }}>$</span>
              <input defaultValue="5000" className="adm-input mono" style={{ width: 160 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>·  ~5.9% of equity</span>
            </div>
          </Field>
          <Field label="Max concurrent positions" hint="Limit how many markets you can be live in at once.">
            <input defaultValue="20" className="adm-input mono" style={{ width: 100 }} />
          </Field>
          <Field label="Max daily order count" hint="Throttle to prevent runaway strategies. Includes amends.">
            <input defaultValue="500" className="adm-input mono" style={{ width: 120 }} />
          </Field>
          <Field label="Per-trade slippage cap" hint="Reject orders that would cross more than this fraction of book depth.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue="2.0" className="adm-input mono" style={{ width: 80 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>%</span>
            </div>
          </Field>
        </>}

        {tab === 'risk' && <>
          <Field label="Kill switch" hint="One-click halt: cancels all open orders and pauses all strategies. Requires re-enable.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="adm-btn adm-btn-danger">
                <AdmIcon name="alert-triangle" size={12} />Activate kill switch
              </button>
              <span className="adm-pill is-gain" style={{ fontSize: 9.5 }}>NOT ACTIVE</span>
            </div>
          </Field>
          <Field label="Auto-pause on drawdown" hint="Automatically pause strategies when equity drops by this percentage from the 30-day high.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue="15" className="adm-input mono" style={{ width: 80 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>% drawdown</span>
            </div>
          </Field>
          <Field label="Concentration limit" hint="No single market may exceed this percent of total equity.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue="20" className="adm-input mono" style={{ width: 80 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>% of equity</span>
            </div>
          </Field>
          <Field label="Category exposure cap" hint="Limit gross notional per market category (e.g. politics, crypto).">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue="40" className="adm-input mono" style={{ width: 80 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>% per category</span>
            </div>
          </Field>
          <Field label="Liquidity floor" hint="Reject trades on markets with less than this in 24h volume.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ color: 'var(--text-tertiary)' }}>$</span>
              <input defaultValue="50000" className="adm-input mono" style={{ width: 160 }} />
            </div>
          </Field>
        </>}

        {tab === 'fees' && <>
          <Field label="Current fee tier" hint="Tier is determined by 30-day rolling volume.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="adm-pill is-info" style={{ fontSize: 11, padding: '4px 10px' }}>BUILDER</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>0.18% taker · 0.08% maker</span>
            </div>
          </Field>
          <Field label="30-day volume" hint="Volume contributing toward your next tier.">
            <div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>$1,242,840 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>/ $5,000,000 to Pioneer</span></div>
              <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, marginTop: 6, width: 360, overflow: 'hidden' }}>
                <div style={{ width: '24.8%', height: '100%', background: 'var(--accent-default)' }} />
              </div>
            </div>
          </Field>
          <Field label="Fee credits" hint="Earned from referrals and promotions. Applied automatically to next trades.">
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--gain-text)' }}>$284.40 available</div>
          </Field>
          <Field label="Pay fees in token" hint="Get 25% off all fees by paying in $POLY token. Requires wallet connection.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" /> <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Use $POLY for fee discount</span>
            </div>
          </Field>
        </>}

        {tab === 'auto' && <>
          <Field label="Default order type" hint="When a strategy doesn't specify, use this order type.">
            <select className="adm-input" defaultValue="POST_ONLY" style={{ width: 240 }}>
              <option>POST_ONLY (maker)</option>
              <option>LIMIT</option>
              <option>MARKET</option>
              <option>TWAP</option>
            </select>
          </Field>
          <Field label="Default time-in-force" hint="GTC, IOC, FOK, or session.">
            <select className="adm-input" defaultValue="GTC" style={{ width: 240 }}>
              <option>GTC — Good til cancelled</option>
              <option>IOC — Immediate or cancel</option>
              <option>FOK — Fill or kill</option>
              <option>GTD — Good til date</option>
            </select>
          </Field>
          <Field label="Auto-resolve open positions" hint="Allow markets to resolve automatically without explicit closure.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" defaultChecked /> <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hold to resolution by default</span>
            </div>
          </Field>
          <Field label="Auto-rebalance" hint="Periodically run portfolio optimizer suggestions.">
            <select className="adm-input" defaultValue="never" style={{ width: 240 }}>
              <option value="never">Never</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Confirm before live trades" hint="Show a confirmation modal for every live order. Useful while learning.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" /> <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Require confirmation</span>
            </div>
          </Field>
        </>}
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);