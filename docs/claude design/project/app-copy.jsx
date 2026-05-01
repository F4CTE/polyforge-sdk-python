/* Polyforge — Copy trading list
   Configs you've set up to mirror other traders.
   Data shape mirrors the real user-app: ACTIVE/PAUSED/STOPPED, PERCENTAGE/FIXED/MIRROR. */

const CP_CONFIGS = [
  {
    id: 'cfg_8a2',
    target: '0x7f4a...c93b',
    targetUser: 'unholyfist.eth',
    avatar: 'UF',
    mode: 'PERCENTAGE',
    sizeValue: 5,
    status: 'ACTIVE',
    copiedPnl: '+$1,284.40',
    pnlPct: '+18.2%',
    winRate: '74%',
    tradeCount: 42,
    correlation: 0.92,
    drawdown: '-$184',
    maxExposure: 5000,
    maxDailyLoss: 250,
    maxLoss: 800,
    since: '34d ago',
    spark: [40, 44, 50, 48, 56, 60, 64, 62, 68, 72, 76, 78, 82, 86, 84, 90, 92, 96, 100],
  },
  {
    id: 'cfg_b41',
    target: '0x91c2...ae08',
    targetUser: '0xtidemark',
    avatar: 'TM',
    mode: 'MIRROR',
    sizeValue: 1,
    status: 'ACTIVE',
    copiedPnl: '+$612.10',
    pnlPct: '+9.4%',
    winRate: '68%',
    tradeCount: 28,
    correlation: 0.88,
    drawdown: '-$96',
    maxExposure: 8000,
    maxDailyLoss: 400,
    maxLoss: null,
    since: '21d ago',
    spark: [60, 58, 62, 64, 66, 64, 68, 72, 70, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92],
  },
  {
    id: 'cfg_9d5',
    target: '0x4e8a...12cf',
    targetUser: 'cassandra.x',
    avatar: 'CX',
    mode: 'FIXED',
    sizeValue: 200,
    status: 'PAUSED',
    copiedPnl: '+$184.50',
    pnlPct: '+3.1%',
    winRate: '64%',
    tradeCount: 18,
    correlation: 0.71,
    drawdown: '-$248',
    maxExposure: 3000,
    maxDailyLoss: 150,
    maxLoss: 500,
    since: '12d ago',
    spark: [50, 52, 54, 50, 48, 52, 56, 54, 58, 56, 60, 58, 62, 60, 64, 62, 64, 66, 68],
  },
  {
    id: 'cfg_2f1',
    target: '0xa14d...8e4f',
    targetUser: 'plinkochamp.eth',
    avatar: 'PC',
    mode: 'PERCENTAGE',
    sizeValue: 10,
    status: 'ACTIVE',
    copiedPnl: '-$84.20',
    pnlPct: '-1.4%',
    winRate: '52%',
    tradeCount: 24,
    correlation: 0.64,
    drawdown: '-$312',
    maxExposure: 2500,
    maxDailyLoss: 200,
    maxLoss: null,
    since: '6d ago',
    spark: [50, 52, 54, 56, 54, 58, 60, 56, 58, 54, 52, 56, 50, 54, 52, 50, 48, 50, 46],
  },
  {
    id: 'cfg_4c7',
    target: '0x82a1...44de',
    targetUser: 'parlaymoney',
    avatar: 'PM',
    mode: 'PERCENTAGE',
    sizeValue: 3,
    status: 'STOPPED',
    copiedPnl: '+$48.10',
    pnlPct: '+0.8%',
    winRate: '58%',
    tradeCount: 14,
    correlation: 0.42,
    drawdown: '-$140',
    maxExposure: 1500,
    maxDailyLoss: 100,
    maxLoss: 300,
    since: '94d ago',
    spark: [50, 52, 50, 54, 52, 50, 48, 52, 50, 54, 56, 54, 52, 54, 56, 54, 52, 50, 52],
  },
  {
    id: 'cfg_5e3',
    target: '0xb71f...7a02',
    targetUser: 'oracleseer',
    avatar: 'OS',
    mode: 'MIRROR',
    sizeValue: 1,
    status: 'ACTIVE',
    copiedPnl: '+$248.90',
    pnlPct: '+5.4%',
    winRate: '62%',
    tradeCount: 16,
    correlation: 0.78,
    drawdown: '-$84',
    maxExposure: 4500,
    maxDailyLoss: 300,
    maxLoss: 600,
    since: '8d ago',
    spark: [55, 56, 58, 56, 60, 58, 62, 60, 64, 62, 66, 68, 70, 68, 72, 70, 72, 74, 76],
  },
];

