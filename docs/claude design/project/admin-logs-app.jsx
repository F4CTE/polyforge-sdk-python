/* Polyforge — Admin Audit Log
   Searchable, filterable trail of every admin + system action */

const LOGS = [
  { t: '14:24:08.124', actor: 'system',         actorKind: 'system', action: 'order.fill',          target: 'TX-92177',   ip: '—',             severity: 'info',   detail: 'FED-MAR-CUT · YES 1,420 sh @ 0.34¢ · usr_71c2' },
  { t: '14:24:02.418', actor: 'oliver.cho',     actorKind: 'admin',  action: 'user.suspend',        target: 'usr_4a91',   ip: '10.4.2.18',     severity: 'warn',   detail: 'manual review · self-cross pattern across 7 markets' },
  { t: '14:23:48.612', actor: 'system',         actorKind: 'system', action: 'risk.flag.raise',     target: 'usr_4a91',   ip: '—',             severity: 'high',   detail: 'pattern · self_cross · confidence 0.94 · 32 self-fills/4m' },
  { t: '14:23:14.882', actor: 'arianne.dev',    actorKind: 'user',   action: 'block.publish',       target: 'blk_94f1',   ip: '88.214.18.42',  severity: 'info',   detail: 'senate-2026-margin v2 listed at 15% pnl fee' },
  { t: '14:22:48.214', actor: 'system',         actorKind: 'system', action: 'venue.degraded',      target: 'Polymarket', ip: '—',             severity: 'warn',   detail: 'CLOB ws latency p99 → 1,820ms · auto-failover armed' },
  { t: '14:22:18.418', actor: 'maria.f',        actorKind: 'admin',  action: 'approval.approve',    target: 'kyc_8814',   ip: '10.4.2.41',     severity: 'info',   detail: 'tier-2 KYC · doc match 0.98' },
  { t: '14:21:52.142', actor: 'system',         actorKind: 'system', action: 'config.flag.toggle',  target: 'agent_v3',   ip: '—',             severity: 'high',   detail: 'rolled to 100% · was 25% · admin: priya.io' },
  { t: '14:21:14.882', actor: 'priya.io',       actorKind: 'admin',  action: 'config.flag.toggle',  target: 'agent_v3',   ip: '10.4.2.22',     severity: 'high',   detail: 'rollout 25% → 100%' },
  { t: '14:20:48.612', actor: 'system',         actorKind: 'system', action: 'cache.evict',         target: 'orderbook',  ip: '—',             severity: 'info',   detail: 'TTL expired · 8.4M keys · 412MB freed' },
  { t: '14:20:18.214', actor: 'oliver.cho',     actorKind: 'admin',  action: 'user.note.add',       target: 'usr_71c2',   ip: '10.4.2.18',     severity: 'info',   detail: 'flagged for proactive AML review' },
  { t: '14:19:48.418', actor: 'tess.k',         actorKind: 'user',   action: 'auth.login',          target: 'usr_8a1d',   ip: '203.0.114.22',  severity: 'info',   detail: 'oauth · github · 2fa: webauthn' },
  { t: '14:19:14.882', actor: 'system',         actorKind: 'system', action: 'order.reject',        target: 'TX-92168',   ip: '—',             severity: 'warn',   detail: 'reason · insufficient_balance · usr_5b18' },
  { t: '14:18:48.612', actor: 'maria.f',        actorKind: 'admin',  action: 'ticket.assign',       target: '#4187',      ip: '10.4.2.41',     severity: 'info',   detail: 'assigned to oliver.cho' },
  { t: '14:18:14.882', actor: 'system',         actorKind: 'system', action: 'backtest.complete',   target: 'bt_8814f2',  ip: '—',             severity: 'info',   detail: 'fed-rate-cut-tracker · 12mo · brier 0.118 · roi +34.2%' },
  { t: '14:17:48.214', actor: 'admin_api',      actorKind: 'system', action: 'broadcast.send',      target: 'bcast_184',  ip: '10.4.2.22',     severity: 'high',   detail: 'resolution notice · 2,841 users · CPI-MAR settled YES' },
  { t: '14:17:14.882', actor: 'priya.io',       actorKind: 'admin',  action: 'broadcast.send',      target: 'bcast_184',  ip: '10.4.2.22',     severity: 'high',   detail: 'composed and sent resolution notice' },
  { t: '14:16:48.612', actor: 'system',         actorKind: 'system', action: 'rate.limit.hit',      target: 'kalshi',     ip: '—',             severity: 'warn',   detail: '1,200 req/s ceiling · throttled 14s' },
  { t: '14:16:14.882', actor: 'k. yamamoto',    actorKind: 'user',   action: 'block.update',        target: 'blk_94f2',   ip: '124.18.42.88',  severity: 'info',   detail: 'fed-rate-cut-tracker · published patch · v4.2.1' },
  { t: '14:15:48.214', actor: 'system',         actorKind: 'system', action: 'kill_switch.armed',   target: 'global',     ip: '—',             severity: 'crit',   detail: 'auto-trip · oracle dispute · halted 4 markets · 14s' },
  { t: '14:15:14.882', actor: 'oliver.cho',     actorKind: 'admin',  action: 'kill_switch.disarm',  target: 'global',     ip: '10.4.2.18',     severity: 'crit',   detail: 'manual override · post-incident review' },
];

