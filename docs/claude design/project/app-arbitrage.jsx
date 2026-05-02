/* Polyforge — Arbitrage scanner
   Two modes:
   - Single-venue (merge): YES + NO < $1.00 on a binary market → buy both, $1 payout
   - Cross-venue: same event priced differently on Polymarket vs Kalshi → spread trade
*/

const ARB_SINGLE = [
  { id: 'fed-cut-jul',     title: 'Fed cuts rates by July 31, 2026?',                      cat: 'Macro',     ends: '2026-07-31', yes: 0.642, no: 0.342, sum: 0.984, marginPct: 1.6, fee: 0.4, profitPerShare: 0.012 },
  { id: 'btc-150k-dec',    title: 'BTC > $150K by Dec 31?',                                cat: 'Crypto',    ends: '2026-12-31', yes: 0.184, no: 0.802, sum: 0.986, marginPct: 1.4, fee: 0.4, profitPerShare: 0.010 },
  { id: 'cpi-mar-cool',    title: 'CPI < 2.4% in March print?',                            cat: 'Macro',     ends: '2026-04-12', yes: 0.418, no: 0.564, sum: 0.982, marginPct: 1.8, fee: 0.4, profitPerShare: 0.014 },
  { id: 'oscars-opp',      title: 'Will "Oppenheimer 2" win Best Picture?',                cat: 'Culture',   ends: '2026-03-15', yes: 0.234, no: 0.728, sum: 0.962, marginPct: 3.8, fee: 0.5, profitPerShare: 0.033 },
  { id: 'nvda-earn-q1',    title: 'NVDA Q1 earnings beat $4.20 EPS?',                      cat: 'Stocks',    ends: '2026-05-22', yes: 0.612, no: 0.376, sum: 0.988, marginPct: 1.2, fee: 0.4, profitPerShare: 0.008 },
  { id: 'tariff-chn-25',   title: 'New China tariffs > 25% by EOY?',                       cat: 'Politics',  ends: '2026-12-31', yes: 0.348, no: 0.610, sum: 0.958, marginPct: 4.2, fee: 0.5, profitPerShare: 0.037 },
  { id: 'oil-100-summer',  title: 'WTI crude > $100 between Jun–Aug?',                     cat: 'Commodities', ends: '2026-09-01', yes: 0.142, no: 0.836, sum: 0.978, marginPct: 2.2, fee: 0.4, profitPerShare: 0.018 },
  { id: 'spx-5800-eoy',    title: 'S&P 500 closes > 5,800 on Dec 31?',                     cat: 'Stocks',    ends: '2026-12-31', yes: 0.524, no: 0.466, sum: 0.990, marginPct: 1.0, fee: 0.4, profitPerShare: 0.006 },
  { id: 'elec28-dem',      title: 'Democratic nominee wins 2028 presidency?',              cat: 'Politics',  ends: '2028-11-07', yes: 0.482, no: 0.470, sum: 0.952, marginPct: 4.8, fee: 0.5, profitPerShare: 0.043 },
  { id: 'recession-eoy',   title: 'NBER-defined recession declared in 2026?',              cat: 'Macro',     ends: '2026-12-31', yes: 0.276, no: 0.708, sum: 0.984, marginPct: 1.6, fee: 0.4, profitPerShare: 0.012 },
];

const ARB_CROSS = [
  { id: 'm1', poly: 'Fed cuts rates at July FOMC',              kal: 'FED-RATE-CUT-JUL26',     polyYes: 0.642, kalYes: 0.594, spread: 4.8, dir: 'Buy YES on Kalshi · Sell on Polymarket',  conf: 0.92 },
  { id: 'm2', poly: 'BTC closes > $150K on Dec 31',             kal: 'BTC-150K-2026-12-31',    polyYes: 0.184, kalYes: 0.220, spread: 3.6, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.88 },
  { id: 'm3', poly: 'Tariffs on China imports > 25% by EOY',    kal: 'CHN-TARIFF-25-EOY26',    polyYes: 0.348, kalYes: 0.412, spread: 6.4, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.74 },
  { id: 'm4', poly: 'Recession declared by NBER in 2026',       kal: 'NBER-RECESSION-2026',    polyYes: 0.276, kalYes: 0.298, spread: 2.2, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.81 },
  { id: 'm5', poly: 'Oscars 2026 — "Oppenheimer 2" wins',       kal: 'OSCARS-OPP-2026',        polyYes: 0.234, kalYes: 0.286, spread: 5.2, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.62 },
  { id: 'm6', poly: 'CPI YoY < 2.4% in March release',          kal: 'CPI-MAR-COOL-26',        polyYes: 0.418, kalYes: 0.456, spread: 3.8, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.86 },
  { id: 'm7', poly: 'NVDA beats Q1 earnings ($4.20 EPS)',       kal: 'NVDA-Q1-BEAT',           polyYes: 0.612, kalYes: 0.578, spread: 3.4, dir: 'Buy YES on Kalshi · Sell on Polymarket',  conf: 0.79 },
  { id: 'm8', poly: 'Super Bowl winner: Chiefs',                kal: 'NFL-SB-CHIEFS',          polyYes: 0.214, kalYes: 0.246, spread: 3.2, dir: 'Buy YES on Polymarket · Sell on Kalshi',  conf: 0.94 },
];