const CP_TOTAL_PNL = '+$2,293.80';
const CP_TOTAL_PNL_PCT = '+11.2%';
const CP_BEST = { user: 'unholyfist.eth', pnl: '+$1,284.40' };
const CP_WORST = { user: 'plinkochamp.eth', pnl: '-$84.20' };
const CP_AVG_CORR = 0.72;

function CpStatusPill({ status }) {
  const map = {
    ACTIVE:  { kind: 'is-gain is-pulse', label: 'Active' },
    PAUSED:  { kind: 'is-warn',          label: 'Paused' },
    STOPPED: { kind: '',                 label: 'Stopped' },
  };
  const v = map[status];
  return <span className={`adm-pill has-dot ${v.kind}`}>{v.label}</span>;
}

function CpModePill({ mode, sizeValue }) {
  const label =
    mode === 'PERCENTAGE' ? `${sizeValue}% of trade` :
    mode === 'FIXED'      ? `$${sizeValue} fixed`    :
                            'Mirror 1:1';
  const tone =
    mode === 'PERCENTAGE' ? 'is-accent' :
    mode === 'MIRROR'     ? 'is-gain' :
                            'is-warn';
  return <span className={`adm-pill ${tone}`}>{label}</span>;
}

function CpSparkline({ data, height = 24, width = 80, status }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  const stroke = status === 'STOPPED' ? 'var(--text-tertiary)' : (isUp ? 'var(--gain)' : 'var(--loss)');
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CpCorrBar({ value }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? 'gain' : pct >= 50 ? 'accent' : 'warning';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 60, height: 6, background: 'var(--bg-canvas)', borderRadius: 99, overflow: 'hidden', display: 'inline-block' }}>
        <span style={{
          display: 'block', height: '100%', width: `${pct}%`,
          background: tone === 'gain' ? 'var(--gain)' : tone === 'accent' ? 'var(--accent-default)' : 'var(--warning, #f59e0b)',
          borderRadius: 99,
        }} />
      </span>
      <span className="mono" style={{ fontSize: 11, color: tone === 'gain' ? 'var(--gain-text)' : tone === 'accent' ? 'var(--accent-text)' : 'var(--warning, #f59e0b)' }}>{pct}%</span>
    </span>
  );
}

