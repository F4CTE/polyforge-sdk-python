/* Polyforge — First-run onboarding wizard
   Standalone (no UsrShell) — full-bleed, focused, distraction-free. */

const STEPS = [
  { id: 'welcome',   label: 'Welcome',     icon: 'sparkle' },
  { id: 'profile',   label: 'Profile',     icon: 'user' },
  { id: 'goals',     label: 'Goals',       icon: 'target' },
  { id: 'venues',    label: 'Venues',      icon: 'plug' },
  { id: 'risk',      label: 'Risk',        icon: 'shield' },
  { id: 'strategy',  label: 'First strategy', icon: 'blocks' },
  { id: 'done',      label: 'Done',        icon: 'check' },
];

function Wiz() {
  const [stepI, setStepI] = React.useState(0);
  const [data, setData] = React.useState({
    name: 'Ada Diallo',
    role: 'individual',
    goal: 'income',
    capital: 5000,
    riskTier: 'balanced',
    venues: { polymarket: true, kalshi: true },
    starter: 'whale-mirror',
    notify: ['email', 'telegram'],
  });
  const setField = (k, v) => setData(d => ({ ...d, [k]: v }));
  const step = STEPS[stepI];
  const canBack = stepI > 0;
  const canNext = stepI < STEPS.length - 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Top brand strip */}
      <header style={{ borderBottom: '1px solid var(--border-subtle)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="App.html" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent-default)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.6"/>
              <path d="m3 7 9 5 9-5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M12 12v10" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Polyforge</span>
        </a>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          <a href="App.html" style={{ color: 'var(--text-secondary)' }}>Skip for now</a>
        </div>
      </header>

      {/* Two-pane */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
        {/* Steps rail */}
        <aside style={{ borderRight: '1px solid var(--border-subtle)', padding: '32px 24px', background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 16 }}>Set up your account</div>
          <div style={{ position: 'relative' }}>
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => setStepI(i)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                color: i === stepI ? 'var(--text-primary)' : i < stepI ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                position: 'relative', textAlign: 'left',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i < stepI ? 'var(--gain)' : i === stepI ? 'var(--accent-default)' : 'var(--bg-app)',
                  color: i <= stepI ? 'white' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  border: i === stepI ? '2px solid color-mix(in srgb, var(--accent-default) 40%, transparent)' : '1px solid var(--border-subtle)',
                  transition: 'background 120ms',
                }}>
                  {i < stepI ? <AdmIcon name="check" size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: i === stepI ? 500 : 400 }}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <span style={{ position: 'absolute', left: 13, top: 36, bottom: -6, width: 1, background: i < stepI ? 'var(--gain)' : 'var(--border-subtle)' }} />
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Step body */}
        <section style={{ padding: '48px 64px', overflow: 'auto', maxWidth: 720, width: '100%', justifySelf: 'center' }}>
          {step.id === 'welcome' && (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, background: 'color-mix(in srgb, var(--accent-default) 10%, transparent)', color: 'var(--accent-text)', fontSize: 11.5, fontWeight: 500, marginBottom: 16 }}>
                <AdmIcon name="sparkle" size={12} />Welcome
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1, margin: 0, marginBottom: 14, letterSpacing: '-0.02em' }}>Let's build your first strategy.</h1>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 520, margin: 0, marginBottom: 32 }}>
                Polyforge turns prediction markets into algorithms you can run, backtest, and audit. Six minutes from here to a paper-trading strategy on real Polymarket and Kalshi data.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 36 }}>
                {[
                  { i: 'flask',    h: 'Backtest first', d: '5 years of order-book history.' },
                  { i: 'shield',   h: 'Paper, then live', d: 'Promote when you trust it.' },
                  { i: 'trending', h: 'Whales included', d: 'Mirror or counter the largest LPs.' },
                ].map((c, i) => (
                  <div key={i} style={{ padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-card)' }}>
                    <AdmIcon name={c.i} size={16} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>{c.h}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{c.d}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step.id === 'profile' && (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: '-0.01em' }}>Tell us about you</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, marginBottom: 32 }}>This shapes the templates and risk tier we suggest.</p>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Display name</label>
                <input className="adm-input" value={data.name} onChange={e => setField('name', e.target.value)} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8 }}>Account type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'individual', l: 'Individual', d: 'Solo trading' },
                    { id: 'team',       l: 'Team',       d: 'Multiple traders' },
                    { id: 'fund',       l: 'Fund / desk', d: 'AUM > $1M' },
                  ].map(o => (
                    <button key={o.id} onClick={() => setField('role', o.id)} style={{
                      padding: 14, border: data.role === o.id ? '1px solid var(--accent-default)' : '1px solid var(--border-default)',
                      borderRadius: 8, background: data.role === o.id ? 'color-mix(in srgb, var(--accent-default) 6%, transparent)' : 'var(--bg-card)',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.l}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{o.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Capital you'll deploy (USD)</label>
                <input className="adm-input" type="number" value={data.capital} onChange={e => setField('capital', e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Used to suggest position sizing. Doesn't move funds yet.</div>
              </div>
            </>
          )}

          {step.id === 'goals' && (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8 }}>What's your goal?</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, marginBottom: 32 }}>Pick the one that fits best — we'll optimize templates for it.</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { id: 'income',   l: 'Steady income',     d: 'Capture mispricings and edge with low drawdown. Sharpe > 1.5.', icon: 'dollar' },
                  { id: 'event',    l: 'Event alpha',       d: 'Trade specific events: Fed, CPI, elections, earnings.',          icon: 'calendar' },
                  { id: 'arb',      l: 'Cross-venue arb',   d: 'Capture price gaps between Polymarket and Kalshi.',              icon: 'refresh' },
                  { id: 'mirror',   l: 'Whale mirroring',   d: 'Tail high-confidence smart money positions.',                    icon: 'trending' },
                  { id: 'explore',  l: 'Just exploring',    d: 'Paper trade and learn the platform.',                            icon: 'flask' },
                ].map(o => (
                  <button key={o.id} onClick={() => setField('goal', o.id)} style={{
                    padding: 16, border: data.goal === o.id ? '1px solid var(--accent-default)' : '1px solid var(--border-default)',
                    borderRadius: 8, background: data.goal === o.id ? 'color-mix(in srgb, var(--accent-default) 6%, transparent)' : 'var(--bg-card)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: data.goal === o.id ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
                      <AdmIcon name={o.icon} size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{o.l}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{o.d}</div>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: data.goal === o.id ? '5px solid var(--accent-default)' : '1px solid var(--border-default)',
                      transition: 'border 120ms',
                    }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {step.id === 'venues' && (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8 }}>Connect venues</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, marginBottom: 32 }}>You can change this later. Paper trading works without any connection.</p>
              {[
                { id: 'polymarket', l: 'Polymarket', d: 'USDC settlement on Polygon. Crypto markets.', color: '#4F6EF7', icon: 'P' },
                { id: 'kalshi',     l: 'Kalshi',     d: 'CFTC-regulated USD markets. ACH funding.',     color: '#16A34A', icon: 'K' },
              ].map(v => (
                <div key={v.id} style={{
                  padding: 18, marginBottom: 12, border: data.venues[v.id] ? '1px solid color-mix(in srgb, var(--accent-default) 35%, transparent)' : '1px solid var(--border-default)',
                  borderRadius: 8, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: v.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18 }}>{v.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{v.l}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{v.d}</div>
                  </div>
                  <button onClick={() => setField('venues', { ...data.venues, [v.id]: !data.venues[v.id] })}
                    className={`adm-btn ${data.venues[v.id] ? 'adm-btn-ghost' : 'adm-btn-secondary'}`}>
                    {data.venues[v.id] ? <><AdmIcon name="check" size={12} />Connected</> : 'Connect'}
                  </button>
                </div>
              ))}
              <div style={{ padding: 14, marginTop: 12, borderRadius: 6, background: 'color-mix(in srgb, var(--accent-default) 5%, transparent)', fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AdmIcon name="info" size={13} /><span>Polyforge never holds your funds. We connect read/write APIs only — settlement happens on the venue.</span>
              </div>
            </>
          )}

          {step.id === 'risk' && (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8 }}>Set your risk tier</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, marginBottom: 32 }}>Hard caps applied across all your live strategies. Override per-strategy later.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { id: 'cautious',  l: 'Cautious',  pos: '10%', dd: '−3%',  bud: '$500/d',  color: 'var(--gain)' },
                  { id: 'balanced',  l: 'Balanced',  pos: '25%', dd: '−6%',  bud: '$2,000/d', color: 'var(--accent-default)' },
                  { id: 'aggressive',l: 'Aggressive',pos: '40%', dd: '−12%', bud: '$5,000/d', color: 'var(--warn)' },
                ].map(o => (
                  <button key={o.id} onClick={() => setField('riskTier', o.id)} style={{
                    padding: 18, border: data.riskTier === o.id ? `1px solid ${o.color}` : '1px solid var(--border-default)',
                    borderRadius: 8, background: data.riskTier === o.id ? `color-mix(in srgb, ${o.color} 8%, var(--bg-card))` : 'var(--bg-card)',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{o.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace', lineHeight: 1.7 }}>
                      max pos {o.pos}<br/>kill {o.dd}<br/>budget {o.bud}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ padding: 14, borderRadius: 6, background: 'color-mix(in srgb, var(--warn) 6%, transparent)', borderLeft: '3px solid var(--warn)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--warn-text)' }}>Note:</strong> Live trading also requires hardware-key 2FA before promoting any strategy.
              </div>
            </>
          )}

          {step.id === 'strategy' && (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8 }}>Pick a starter strategy</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, marginBottom: 32 }}>Cloned to your workspace as paper-mode. Edit anytime in the Builder.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { id: 'whale-mirror', l: 'Whale mirror · politics', d: 'Tail top-decile traders on election markets. Sharpe 1.84 (1y bt).', tag: 'recommended' },
                  { id: 'cpi-fade',     l: 'CPI cool fade',           d: 'Sell expectations of soft prints, buy hot prints. Sharpe 1.62.', tag: 'event' },
                  { id: 'arb-pm-k',     l: 'Polymarket ↔ Kalshi arb', d: 'Cross-venue spread > 3¢ triggers ladder fills. Sharpe 2.14.',     tag: 'low-risk' },
                  { id: 'imbalance',    l: 'Order-book imbalance',     d: 'Take liquidity when book skews > 70/30. Sharpe 1.41.',           tag: 'fast' },
                  { id: 'blank',        l: 'Blank canvas',             d: 'Start from scratch in the visual builder.',                       tag: '—' },
                ].map(s => (
                  <button key={s.id} onClick={() => setField('starter', s.id)} style={{
                    padding: 16, border: data.starter === s.id ? '1px solid var(--accent-default)' : '1px solid var(--border-default)',
                    borderRadius: 8, background: data.starter === s.id ? 'color-mix(in srgb, var(--accent-default) 6%, transparent)' : 'var(--bg-card)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{s.l}</span>
                        {s.tag !== '—' && <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-app)', color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>{s.tag}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{s.d}</div>
                    </div>
                    {data.starter === s.id && <AdmIcon name="check" size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step.id === 'done' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gain)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <AdmIcon name="check" size={24} />
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 600, margin: 0, marginBottom: 12, letterSpacing: '-0.01em' }}>You're set up.</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, marginBottom: 28, maxWidth: 460, lineHeight: 1.55 }}>
                Your starter strategy is cloned and running on paper data. Watch it for 24 hours, then promote when you're ready.
              </p>
              <div className="adm-card" style={{ padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Account</span><span>{data.name} · {data.role}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Goal</span><span style={{ textTransform: 'capitalize' }}>{data.goal}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Capital</span><span style={{ fontFamily: 'Geist Mono, monospace' }}>${Number(data.capital).toLocaleString()}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Risk tier</span><span style={{ textTransform: 'capitalize' }}>{data.riskTier}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Venues</span><span>{Object.entries(data.venues).filter(([_,v])=>v).map(([k])=>k).join(', ') || '— paper only'}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Strategy</span><span>{data.starter}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="App.html" className="adm-btn adm-btn-primary">Go to mission control →</a>
                <a href="App-Builder.html" className="adm-btn adm-btn-secondary">Open in Builder</a>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Sticky footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
        <button className="adm-btn adm-btn-ghost" disabled={!canBack} onClick={() => setStepI(s => s - 1)} style={{ opacity: canBack ? 1 : 0.4 }}>
          <AdmIcon name="chevron-left" size={12} />Back
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Step {stepI + 1} of {STEPS.length}
        </div>
        {canNext ? (
          <button className="adm-btn adm-btn-primary" onClick={() => setStepI(s => s + 1)}>
            {stepI === STEPS.length - 2 ? 'Finish' : 'Continue'}<AdmIcon name="chevron-right" size={12} />
          </button>
        ) : (
          <a href="App.html" className="adm-btn adm-btn-primary">Open dashboard →</a>
        )}
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Wiz />);
