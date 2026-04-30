/* eslint-disable */
/* Status page — live-ish service dashboard + incidents */

(() => {
  const { useMemo } = React;

  // 90-day uptime buckets (today at right).
  // Values: 'up' | 'degraded' | 'down' | number (0-1 partial)
  // We seed deterministically so the page "looks" historical.
  function generateUptime(seed, incidents = []) {
    const days = 90;
    const arr = Array.from({ length: days }, () => 'up');
    incidents.forEach(([offsetDays, kind]) => {
      const idx = days - 1 - offsetDays;
      if (idx >= 0 && idx < days) arr[idx] = kind;
    });
    return arr;
  }

  const SERVICES = [
    {
      name: 'Strategy Execution',
      desc: 'Order routing, block evaluation, signer',
      uptime: 99.98,
      status: 'operational',
      ticks: generateUptime(1, [[37, 'degraded'], [61, 'degraded']]),
    },
    {
      name: 'Market Data Feed',
      desc: 'WebSocket + REST price streams',
      uptime: 99.94,
      status: 'operational',
      ticks: generateUptime(2, [[12, 'degraded'], [12, 'degraded'], [45, 'down']]),
    },
    {
      name: 'Backtest Engine',
      desc: 'Historical simulation + parameter sweeps',
      uptime: 99.72,
      status: 'operational',
      ticks: generateUptime(3, [[8, 'degraded'], [22, 'down'], [55, 'degraded'], [80, 'degraded']]),
    },
    {
      name: 'Whale Intelligence',
      desc: 'Wallet tracker, alerts, move-money feed',
      uptime: 99.91,
      status: 'operational',
      ticks: generateUptime(4, [[29, 'degraded']]),
    },
    {
      name: 'Webhook Delivery',
      desc: 'Outbound HMAC-signed events',
      uptime: 99.99,
      status: 'operational',
      ticks: generateUptime(5, [[50, 'degraded']]),
    },
    {
      name: 'Public API',
      desc: 'REST, GraphQL, MCP server',
      uptime: 99.96,
      status: 'operational',
      ticks: generateUptime(6, [[14, 'degraded'], [68, 'degraded']]),
    },
  ];

  const INCIDENTS = [
    {
      status: 'resolved',
      title: 'Backtest queue stalled for strategies with 12+ blocks',
      date: '2026-04-12 · 14:08 UTC',
      body: 'A condition-solver regression in v1.4.1 caused backtests on strategies with deep block graphs to hang at ~97% progress. Roll-forward fix shipped in v1.4.2. No user data affected; all paused backtests were retried automatically.',
      updates: [
        ['Resolved · 16:42',      'Deployed v1.4.2 across all regions. Queued backtests drained. All systems nominal.'],
        ['Monitoring · 16:08',   'Fix deployed to eu-west-2. Backfilling stalled jobs. Metrics trending healthy.'],
        ['Identified · 15:21',   <>Root cause: <strong>regression in the block-graph topological sort</strong> when more than 12 blocks feed into the same condition node. Reproducible locally.</>],
        ['Investigating · 14:08','Users reporting backtest progress bar stalling near completion. Confirmed on staging. Engineering paged.'],
      ],
    },
    {
      status: 'resolved',
      title: 'Degraded WebSocket latency in ap-southeast-1',
      date: '2026-04-03 · 22:40 UTC',
      body: 'Market-data WebSocket clients in Asia-Pacific saw p99 latency spike from 210ms to 1.8s for ~45 minutes. Caused by a misconfigured load balancer in our Singapore PoP after a routine capacity upgrade. REST API unaffected.',
      updates: [
        ['Resolved · 23:35',      'Load balancer config reverted. Latency back to baseline across all PoPs.'],
        ['Monitoring · 23:18',   'Rolled back the LB config. Watching p99 metrics.'],
        ['Investigating · 22:40', 'ap-southeast-1 WebSocket p99 latency elevated. Investigating.'],
      ],
    },
    {
      status: 'resolved',
      title: 'Whale-feed stale prices (1 market)',
      date: '2026-03-22 · 09:14 UTC',
      body: 'The whale-intelligence feed showed stale positions on the "BTC above $80k" market for ~18 minutes after an upstream Polymarket contract redeploy. All other markets unaffected. No trades fired from stale data (circuit breaker caught it).',
      updates: [
        ['Resolved · 09:32',      'Reindexed the market. Positions live.'],
        ['Identified · 09:22',   'Upstream contract redeploy broke our position cursor for this market only.'],
        ['Investigating · 09:14','Alerted by our own whale-feed staleness monitor (threshold: 90s).'],
      ],
    },
  ];

  function App() {
    const anyDegraded = SERVICES.some(s => s.status !== 'operational');
    const overallOk = !anyDegraded;
    const avgUptime = useMemo(() => {
      const avg = SERVICES.reduce((a, s) => a + s.uptime, 0) / SERVICES.length;
      return avg.toFixed(3);
    }, []);

    return (
      <CompanyPage active="status" statusOk={overallOk}>
        <CompanyPageHeader
          eyebrow="System Status"
          title={overallOk ? 'All systems operational.' : 'Some systems are experiencing issues.'}
          lede={overallOk
            ? 'Live status of every user-facing Polyforge service. Uptime measured over the last 90 days. Incident history is public and unedited.'
            : 'We’re actively working on it — see below for the latest.'}
          meta={[
            { label: '90-day avg uptime', value: <span className="mono" style={{ color: 'var(--text-primary)' }}>{avgUptime}%</span> },
            { label: 'Last incident', value: '9 days ago' },
            { label: 'Subscribe', value: <a href="#" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>RSS · Email · Slack</a> },
          ]}
        />

        <CompanySection>
          <div className={'status-hero' + (overallOk ? '' : ' degraded')}>
            <div className="status-hero-icon">
              <Icon name="check" size={22} />
            </div>
            <div>
              <div className="status-hero-title">
                {overallOk ? 'All services operational' : 'Investigating an issue'}
              </div>
              <div className="status-hero-sub">
                Last checked just now · auto-refreshing every 60 seconds
              </div>
            </div>
            <div className="status-hero-meta">
              <span>{avgUptime}% / 90d</span>
              <span>6 services monitored</span>
            </div>
          </div>

          <div className="status-services">
            {SERVICES.map(svc => (
              <div className="status-service" key={svc.name}>
                <div style={{ minWidth: 0 }}>
                  <div className="status-service-head">
                    <span className="status-service-name">{svc.name}</span>
                    <span className="status-service-desc">{svc.desc}</span>
                  </div>
                  <div>
                    <div className="status-uptime-bar" role="img" aria-label={`90 day uptime: ${svc.uptime}%`}>
                      {svc.ticks.map((t, i) => (
                        <div
                          key={i}
                          className={'status-uptime-tick' + (t !== 'up' ? ' ' + t : '')}
                          title={`${89 - i} days ago · ${t}`}
                        />
                      ))}
                    </div>
                    <div className="status-uptime-meta">
                      <span>90 days ago</span>
                      <span>today</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 90 }}>
                  <div className="status-uptime-pct">{svc.uptime.toFixed(2)}%</div>
                  <div className={'status-service-pill ' + (svc.status === 'operational' ? '' : svc.status)}>
                    <span className="dot" style={{ background: svc.status === 'operational' ? 'var(--gain)' : 'var(--warning)' }} />
                    {svc.status === 'operational' ? 'Operational' : svc.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CompanySection>

        <CompanySection title="Recent incidents" subtitle="Complete log of the last 30 days. Older incidents are archived monthly.">
          {INCIDENTS.map((inc, i) => (
            <div className="status-incident" key={i}>
              <div className="status-incident-head">
                <span className={'status-incident-pill ' + inc.status}>{inc.status}</span>
                <span className="status-incident-title">{inc.title}</span>
                <span className="status-incident-date">{inc.date}</span>
              </div>
              <div className="status-incident-body">{inc.body}</div>
              <div className="status-incident-updates">
                {inc.updates.map((u, j) => (
                  <div className="status-incident-update" key={j}>
                    <div className="status-incident-update-time">{u[0]}</div>
                    <div className="status-incident-update-body">{u[1]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <a className="btn btn-ghost btn-sm" href="#">View full incident history</a>
          </div>
        </CompanySection>

        <CompanySection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              ['Maintenance windows', 'Sundays 04:00–06:00 UTC', 'Scheduled windows posted 7 days ahead.'],
              ['Post-mortems', 'Within 5 business days', 'Every sev-2+ incident gets a public write-up.'],
              ['SLA', '99.9% monthly uptime', 'Credits auto-issued on qualifying breaches.'],
            ].map(([t, v, d]) => (
              <div key={t} style={{ padding: 20, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t}</div>
                <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6, letterSpacing: '-0.005em' }}>{v}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </CompanySection>
      </CompanyPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
