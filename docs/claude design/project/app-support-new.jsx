/* Polyforge — Support · New ticket
   File a new support ticket. Form-driven; smart-suggests guide articles as user types. */

const SUP_CATEGORIES = [
  { id: 'trading',    label: 'Trading & orders',     desc: 'Fills, cancels, partial executions, slippage' },
  { id: 'strategy',   label: 'Strategies & blocks',  desc: 'Builder, backtest, live deployment, mirror' },
  { id: 'wallet',     label: 'Wallet & funding',     desc: 'Deposits, withdrawals, transaction status' },
  { id: 'account',    label: 'Account & access',     desc: 'Login, 2FA, KYC, team membership' },
  { id: 'api',        label: 'API & integrations',   desc: 'API keys, rate limits, SDK errors' },
  { id: 'billing',    label: 'Billing & invoices',   desc: 'Plan changes, payment methods, taxes' },
  { id: 'other',      label: 'Something else',       desc: 'Bug reports, feature requests, feedback' },
];

const SUP_SUGGESTIONS = [
  { keyword: 'api',      title: 'Rotating API keys safely',        href: 'Guide.html', section: 'Security' },
  { keyword: 'api',      title: 'API rate limits explained',        href: 'Docs-API.html', section: 'API Reference' },
  { keyword: '2fa',      title: 'Setting up & recovering 2FA',      href: 'Guide.html', section: 'Security' },
  { keyword: 'withdraw', title: 'Withdrawal holds & approvals',     href: 'Guide.html', section: 'Account & Billing' },
  { keyword: 'backtest', title: 'Reading backtest reports',         href: 'Guide.html', section: 'Backtest' },
  { keyword: 'whale',    title: 'How whale-mirror blocks work',     href: 'Guide.html', section: 'Whales' },
  { keyword: 'fed',      title: 'Resolution windows for FED markets', href: 'Guide.html', section: 'Markets' },
];

function App() {
  const [category, setCategory] = React.useState('');
  const [subject,  setSubject]  = React.useState('');
  const [body,     setBody]     = React.useState('');
  const [priority, setPriority] = React.useState('medium');

  const text = (subject + ' ' + body).toLowerCase();
  const suggestions = SUP_SUGGESTIONS.filter(s => text.includes(s.keyword)).slice(0, 3);

  return (
    <UsrShell active="support" title="New ticket" crumbs={[
      { label: 'Support', href: 'App-Support.html' },
      { label: 'New ticket' },
    ]}>
      <AdmPageHead
        title="File a support ticket"
        sub="Most questions are answered in the user guide. If you still need help, we'll respond within 4 hours · 24/5."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Form */}
        <div className="adm-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {SUP_CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    type="button"
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: category === c.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                      border: `1px solid ${category === c.id ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{c.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>Subject</label>
              <input
                className="adm-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="One-line summary of the issue"
                style={{ width: '100%', padding: '8px 12px' }}
              />
            </div>

            {/* Body */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>Description</label>
              <textarea
                className="adm-input"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                placeholder="What were you trying to do? What did you expect? What actually happened? Include any error messages or ticker IDs."
                style={{ width: '100%', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Markdown supported · attach screenshots below</span>
                <span className="mono">{body.length} chars</span>
              </div>
            </div>

            {/* Attach */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>Attachments</label>
              <div style={{
                border: '1px dashed var(--border-default)',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                background: 'var(--bg-elevated)',
              }}>
                <AdmIcon name="upload" size={16} />
                <div style={{ marginTop: 6 }}>Drop screenshots, logs, or HAR files here · max 25MB each</div>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>Priority</label>
              <div className="adm-filter-group">
                {[
                  { id: 'low',    label: 'Low',    desc: 'No rush' },
                  { id: 'medium', label: 'Medium', desc: 'Affects work' },
                  { id: 'high',   label: 'High',   desc: 'Blocking trades' },
                  { id: 'urgent', label: 'Urgent', desc: 'Money at risk' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPriority(p.id)}
                    type="button"
                    className={`adm-filter ${priority === p.id ? 'is-active' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Urgent tickets pull a human within 30 minutes during coverage hours.
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <button className="adm-btn adm-btn-primary" disabled={!category || !subject || !body}>
                Submit ticket
              </button>
              <button className="adm-btn">Save as draft</button>
              <a href="App-Support.html" className="adm-btn" style={{ marginLeft: 'auto' }}>Cancel</a>
            </div>
          </div>
        </div>

        {/* Sidebar — guide suggestions + context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {suggestions.length > 0 && (
            <div className="adm-card" style={{ padding: 16, background: 'linear-gradient(180deg, var(--accent-subtle) 0%, var(--bg-surface) 80%)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Might already be answered</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((s, i) => (
                  <a key={i} href={s.href} style={{ textDecoration: 'none', color: 'inherit', padding: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'block' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{s.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.section} · Guide</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>What we'll see</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              We auto-attach your account ID, plan tier, recent device, and the last 50 lines of your client-side log so you don't have to copy-paste anything.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              We <strong style={{ color: 'var(--text-primary)' }}>do not</strong> see API keys, withdrawal addresses, or 2FA secrets — those are scrubbed before transmission.
            </div>
          </div>

          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Response targets</div>
            <table style={{ width: '100%', fontSize: 11.5 }}>
              <tbody>
                {[
                  { p: 'Urgent', t: '30 min' },
                  { p: 'High',   t: '4 hours' },
                  { p: 'Medium', t: '12 hours' },
                  { p: 'Low',    t: '2 days' },
                ].map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>{r.p}</td>
                    <td className="mono" style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }}>{r.t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);