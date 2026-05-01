/* Polyforge — New copy config wizard
   Single-page form: target → mode → size → risk caps → review. */

const CS_TARGET = {
  user: 'unholyfist.eth',
  display: 'Unholy Fist',
  avatar: 'UF',
  address: '0x7f4a3b9e21cd5f8a4ea8ddf48b62ee9921c9fc93b',
  rank: 1, edge: 92, pnl: '+$48,210', winRate: 78, trades: 142, copiers: 1284,
  fee: 8, sharpe: 2.4, mdd: '-12.4%', avgSize: '$24,800',
  spark: [40, 46, 50, 54, 58, 62, 66, 70, 72, 76, 80, 84, 86, 90, 94, 96, 100],
};

function CsSparkline({ data, w = 220, h = 56 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={area} fill="color-mix(in srgb, var(--gain) 12%, transparent)" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--gain)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CsSection({ num, title, subtitle, children }) {
  return (
    <div className="adm-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 99,
          background: 'var(--accent-subtle)', color: 'var(--accent-text)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: 'Geist Mono, monospace',
        }}>{num}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CsModeOption({ mode, label, desc, example, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(mode)}
      className="adm-card"
      style={{
        padding: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
        background: active ? 'var(--accent-subtle)' : 'var(--bg-surface)',
        borderColor: active ? 'var(--accent-border)' : undefined,
        font: 'inherit', color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 16, height: 16, borderRadius: 99, border: '1.5px solid',
          borderColor: active ? 'var(--accent-default)' : 'var(--border-default)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {active && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent-default)' }} />}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 8px', background: 'var(--bg-canvas)', borderRadius: 6, marginTop: 'auto' }}>
        {example}
      </div>
    </button>
  );
}