function SevPill({ s }) {
  if (s === 'info')  return <AdmPill>info</AdmPill>;
  if (s === 'warn')  return <AdmPill kind="warn">warn</AdmPill>;
  if (s === 'high')  return <AdmPill kind="info">high</AdmPill>;
  if (s === 'crit')  return <AdmPill kind="loss">CRIT</AdmPill>;
  return <AdmPill>{s}</AdmPill>;
}
function ActorIcon({ k }) {
  const c = { admin:'var(--accent-text)', user:'var(--info)', system:'var(--text-tertiary)' }[k];
  const i = { admin:'shield-check', user:'user-check', system:'bot' }[k];
  return <span style={{display:'inline-flex',width:18,height:18,borderRadius:4,background:'var(--bg-elevated)',border:'1px solid var(--border-subtle)',color:c,alignItems:'center',justifyContent:'center'}}><AdmIcon name={i} size={10}/></span>;
}

function App() {
  return (
    <AdmShell active="logs" title="Audit log" crumbs={[{ label: 'Platform' }]}>
      <AdmPageHead
        title="Audit log"
        sub={<>184,210 events · 30d retention hot · 7y cold (S3 Glacier) · streaming to <span className="mono" style={{color:'var(--text-secondary)'}}>kafka://audit.prod</span></>}
        actions={<>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />Saved views · 4</button>
          <button className="adm-btn adm-btn-secondary"><AdmIcon name="download" size={12} />Export NDJSON</button>
        </>}
      />

      <div className="adm-stat-grid">
        <AdmStat label="Events · 24h" value="14,820" delta="+8.2%" deltaKind="gain" icon="scroll" iconKind="is-info" />
        <AdmStat label="High severity" value="42" delta="+12 vs 7d avg" deltaKind="warn" icon="flag" iconKind="is-warn" />
        <AdmStat label="Critical" value="2" delta="kill_switch · armed/disarmed" deltaKind="loss" icon="shield-alert" iconKind="is-loss" />
        <AdmStat label="Admin actions" value="148" delta="14 admins · 24h" icon="users" iconKind="is-info" />
      </div>

      <div className="adm-table-wrap" style={{marginTop:0}}>
        <div className="adm-table-tools">
          <div className="adm-table-tools-search">
            <AdmIcon name="search" size={13} />
            <input placeholder="action, actor, target, ip…   try: action:user.suspend severity:high" />
          </div>
          <AdmFilter active count="14,820">All</AdmFilter>
          <AdmFilter count="148">Admin</AdmFilter>
          <AdmFilter count="8,420">User</AdmFilter>
          <AdmFilter count="6,252">System</AdmFilter>
          <AdmFilter count="42">High</AdmFilter>
          <AdmFilter count="2">Critical</AdmFilter>
          <button className="adm-filter"><AdmIcon name="filter" size={11} />Last 24h</button>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Severity</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>IP</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {LOGS.map((l, i) => (
              <tr key={i}>
                <td className="col-mono col-tertiary" style={{fontSize:11,whiteSpace:'nowrap'}}>{l.t}</td>
                <td><SevPill s={l.severity} /></td>
                <td className="mono" style={{fontSize:11.5,color:'var(--text-primary)',fontWeight:500}}>{l.action}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <ActorIcon k={l.actorKind} />
                    <span style={{fontSize:11.5,color: l.actorKind === 'admin' ? 'var(--accent-text)' : 'var(--text-secondary)'}}>{l.actor}</span>
                  </div>
                </td>
                <td className="mono" style={{fontSize:11,color:'var(--text-secondary)'}}>{l.target}</td>
                <td className="col-mono col-tertiary" style={{fontSize:10.5}}>{l.ip}</td>
                <td style={{fontSize:11.5,color:'var(--text-secondary)',maxWidth:340}}>{l.detail}</td>
                <td className="col-actions"><button className="adm-icon-btn"><AdmIcon name="more" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-table-foot">
          <span>showing 20 of 14,820 · live tail enabled</span>
          <div className="adm-pagination">
            <button><AdmIcon name="chevron-left" size={11} /></button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>…</button>
            <button>741</button>
            <button><AdmIcon name="chevron-right" size={11} /></button>
          </div>
        </div>
      </div>
    </AdmShell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
