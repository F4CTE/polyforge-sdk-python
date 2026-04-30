/* Polyforge — Admin Scheduled reports
   Recurring data drops to stakeholders, regulators, partners */

const REPORTS = [
  { id: 'rep_4f1', name: 'Daily exec digest',          owner: 'priya.io',   recipients: 8,  cadence: 'Daily · 09:00 UTC', kind: 'pdf+csv', size: '2.4 MB',  state: 'on',  next: 'in 4h 22m', last: 'today 09:00',    rows: '184 metrics' },
  { id: 'rep_4f2', name: 'Risk · daily VaR',           owner: 'oliver.cho', recipients: 12, cadence: 'Daily · 23:55 UTC', kind: 'pdf',     size: '1.2 MB',  state: 'on',  next: 'in 9h 33m', last: 'yesterday 23:55',rows: '1y · 11 mkts' },
  { id: 'rep_4f3', name: 'Marketplace earnings',       owner: 'maria.f',    recipients: 4,  cadence: 'Weekly · Mon 06:00',kind: 'csv',     size: '0.4 MB',  state: 'on',  next: 'in 2d 14h', last: '6d ago',         rows: '142 listings' },
  { id: 'rep_4f4', name: 'Compliance · SAR pack',      owner: 'compliance', recipients: 2,  cadence: 'Monthly · 1st',     kind: 'pdf+evidence',size:'18 MB',state: 'on',  next: 'in 7d',     last: '24d ago',        rows: '8 cases' },
  { id: 'rep_4f5', name: 'KYC backlog snapshot',       owner: 'maria.f',    recipients: 3,  cadence: 'Daily · 08:00 UTC', kind: 'csv',     size: '0.1 MB',  state: 'on',  next: 'in 3h 22m', last: 'today 08:00',    rows: '38 pending' },
  { id: 'rep_4f6', name: 'Investor metrics deck',      owner: 'priya.io',   recipients: 6,  cadence: 'Monthly · 5th',     kind: 'pdf',     size: '4.2 MB',  state: 'on',  next: 'in 11d',    last: '19d ago',        rows: '14 charts' },
  { id: 'rep_4f7', name: 'On-call digest',             owner: 'sre',        recipients: 8,  cadence: 'Weekly · Fri 17:00',kind: 'pdf',     size: '1.8 MB',  state: 'on',  next: 'in 1d 2h',  last: '6d ago',         rows: '38 incidents' },
  { id: 'rep_4f8', name: 'Q4 partner volume · Polymarket',  owner: 'partners',   recipients: 2,  cadence: 'Quarterly · last',  kind: 'pdf+csv', size: '2.4 MB',  state: 'paused',next:'paused',     last: '94d ago',        rows: '38d data' },
  { id: 'rep_4f9', name: 'Strategy abuse · weekly',    owner: 'oliver.cho', recipients: 4,  cadence: 'Weekly · Sun 22:00',kind: 'pdf',     size: '0.8 MB',  state: 'on',  next: 'in 4d 8h',  last: '3d ago',         rows: '12 flagged' },
  { id: 'rep_4fa', name: 'Sentiment model card',       owner: 'arianne.dev',recipients: 6,  cadence: 'Monthly · 1st',     kind: 'pdf',     size: '1.2 MB',  state: 'on',  next: 'in 7d',     last: '24d ago',        rows: 'v3.2 metrics' },
];

