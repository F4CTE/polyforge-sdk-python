/* Polyforge — Copy config detail
   One active copy: PnL chart, kill switch, copied-trade history, divergence vs source. */

const CD_CFG = {
  id: 'cp_8a2f1',
  name: 'Mirror 0xtidemark',
  status: 'ACTIVE',
  mode: 'PERCENTAGE',
  sizeValue: 5,
  target: { user: '0xtidemark', display: '0xTidemark', avatar: 'TM' },
  startedAt: '2026-04-12 14:08 UTC',
  pnl: '+$1,142.80',
  pnlValue: 1142.80,
  pnlPct: 11.4,
  divergence: '-2.1%',
  trades: 18,
  wins: 13,
  losses: 5,
  exposure: '$2,840',
  exposureCap: '$5,000',
  dailyLoss: '$0',
  dailyLossCap: '$250',
  totalLoss: '$0',
  totalLossCap: '$800',
  pnlSeries: [0, 80, 120, 90, 180, 240, 210, 320, 380, 410, 360, 480, 540, 620, 580, 720, 840, 920, 1010, 1080, 1142],
  sourceSeries: [0, 90, 130, 100, 200, 260, 230, 350, 420, 460, 400, 540, 610, 700, 660, 820, 950, 1040, 1140, 1220, 1290],
};

const CD_HISTORY = [
  { time: '2h ago',  market: 'Will Fed cut rates in June 2026?', side: 'YES', source: '$24,800 @ 64¢', mine: '$1,240 @ 64¢', status: 'open',   pnl: '+$72.40' },
  { time: '5h ago',  market: 'Bitcoin above $120k by July 1?',  side: 'NO',  source: '$18,200 @ 38¢', mine: '$910 @ 38¢',   status: 'open',   pnl: '+$28.10' },
  { time: '8h ago',  market: 'Trump vs Vance — GOP nominee',     side: 'YES', source: '$32,400 @ 72¢', mine: '$1,620 @ 72¢', status: 'open',   pnl: '+$184.20' },
  { time: '1d ago',  market: 'NVDA Q2 earnings beat',            side: 'YES', source: '$12,800 @ 58¢', mine: '$640 @ 58¢',   status: 'won',    pnl: '+$284.80' },
  { time: '1d ago',  market: 'Ethereum ETF approval Q3',         side: 'YES', source: '$22,400 @ 44¢', mine: '$1,120 @ 44¢', status: 'open',   pnl: '-$24.60' },
  { time: '2d ago',  market: 'Lakers make NBA playoffs',         side: 'NO',  source: '$8,400 @ 24¢',  mine: '$420 @ 24¢',   status: 'lost',   pnl: '-$101.60' },
  { time: '2d ago',  market: 'Will SCOTUS rule by June 30?',     side: 'YES', source: '$14,000 @ 68¢', mine: '$700 @ 68¢',   status: 'won',    pnl: '+$148.40' },
  { time: '3d ago',  market: 'CPI under 3.0% in May',            side: 'NO',  source: '$28,000 @ 52¢', mine: '$1,400 @ 52¢', status: 'won',    pnl: '+$672.00' },
  { time: '3d ago',  market: 'Tesla deliveries above 480k',      side: 'YES', source: '$11,200 @ 36¢', mine: '$560 @ 36¢',   status: 'lost',   pnl: '-$201.60' },
  { time: '4d ago',  market: 'Apple WWDC AI announcement',       side: 'YES', source: '$16,800 @ 78¢', mine: '$840 @ 78¢',   status: 'won',    pnl: '+$184.80' },
];