function App() {
  const [mode, setMode] = React.useState('PERCENTAGE');
  const [pct, setPct] = React.useState(5);
  const [fixed, setFixed] = React.useState(200);
  const [maxExposure, setMaxExposure] = React.useState(5000);
  const [maxDailyLoss, setMaxDailyLoss] = React.useState(250);
  const [maxLoss, setMaxLoss] = React.useState(800);
  const [stopOnDrawdown, setStopOnDrawdown] = React.useState(true);
  const [excludeSports, setExcludeSports] = React.useState(false);
  const [name, setName] = React.useState(`Copy ${CS_TARGET.user.split('.')[0]}`);

  const sizeLabel =
    mode === 'PERCENTAGE' ? `${pct}% of trade` :
    mode === 'FIXED'      ? `$${fixed} fixed` :
                            'Mirror 1:1';

  return (
    <UsrShell active="copy-setup" title="New copy config" crumbs={[{label: 'Copy trading', href: 'App-Copy.html'}, {label: 'New'}]} actions={
      <>
        <a href="App-Copy.html" className="adm-btn adm-btn-secondary"><AdmIcon name="x" size={12} />Cancel</a>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="check" size={12} />Activate copy</button>
      </>
    }>
      <AdmPageHead
        title={`Copy @${CS_TARGET.user}`}
        sub="Configure how their trades get mirrored into your account · risk caps stop the engine if breached"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 20, alignItems: 'flex-start' }}>
        {/* Form column */}
        <div>
          {/* 1. Target trader (read-only summary) */}
          <CsSection num="1" title="Trader you'll copy" subtitle="Click change to pick a different trader.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div className="usr-whale-avatar" style={{ width: 44, height: 44, fontSize: 14 }}>{CS_TARGET.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{CS_TARGET.display}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>@{CS_TARGET.user} · {CS_TARGET.address.slice(0, 10)}…{CS_TARGET.address.slice(-4)}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                <span><span style={{ color: 'var(--text-tertiary)' }}>Edge </span><span className="mono" style={{ color: 'var(--gain-text)', fontWeight: 600 }}>{CS_TARGET.edge}</span></span>
                <span><span style={{ color: 'var(--text-tertiary)' }}>Win </span><span className="mono">{CS_TARGET.winRate}%</span></span>
                <span><span style={{ color: 'var(--text-tertiary)' }}>Sharpe </span><span className="mono">{CS_TARGET.sharpe}</span></span>
              </div>
              <a href="App-Copy-Discover.html" className="adm-btn adm-btn-sm adm-btn-secondary">Change</a>
            </div>
          </CsSection>

          {/* 2. Copy mode */}
          <CsSection num="2" title="Copy mode" subtitle="How much of each of their trades to mirror into your account.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <CsModeOption
                mode="PERCENTAGE" label="Percentage" active={mode === 'PERCENTAGE'} onSelect={setMode}
                desc="Mirror their position size as a percentage of their bankroll."
                example={`They bet $24,800 → you bet $${(24800 * pct / 100).toFixed(0)}`}
              />
              <CsModeOption
                mode="FIXED" label="Fixed" active={mode === 'FIXED'} onSelect={setMode}
                desc="Always trade the same dollar amount, regardless of their size."
                example={`They bet anything → you bet $${fixed}`}
              />
              <CsModeOption
                mode="MIRROR" label="Mirror 1:1" active={mode === 'MIRROR'} onSelect={setMode}
                desc="Match their exact trade size. Only for high-bankroll copy."
                example="They bet $24,800 → you bet $24,800"
              />
            </div>

            {mode === 'PERCENTAGE' && (
              <div style={{ padding: 14, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Percentage of their trade size</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: 'var(--accent-text)' }}>{pct}%</span>
                </div>
                <input type="range" min={1} max={50} value={pct} onChange={e => setPct(Number(e.target.value))}
                  className="usr-range" style={{ '--val': (pct - 1) / 49 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>
                  <span>1%</span><span>10%</span><span>25%</span><span>50%</span>
                </div>
              </div>
            )}

            {mode === 'FIXED' && (
              <div style={{ padding: 14, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Fixed amount per copied trade</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>$</span>
                  <input
                    type="number" value={fixed} onChange={e => setFixed(Number(e.target.value))} min={10} step={10}
                    className="adm-input" style={{ width: 160, fontFamily: 'Geist Mono, monospace' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>per trade</span>
                </div>
              </div>
            )}

            {mode === 'MIRROR' && (
              <div style={{ padding: 14, background: 'var(--warning-subtle, color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent))', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AdmIcon name="alert-triangle" size={14} className="" />
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Mirror mode requires a bankroll at least as large as theirs. Their average trade is <span className="mono" style={{ color: 'var(--text-primary)' }}>{CS_TARGET.avgSize}</span> — make sure you have enough USDC to cover concurrent positions.
                </div>
              </div>
            )}
          </CsSection>

          {/* 3. Risk caps */}
          <CsSection num="3" title="Risk caps" subtitle="Hard limits the engine enforces before every fill. Hitting any cap auto-pauses the config.">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Max open exposure</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>$</span>
                    <input type="number" value={maxExposure} onChange={e => setMaxExposure(Number(e.target.value))} step={500} className="adm-input" style={{ flex: 1, fontFamily: 'Geist Mono, monospace' }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Engine won't open new positions past this.</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Max daily loss</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>$</span>
                    <input type="number" value={maxDailyLoss} onChange={e => setMaxDailyLoss(Number(e.target.value))} step={50} className="adm-input" style={{ flex: 1, fontFamily: 'Geist Mono, monospace' }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Auto-pauses for 24h if hit.</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Max total loss (lifetime)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>$</span>
                    <input type="number" value={maxLoss} onChange={e => setMaxLoss(Number(e.target.value))} step={100} className="adm-input" style={{ flex: 1, fontFamily: 'Geist Mono, monospace' }} placeholder="No limit" />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Engine stops permanently if hit.</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Slippage tolerance</label>
                  <select className="adm-select" defaultValue="2" style={{ width: '100%' }}>
                    <option value="1">±1¢ (strict)</option>
                    <option value="2">±2¢ (recommended)</option>
                    <option value="5">±5¢ (loose)</option>
                    <option value="ignore">Ignore</option>
                  </select>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Skip if market moved past this.</div>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={stopOnDrawdown} onChange={e => setStopOnDrawdown(e.target.checked)} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>Auto-stop on 3 consecutive losses</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Pause until you review</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={excludeSports} onChange={e => setExcludeSports(e.target.checked)} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>Exclude sports markets</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Only copy non-sports trades</span>
                </label>
              </div>
            </div>
          </CsSection>

          {/* 4. Name */}
          <CsSection num="4" title="Name this config" subtitle="Shows up in your copy list and notifications.">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="adm-input" style={{ width: '100%' }}
              placeholder={`Copy ${CS_TARGET.user.split('.')[0]}`}
            />
          </CsSection>
        </div>

        {/* Sticky review panel */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>30d edge curve</div>
              <CsSparkline data={CS_TARGET.spark} w={310} h={64} />
              <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Their P&L</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gain-text)' }}>{CS_TARGET.pnl}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Win rate</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{CS_TARGET.winRate}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Copiers</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{CS_TARGET.copiers.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Review</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Mode</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{sizeLabel}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Max exposure</span><span className="mono" style={{ color: 'var(--text-primary)' }}>${maxExposure.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Max daily loss</span><span className="mono" style={{ color: 'var(--text-primary)' }}>${maxDailyLoss}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Max total loss</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{maxLoss ? `$${maxLoss}` : 'No limit'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-tertiary)' }}>Copy fee</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{CS_TARGET.fee}% of profit</span></div>
              </div>
              <button className="adm-btn adm-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
                <AdmIcon name="check" size={12} />Activate copy
              </button>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
                You can pause or stop anytime. Open positions stay open until they close on their side.
              </div>
            </div>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);