function App() {
  return (
    <AdmShell active="reports" title="Scheduled reports" crumbs={[{ label: 'Overview' }]}>
      <AdmPageHead
        title="Scheduled reports"
        sub={<>{REPORTS.length} report templates · 9 active · 142 deliveries past 30 days · drops to email + S3 + secure portal</>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="play" size={12} />Run now</button>
          <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New report</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Active reports" value="9 / 10" delta="1 paused" icon="newspaper" iconKind="is-info" />
        <AdmStat label="Deliveries · 30d" value="142" delta="+8 this week" deltaKind="gain" icon="check" iconKind="is-gain" />
        <AdmStat label="Avg gen time" value="38s" delta="p99 4m 22s · SAR pack" icon="clock" iconKind="is-info" />
        <AdmStat label="Failures · 30d" value="3" delta="all retried successfully" deltaKind="gain" icon="circle-x" iconKind="is-warn" />
      </div>

      <div className="adm-grid-2" style={{gridTemplateColumns:'1fr 1.2fr',marginBottom:20}}>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="clock" size={14} /></div>
            <h3 className="adm-card-title">Next 24 hours</h3>
          </div>
          {REPORTS.filter(r => r.next.startsWith('in ') && (r.next.includes('h') && !r.next.includes('d'))).map(r => (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:'1px solid var(--border-subtle)'}}>
              <div style={{width:36,textAlign:'center'}}>
                <div style={{fontFamily:'Geist Mono, monospace',fontSize:10,color:'var(--text-tertiary)'}}>in</div>
                <div style={{fontFamily:'Geist Mono, monospace',fontSize:13,color:'var(--accent-text)',fontWeight:600}}>{r.next.replace('in ','').split(' ')[0]}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5,fontWeight:500,color:'var(--text-primary)'}}>{r.name}</div>
                <div style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{r.recipients} recipients · {r.kind}</div>
              </div>
              <button className="adm-icon-btn"><AdmIcon name="play" size={13} /></button>
            </div>
          ))}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="adm-card-icon"><AdmIcon name="check" size={14} /></div>
            <h3 className="adm-card-title">Recent deliveries</h3>
          </div>
          <table className="adm-mini-table">
            <thead><tr><th>Report</th><th>Recipients</th><th className="col-num">Size</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              <tr><td>Daily exec digest</td><td>8</td><td className="col-num">2.4 MB</td><td><AdmPill kind="gain">delivered</AdmPill></td><td className="col-tertiary">5h ago</td></tr>
              <tr><td>KYC backlog snapshot</td><td>3</td><td className="col-num">0.1 MB</td><td><AdmPill kind="gain">delivered</AdmPill></td><td className="col-tertiary">6h ago</td></tr>
              <tr><td>Risk · daily VaR</td><td>12</td><td className="col-num">1.2 MB</td><td><AdmPill kind="gain">delivered</AdmPill></td><td className="col-tertiary">14h ago</td></tr>
              <tr><td>Strategy abuse · weekly</td><td>4</td><td className="col-num">0.8 MB</td><td><AdmPill kind="gain">delivered</AdmPill></td><td className="col-tertiary">3d ago</td></tr>
              <tr><td>On-call digest</td><td>8</td><td className="col-num">1.8 MB</td><td><AdmPill kind="warn">retried</AdmPill></td><td className="col-tertiary">6d ago</td></tr>
              <tr><td>Marketplace earnings</td><td>4</td><td className="col-num">0.4 MB</td><td><AdmPill kind="gain">delivered</AdmPill></td><td className="col-tertiary">6d ago</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <AdmSectionHead title="All reports" />
      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <AdmFilter active count={REPORTS.length}>All</AdmFilter>
          <AdmFilter count={9}>Active</AdmFilter>
          <AdmFilter count={1}>Paused</AdmFilter>
          <AdmFilter count={3}>Compliance</AdmFilter>
          <AdmFilter count={4}>Daily</AdmFilter>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Report</th>
              <th>State</th>
              <th>Cadence</th>
              <th>Owner</th>
              <th>Format</th>
              <th className="col-num">Recipients</th>
              <th>Last delivered</th>
              <th>Next run</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {REPORTS.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{fontWeight:500}}>{r.name}</div>
                  <div className="mono" style={{fontSize:10.5,color:'var(--text-tertiary)',marginTop:2}}>{r.id} · {r.rows} · {r.size}</div>
                </td>
                <td>{r.state === 'on' ? <AdmPill kind="gain"><span className="adm-dot is-gain" />on</AdmPill> : <AdmPill kind="warn">paused</AdmPill>}</td>
                <td className="col-secondary" style={{fontSize:11.5}}>{r.cadence}</td>
                <td><a href="Admin-Admins.html" className="mono" style={{fontSize:11,color:'var(--accent-text)',textDecoration:'none'}}>{r.owner}</a></td>
                <td className="mono col-secondary" style={{fontSize:11}}>{r.kind}</td>
                <td className="col-num">{r.recipients}</td>
                <td className="col-tertiary" style={{fontSize:11}}>{r.last}</td>
                <td className="col-secondary" style={{fontSize:11.5,fontFamily:'Geist Mono, monospace'}}>{r.next}</td>
                <td className="col-actions">
                  <div style={{display:'flex',gap:4}}>
                    <button className="adm-icon-btn" title="Run now"><AdmIcon name="play" size={14} /></button>
                    <button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
