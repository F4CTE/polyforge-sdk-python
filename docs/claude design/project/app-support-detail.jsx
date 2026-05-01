/* Polyforge — Support · Detail
   Single ticket conversation thread, user-facing. */

const TKT = {
  id: 'TCK-2148',
  subject: 'API key 502 errors during peak resolution windows',
  status: 'in-progress',
  priority: 'high',
  category: 'API & integrations',
  filed: '2 days ago · Apr 28, 14:24 UTC',
  updated: '12m ago',
  assignee: { name: 'Maya P.', initials: 'MP', team: 'API Support' },
};

const TKT_THREAD = [
  { who: 'You', initials: 'UF', when: '2 days ago · 14:24 UTC', side: 'user', body:
    "Getting intermittent 502s on /v1/orders during the FOMC resolution window — peak ~1500 UTC. About 1 in 8 requests. Retries succeed but it's wrecking our automation. Can you verify if this is a known capacity issue or something on our end?" },
  { who: 'Polyforge Support', initials: 'PS', when: '2 days ago · 14:51 UTC', side: 'staff', staff: true, body:
    "Hi — thanks for the report. Pulled your gateway logs around the timestamps you mentioned. Confirming we did see elevated 502s during the 1430–1530 UTC window for ~6 customers. Already escalated to infra. We'll have a fix in the next deploy (~24h). I'll keep this thread updated." },
  { who: 'You', initials: 'UF', when: '1 day ago · 09:12 UTC', side: 'user', body:
    "Thanks. Any way to get a webhook or status-page note for capacity events going forward? We can pre-throttle if we know in advance." },
  { who: 'Maya P. · API Support', initials: 'MP', when: '1 day ago · 11:28 UTC', side: 'staff', staff: true, body:
    "Good idea. We just shipped a `capacity` event on the status webhook (status.polyforge.app/webhook). Subscribe and you'll get an `INCREASED_LOAD` ping 5–10 minutes before peak windows. Docs: status.polyforge.app/api. \n\nOn the original 502s — fix went out 03:14 UTC. We capacity-tested with synthetic FOMC traffic and it held. Can you confirm on your end during the next high-vol window?" },
  { who: 'You', initials: 'UF', when: '12m ago', side: 'user', body:
    "Hit a CPI release this morning — 0 errors out of 412 requests. Looking good so far. I'll wait until the next FOMC to fully close this out but happy with the progress." },
];

const SUP_STATUS = { 'in-progress': { label: 'In progress', kind: 'is-warn' } };
const SUP_PRIORITY = { high: { label: 'High', kind: 'is-loss' } };

function App() {
  const [reply, setReply] = React.useState('');
  const status = SUP_STATUS[TKT.status] || { label: TKT.status, kind: '' };
  const priority = SUP_PRIORITY[TKT.priority] || { label: TKT.priority, kind: '' };

  return (
    <UsrShell active="support" title={TKT.id} crumbs={[
      { label: 'Support', href: 'App-Support.html' },
      { label: TKT.id },
    ]}>
      {/* Header */}
      <div className="adm-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{TKT.id}</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.013em' }}>{TKT.subject}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className={`adm-pill ${status.kind}`} style={{ fontSize: 10 }}>{status.label}</span>
              <span className={`adm-pill ${priority.kind}`} style={{ fontSize: 10 }}>{priority.label}</span>
              <span className="adm-pill" style={{ fontSize: 10 }}>{TKT.category}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· Filed {TKT.filed}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Assigned to</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{TKT.assignee.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{TKT.assignee.team}</div>
            </div>
            <div className="usr-whale-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{TKT.assignee.initials}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Thread */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {TKT_THREAD.map((m, i) => (
              <div key={i} className="adm-card" style={{ padding: 16, borderLeft: m.staff ? '2px solid var(--accent-default)' : '2px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="usr-whale-avatar" style={{ width: 28, height: 28, fontSize: 11, background: m.staff ? 'var(--accent-subtle)' : undefined, color: m.staff ? 'var(--accent-text)' : undefined }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{m.who}{m.staff && <span className="adm-pill" style={{ marginLeft: 8, fontSize: 9 }}>STAFF</span>}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{m.when}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              </div>
            ))}
          </div>

          {/* Reply */}
          <div className="adm-card" style={{ padding: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>Reply</label>
            <textarea
              className="adm-input"
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={5}
              placeholder="Type your reply…"
              style={{ width: '100%', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button className="adm-btn adm-btn-primary" disabled={!reply}>Send reply</button>
              <button className="adm-btn">Attach file</button>
              <button className="adm-btn" style={{ marginLeft: 'auto' }}>Mark as resolved</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Properties</div>
            <table style={{ width: '100%', fontSize: 11.5 }}>
              <tbody>
                {[
                  ['Status',   <span className={`adm-pill ${status.kind}`} style={{ fontSize: 10 }}>{status.label}</span>],
                  ['Priority', <span className={`adm-pill ${priority.kind}`} style={{ fontSize: 10 }}>{priority.label}</span>],
                  ['Category', TKT.category],
                  ['Filed',    TKT.filed.split('·')[0].trim()],
                  ['Updated',  TKT.updated],
                  ['Replies',  TKT_THREAD.length],
                ].map(([k, v], i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 0', color: 'var(--text-tertiary)', width: '45%' }}>{k}</td>
                    <td style={{ padding: '6px 0', color: 'var(--text-primary)', textAlign: 'right' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Related</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="Docs-API.html" style={{ fontSize: 11.5, color: 'var(--accent-text)', textDecoration: 'none' }}>API rate limits explained →</a>
              <a href="#" style={{ fontSize: 11.5, color: 'var(--accent-text)', textDecoration: 'none' }}>Status webhook setup →</a>
              <a href="Status.html" style={{ fontSize: 11.5, color: 'var(--accent-text)', textDecoration: 'none' }}>Live system status →</a>
            </div>
          </div>

          <div className="adm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="adm-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>Escalate priority</button>
              <button className="adm-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>Request callback</button>
              <button className="adm-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>Download thread</button>
            </div>
          </div>
        </div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);