function CpConfigCard({ cfg }) {
  const pnlIsUp = !cfg.copiedPnl.startsWith('-');
  return (
    <div className="adm-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="usr-whale-avatar" style={{ width: 36, height: 36 }}>{cfg.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>{cfg.targetUser}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{cfg.target} · since {cfg.since}</div>
        </div>
        <CpStatusPill status={cfg.status} />
      </div>

      {/* Mode + size */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <CpModePill mode={cfg.mode} sizeValue={cfg.sizeValue} />
        <span className="adm-pill">Max exp ${cfg.maxExposure.toLocaleString()}</span>
        {cfg.maxLoss != null && <span className="adm-pill">Max loss ${cfg.maxLoss}</span>}
      </div>

      {/* P&L block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 12, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Copied P&L</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: pnlIsUp ? 'var(--gain-text)' : 'var(--loss-text)', lineHeight: 1 }}>{cfg.copiedPnl}</div>
          <div className="mono" style={{ fontSize: 11, color: pnlIsUp ? 'var(--gain-text)' : 'var(--loss-text)', marginTop: 4 }}>{cfg.pnlPct}</div>
        </div>
        <CpSparkline data={cfg.spark} status={cfg.status} />
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Win rate</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{cfg.winRate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Trades</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{cfg.tradeCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Drawdown</span>
          <span className="mono" style={{ color: 'var(--loss-text)' }}>{cfg.drawdown}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Corr.</span>
          <CpCorrBar value={cfg.correlation} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        {cfg.status === 'ACTIVE' && <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{ flex: 1 }}><AdmIcon name="pause" size={11} />Pause</button>}
        {cfg.status === 'PAUSED' && <button className="adm-btn adm-btn-sm adm-btn-primary" style={{ flex: 1 }}><AdmIcon name="play" size={11} />Resume</button>}
        {cfg.status === 'STOPPED' && <button className="adm-btn adm-btn-sm adm-btn-secondary" style={{ flex: 1 }}>Restart</button>}
        <a href={`App-Copy-Detail.html`} className="adm-btn adm-btn-sm adm-btn-secondary" style={{ flex: 1 }}>Details<AdmIcon name="arrow-right" size={11} /></a>
      </div>
    </div>
  );
}

function App() {
  const active = CP_CONFIGS.filter(c => c.status === 'ACTIVE').length;
  const paused = CP_CONFIGS.filter(c => c.status === 'PAUSED').length;
  const stopped = CP_CONFIGS.filter(c => c.status === 'STOPPED').length;

  return (
    <UsrShell active="copy" title="Copy trading" actions={
      <>
        <a href="App-Copy-Discover.html" className="adm-btn adm-btn-secondary"><AdmIcon name="compass" size={12} />Discover traders</a>
        <a href="App-Copy-Setup.html" className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New copy config</a>
      </>
    }>
      <AdmPageHead
        title="Copy trading"
        sub={`${CP_CONFIGS.length} configs · ${active} active · auto-mirror trades from selected wallets with risk caps and circuit breakers`}
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Total copied P&L" value={CP_TOTAL_PNL} delta={CP_TOTAL_PNL_PCT} deltaKind="gain" />
        <AdmStat label="Active configs"   value={String(active)} delta={`${paused} paused · ${stopped} stopped`} deltaKind="neutral" />
        <AdmStat label="Best performer"   value={`@${CP_BEST.user.split('.')[0]}`} delta={CP_BEST.pnl} deltaKind="gain" />
        <AdmStat label="Avg correlation"  value={`${Math.round(CP_AVG_CORR * 100)}%`} delta="across active configs" deltaKind="neutral" />
      </div>

      {/* Filter bar */}
      <div className="adm-table-tools" style={{ marginBottom: 16 }}>
        <div className="adm-filter-group">
          <button className="adm-filter is-active">All ({CP_CONFIGS.length})</button>
          <button className="adm-filter">Active ({active})</button>
          <button className="adm-filter">Paused ({paused})</button>
          <button className="adm-filter">Stopped ({stopped})</button>
        </div>
        <div className="adm-search" style={{ marginLeft: 'auto', width: 240 }}>
          <AdmIcon name="search" size={12} />
          <input placeholder="Search by username or address" />
        </div>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="filter" size={12} />More filters</button>
      </div>

      {/* Config grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
        {CP_CONFIGS.map(cfg => <CpConfigCard key={cfg.id} cfg={cfg} />)}
      </div>

      {/* Risk controls reminder */}
      <div className="adm-card" style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', color: 'var(--accent-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AdmIcon name="shield" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Risk caps active across all configs</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Max daily loss is enforced before every fill. If the cap is hit, the config auto-pauses and we email + notify you.
            You can change global caps in <a href="App-Settings.html" style={{ color: 'var(--accent-text)' }}>Settings → Risk</a>.
          </div>
        </div>
        <a href="App-Settings.html" className="adm-btn adm-btn-sm adm-btn-secondary">Risk settings<AdmIcon name="arrow-right" size={11} /></a>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);