function CdDualSparkline({ mine, source, w = 600, h = 180 }) {
  const all = [...mine, ...source];
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1;
  const pad = 6;
  const toPath = (data) => data.map((v, i) =>
    `${pad + (i / (data.length - 1)) * (w - pad * 2)},${h - pad - ((v - min) / range) * (h - pad * 2)}`
  ).join(' ');
  const minePts = toPath(mine);
  const srcPts  = toPath(source);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={pad} x2={w - pad} y1={pad + (i / 4) * (h - pad * 2)} y2={pad + (i / 4) * (h - pad * 2)} stroke="var(--border-subtle)" strokeWidth="0.5" />
      ))}
      <polyline points={srcPts} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={minePts} fill="none" stroke="var(--accent-default)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CdCapBar({ label, used, cap, color = 'var(--accent-default)' }) {
  const pct = Math.min(100, Math.round((parseFloat(String(used).replace(/[$,]/g, '')) / parseFloat(String(cap).replace(/[$,]/g, ''))) * 100)) || 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>
          {used} <span style={{ color: 'var(--text-tertiary)' }}>/ {cap}</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function CdHistoryRow({ h }) {
  const statusKind = h.status === 'won' ? 'is-gain' : h.status === 'lost' ? 'is-loss' : '';
  const statusLabel = h.status === 'won' ? 'Won' : h.status === 'lost' ? 'Lost' : 'Open';
  const pnlPositive = h.pnl.startsWith('+');
  return (
    <tr>
      <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{h.time}</td>
      <td>
        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.market}</div>
      </td>
      <td>
        <span className={`adm-pill ${h.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 10 }}>{h.side}</span>
      </td>
      <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{h.source}</td>
      <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{h.mine}</td>
      <td><span className={`adm-pill ${statusKind}`}>{statusLabel}</span></td>
      <td className="mono" style={{ fontSize: 11.5, color: pnlPositive ? 'var(--gain-text)' : 'var(--loss-text)', textAlign: 'right' }}>{h.pnl}</td>
    </tr>
  );
}

function App() {
  const [paused, setPaused] = React.useState(false);

  return (
    <UsrShell active="copy-detail" title={CD_CFG.name} crumbs={[
      {label: 'Copy trading', href: 'App-Copy.html'},
      {label: CD_CFG.name},
    ]} actions={
      <>
        {paused ? (
          <button className="adm-btn adm-btn-primary" onClick={() => setPaused(false)}>
            <AdmIcon name="play" size={12} />Resume
          </button>
        ) : (
          <button className="adm-btn adm-btn-secondary" onClick={() => setPaused(true)}>
            <AdmIcon name="pause" size={12} />Pause
          </button>
        )}
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="settings" size={12} />Edit</button>
        <button className="adm-btn adm-btn-danger">
          <AdmIcon name="x" size={12} />Stop & close all
        </button>
      </>
    }>
      <AdmPageHead
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>{CD_CFG.name}{paused ? <span className="adm-pill is-warn">Paused</span> : <span className="adm-pill has-dot is-gain is-pulse">Active</span>}</span>}
        sub={`Copying @${CD_CFG.target.user} · ${CD_CFG.mode === 'PERCENTAGE' ? `${CD_CFG.sizeValue}% of trade size` : CD_CFG.mode === 'FIXED' ? `$${CD_CFG.sizeValue} fixed` : 'Mirror 1:1'} · started ${CD_CFG.startedAt}`}
      />

      {/* Top stats */}
      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="P&L since start" value={CD_CFG.pnl} delta={`+${CD_CFG.pnlPct}% on capital`} deltaKind="gain" />
        <AdmStat label="Trades copied" value={CD_CFG.trades} delta={`${CD_CFG.wins}W / ${CD_CFG.losses}L`} deltaKind="neutral" />
        <AdmStat label="Open exposure" value={CD_CFG.exposure} delta={`of ${CD_CFG.exposureCap} cap`} deltaKind="neutral" />
        <AdmStat label="Divergence vs source" value={CD_CFG.divergence} delta="from slippage + fees" deltaKind="loss" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, marginBottom: 20 }}>
        {/* Equity curve */}
        <div className="adm-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Equity curve</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>You vs source · scaled to your bankroll · last 30 days</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 2, background: 'var(--accent-default)', borderRadius: 1 }} />
                <span style={{ color: 'var(--text-secondary)' }}>You</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 2, background: 'var(--text-tertiary)', borderRadius: 1, borderTop: '1px dashed var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Source (scaled)</span>
              </span>
            </div>
          </div>
          <CdDualSparkline mine={CD_CFG.pnlSeries} source={CD_CFG.sourceSeries} h={200} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'Geist Mono, monospace' }}>
            <span>Apr 12</span><span>Apr 19</span><span>Apr 26</span><span>May 03</span><span>Today</span>
          </div>
        </div>

        {/* Risk caps */}
        <div className="adm-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Risk caps</div>
          <CdCapBar label="Open exposure" used={CD_CFG.exposure} cap={CD_CFG.exposureCap} />
          <CdCapBar label="Daily loss" used={CD_CFG.dailyLoss} cap={CD_CFG.dailyLossCap} color="var(--loss)" />
          <CdCapBar label="Total loss" used={CD_CFG.totalLoss} cap={CD_CFG.totalLossCap} color="var(--loss)" />
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AdmIcon name="check" size={11} className="adm-icon-gain" />
            <span>All caps below limits.</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AdmIcon name="check" size={11} className="adm-icon-gain" />
            <span>Auto-stop on losses · enabled</span>
          </div>
        </div>
      </div>

      {/* Copied-trade history */}
      <div className="adm-card" style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Copied-trade history</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>Each row is a fill the engine mirrored from the source. Click to compare slippage vs source.</div>
        </div>
        <div className="adm-table-tools" style={{ marginBottom: 12 }}>
          <div className="adm-filter-group">
            <button className="adm-filter is-active">All ({CD_HISTORY.length})</button>
            <button className="adm-filter">Open ({CD_HISTORY.filter(h => h.status === 'open').length})</button>
            <button className="adm-filter">Won ({CD_HISTORY.filter(h => h.status === 'won').length})</button>
            <button className="adm-filter">Lost ({CD_HISTORY.filter(h => h.status === 'lost').length})</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="adm-btn adm-btn-sm adm-btn-secondary"><AdmIcon name="download" size={11} />Export CSV</button>
          </div>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Market</th>
              <th>Side</th>
              <th>Source</th>
              <th>Mine</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>P&L</th>
            </tr>
          </thead>
          <tbody>
            {CD_HISTORY.map((h, i) => <CdHistoryRow key={i} h={h} />)}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);