function marginColorClass(pct) {
  if (pct >= 4) return 'is-gain';
  if (pct >= 2) return 'is-warn';
  return '';
}

function App() {
  const [tab, setTab]               = React.useState('single');
  const [minMargin, setMinMargin]   = React.useState(0.5);
  const [minSpread, setMinSpread]   = React.useState(2);
  const [scanning, setScanning]     = React.useState(false);
  const [executingId, setExecutingId] = React.useState(null);

  const opportunitiesS = ARB_SINGLE.filter(o => o.marginPct >= minMargin);
  const opportunitiesC = ARB_CROSS.filter(o => o.spread >= minSpread);
  const count = tab === 'single' ? opportunitiesS.length : opportunitiesC.length;

  function rescan() {
    setScanning(true);
    setTimeout(() => setScanning(false), 700);
  }

  function execute(id) {
    setExecutingId(id);
    setTimeout(() => setExecutingId(null), 900);
  }

  return (
    <UsrShell active="arbitrage" title="Arbitrage" actions={
      <button className="adm-btn adm-btn-secondary" onClick={rescan} disabled={scanning}>
        <AdmIcon name="refresh" size={12} />{scanning ? 'Scanning…' : 'Refresh'}
      </button>
    }>
      <AdmPageHead
        title="Arbitrage Scanner"
        sub="Potential spread windows · live scan across Polymarket & Kalshi · refresh every 10s"
      />

      {/* Stat row */}
      <div className="adm-grid-3" style={{ marginBottom: 20 }}>
        <AdmStat
          label="Single-venue · open"
          value={ARB_SINGLE.length.toString()}
          delta={`${ARB_SINGLE.filter(o => o.marginPct >= 2).length} above 2%`}
          deltaKind="gain"
        />
        <AdmStat
          label="Cross-venue · open"
          value={ARB_CROSS.length.toString()}
          delta={`${ARB_CROSS.filter(o => o.spread >= 4).length} above 4%`}
          deltaKind="gain"
        />
        <AdmStat
          label="Realized · 30d"
          value="+$2,142"
          delta="+18 fills"
          deltaKind="gain"
        />
      </div>

      {/* Tab switcher — mirrors the repo's segmented switch */}
      <div className="arb-tabs" role="tablist" aria-label="Arbitrage mode">
        <button
          role="tab"
          aria-selected={tab === 'single'}
          className={`arb-tab${tab === 'single' ? ' is-active' : ''}`}
          onClick={() => setTab('single')}
        >
          <AdmIcon name="circle-check" size={13} />
          <span>Single-venue</span>
          <span className="arb-tab-count">{ARB_SINGLE.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'cross'}
          className={`arb-tab${tab === 'cross' ? ' is-active' : ''}`}
          onClick={() => setTab('cross')}
        >
          <AdmIcon name="refresh" size={13} />
          <span>Cross-venue</span>
          <span className="arb-tab-count">{ARB_CROSS.length}</span>
        </button>
      </div>

      {/* How-it-works callout */}
      <div className="arb-callout" role="note">
        <div className="arb-callout-icon"><AdmIcon name="info" size={14} /></div>
        <div className="arb-callout-body">
          {tab === 'single' ? (
            <p>
              <strong>Merge arbitrage.</strong> In a binary market, YES + NO settle to <span className="mono">$1.00</span>.
              When live prices sum to less than that, you can buy both sides at a discount and pocket the difference at resolution.
              Profit per share = <span className="mono">$1.00 − (YES + NO)</span> minus CLOB fees (~0.4–0.5%).
            </p>
          ) : (
            <p>
              <strong>Cross-venue arbitrage.</strong> When the same real-world event trades at different prices on Polymarket vs Kalshi,
              buy the underpriced side on one venue and sell (or hedge) on the other. Match confidence reflects how closely the two
              listings track the same underlying outcome — <span className="mono">≥80%</span> indicates a stronger match.
            </p>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="arb-filter">
        <span className="arb-filter-label">{tab === 'single' ? 'Min margin' : 'Min spread'}</span>
        {(tab === 'single' ? [0.5, 1, 2, 5] : [1, 2, 3, 5]).map(v => {
          const isActive = (tab === 'single' ? minMargin : minSpread) === v;
          return (
            <button
              key={v}
              className={`arb-chip${isActive ? ' is-active' : ''}`}
              onClick={() => tab === 'single' ? setMinMargin(v) : setMinSpread(v)}
            >
              {v}%+
            </button>
          );
        })}
        <span className="arb-filter-count">
          {scanning
            ? <span><span className="arb-dot pulsing" /> Scanning…</span>
            : <span>{count} opportunit{count === 1 ? 'y' : 'ies'} found</span>}
        </span>
      </div>

      {tab === 'single' ? (
        <SingleTable rows={opportunitiesS} executingId={executingId} onExecute={execute} minMargin={minMargin} />
      ) : (
        <CrossTable rows={opportunitiesC} minSpread={minSpread} />
      )}

      <p className="arb-foot">
        Prices from live Redis cache (10s TTL). Always verify on-chain before executing large positions —
        arbitrage profit is not guaranteed if prices move between quote and fill.
      </p>
    </UsrShell>
  );
}

/* ─── Single-venue table ────────────────────────────────────────────── */

function SingleTable({ rows, executingId, onExecute, minMargin }) {
  if (rows.length === 0) {
    return (
      <div className="arb-empty">
        <AdmIcon name="alert" size={28} />
        <p className="arb-empty-title">No arbitrage at the {minMargin}%+ threshold right now.</p>
        <p className="arb-empty-sub">Markets are efficiently priced. Lower the threshold or check back shortly.</p>
      </div>
    );
  }

  return (
    <div className="adm-table-wrap arb-table-wrap">
      <table className="adm-table arb-table">
        <thead>
          <tr>
            <th>Market</th>
            <th className="col-num">YES</th>
            <th className="col-num">NO</th>
            <th className="col-num">Sum</th>
            <th className="col-num">Margin</th>
            <th className="col-num">Profit / share</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <a href="App-Market-Detail.html" className="arb-mkt-title">{r.title}</a>
                <div className="arb-mkt-meta">
                  <span>{r.cat}</span>
                  <span>· Closes {fmtDate(r.ends)}</span>
                </div>
              </td>
              <td className="col-mono col-num">${r.yes.toFixed(3)}</td>
              <td className="col-mono col-num">${r.no.toFixed(3)}</td>
              <td className="col-mono col-num col-tertiary">${r.sum.toFixed(3)}</td>
              <td className={`col-mono col-num arb-margin ${marginColorClass(r.marginPct)}`}>
                +{r.marginPct.toFixed(1)}%
              </td>
              <td className="col-mono col-num col-secondary">${r.profitPerShare.toFixed(3)}</td>
              <td style={{ width: 110, textAlign: 'right' }}>
                <button
                  className="adm-btn adm-btn-primary adm-btn-sm arb-exec"
                  onClick={() => onExecute(r.id)}
                  disabled={executingId === r.id}
                >
                  {executingId === r.id ? (
                    <><span className="arb-spinner" />Filling…</>
                  ) : (
                    <><AdmIcon name="zap" size={11} />Execute</>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Cross-venue table ─────────────────────────────────────────────── */

function CrossTable({ rows, minSpread }) {
  if (rows.length === 0) {
    return (
      <div className="arb-empty">
        <AdmIcon name="alert" size={28} />
        <p className="arb-empty-title">No cross-venue spread at {minSpread}%+ right now.</p>
        <p className="arb-empty-sub">Both venues are pricing these markets in line. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="adm-table-wrap arb-table-wrap">
      <table className="adm-table arb-table">
        <thead>
          <tr>
            <th>Market pair · Polymarket ↔ Kalshi</th>
            <th className="col-num">Poly YES</th>
            <th className="col-num">Kalshi YES</th>
            <th className="col-num">Spread</th>
            <th>Direction</th>
            <th style={{ width: 140 }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <div className="arb-pair">
                  <span className="arb-pair-venue">
                    <span className="arb-venue-dot" data-venue="poly" /> {r.poly}
                  </span>
                  <span className="arb-pair-venue arb-pair-venue-sub">
                    <span className="arb-venue-dot" data-venue="kal" /> {r.kal}
                  </span>
                </div>
              </td>
              <td className="col-mono col-num">${r.polyYes.toFixed(3)}</td>
              <td className="col-mono col-num">${r.kalYes.toFixed(3)}</td>
              <td className={`col-mono col-num arb-margin ${marginColorClass(r.spread)}`}>
                {r.spread.toFixed(1)}%
              </td>
              <td className="arb-direction" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.dir}</td>
              <td>
                <div className="arb-conf">
                  <span className="arb-conf-num mono">{Math.round(r.conf * 100)}%</span>
                  <div className="arb-conf-bar">
                    <span
                      className={`arb-conf-fill ${r.conf >= 0.8 ? 'is-gain' : r.conf >= 0.6 ? 'is-warn' : 'is-loss'}`}
                      style={{ width: `${r.conf * 100}%` }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
