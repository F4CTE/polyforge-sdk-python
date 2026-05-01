/* Polyforge — Whales · Heatmap
   Visualize whale concentration by market and category. */

const HM_CATEGORIES = ['Politics', 'Crypto', 'Markets', 'Sports', 'Tech', 'Science'];

// 6x8 heatmap — categories x time buckets (last 8 weeks)
const HM_DATA = [
  // Politics
  [12, 18, 22, 31, 42, 38, 48, 64],
  // Crypto
  [28, 32, 38, 42, 48, 54, 62, 78],
  // Markets
  [8,  10, 14, 18, 22, 24, 28, 34],
  // Sports
  [22, 18, 14, 12, 28, 38, 42, 24],
  // Tech
  [18, 24, 28, 32, 36, 38, 42, 52],
  // Science
  [4,  6,  8,  10, 12, 14, 16, 18],
];
const HM_WEEKS = ['8w', '7w', '6w', '5w', '4w', '3w', '2w', '1w'];
const HM_MAX = 78;

const HM_HOTSPOTS = [
  { market: 'FED-CUT-JUL',     cat: 'Politics', whales: 28, vol: '$842K',  delta: '+14',  hot: true },
  { market: 'BTC-150K-DEC',    cat: 'Crypto',   whales: 24, vol: '$1.2M',  delta: '+8',   hot: true },
  { market: 'ELEC28-DEM',      cat: 'Politics', whales: 22, vol: '$640K',  delta: '+12',  hot: true },
  { market: 'ETH-ETF-Q3',      cat: 'Crypto',   whales: 18, vol: '$524K',  delta: '+4',   hot: false },
  { market: 'NVDA-EARN-Q1',    cat: 'Markets',  whales: 14, vol: '$284K',  delta: '+2',   hot: false },
  { market: 'NFL-SB-CHIEFS',   cat: 'Sports',   whales: 12, vol: '$218K',  delta: '-4',   hot: false },
  { market: 'TARIFF-CHN-25',   cat: 'Politics', whales: 10, vol: '$184K',  delta: '+6',   hot: false },
  { market: 'CPI-MAR-COOL',    cat: 'Markets',  whales: 8,  vol: '$142K',  delta: '+1',   hot: false },
];

function hmColor(v) {
  if (v < 8)  return 'rgba(96, 165, 250, 0.06)';
  if (v < 18) return 'rgba(96, 165, 250, 0.18)';
  if (v < 32) return 'rgba(96, 165, 250, 0.36)';
  if (v < 48) return 'rgba(96, 165, 250, 0.58)';
  if (v < 64) return 'rgba(96, 165, 250, 0.78)';
  return 'rgba(96, 165, 250, 0.96)';
}

function App() {
  return (
    <UsrShell active="whales" title="Whales · Heatmap" crumbs={[
      { label: 'Whales', href: 'App-Whales.html' },
      { label: 'Heatmap' },
    ]}>
      <AdmPageHead
        title="Whale activity heatmap"
        sub="Concentration of whale wallet activity across categories over the last 8 weeks · refreshed every 15 min"
      />

      {/* Tabs */}
      <div className="adm-tabs" style={{ marginBottom: 20 }}>
        <a href="App-Whales.html" className="adm-tab">Live feed</a>
        <a href="App-Whales-Heatmap.html" className="adm-tab is-active">Heatmap</a>
        <a href="App-Whales-Following.html" className="adm-tab">Following</a>
      </div>

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Active whales · 7d" value="184" delta="+22" deltaKind="gain" />
        <AdmStat label="Whale volume · 7d"  value="$8.4M" delta="+18%" deltaKind="gain" />
        <AdmStat label="Hottest category"   value="Crypto" delta="+62% w/w" deltaKind="gain" />
        <AdmStat label="Total tracked"      value="248" delta="+12 · 7d" deltaKind="gain" />
      </div>

      {/* Heatmap */}
      <div className="adm-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Activity by category × week</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cool</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[6, 18, 32, 48, 64, 78].map(v => (
                <div key={v} style={{ width: 14, height: 14, background: hmColor(v), borderRadius: 2 }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Hot</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(8, 1fr)', gap: 4 }}>
          <div></div>
          {HM_WEEKS.map(w => (
            <div key={w} className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 4 }}>{w}</div>
          ))}
          {HM_CATEGORIES.map((cat, ci) => (
            <React.Fragment key={cat}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{cat}</div>
              {HM_DATA[ci].map((v, wi) => (
                <div key={wi} title={`${cat} · ${HM_WEEKS[wi]} · ${v} whales`} style={{
                  height: 36, background: hmColor(v), borderRadius: 4, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: v > 40 ? '#fff' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}>{v}</div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Hotspots */}
      <div className="adm-card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Hotspots <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· markets with the most whale concentration this week</span>
          </h3>
        </div>
        <table className="adm-table">
          <thead><tr>
            <th style={{ width: 40 }}>#</th>
            <th>Market</th>
            <th>Category</th>
            <th style={{ textAlign: 'right' }}>Whales · 7d</th>
            <th style={{ textAlign: 'right' }}>Volume · 7d</th>
            <th style={{ textAlign: 'right' }}>Δ vs prev</th>
            <th style={{ width: 90 }}></th>
          </tr></thead>
          <tbody>
            {HM_HOTSPOTS.map((h, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{h.market}</span>
                    {h.hot && <span className="adm-pill is-warn" style={{ fontSize: 9 }}>HOT</span>}
                  </div>
                </td>
                <td><span className="adm-pill" style={{ fontSize: 10 }}>{h.cat}</span></td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{h.whales}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{h.vol}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: h.delta.startsWith('+') ? 'var(--gain-text)' : 'var(--loss-text)' }}>{h.delta}</td>
                <td><a href="App-Market-Detail.html" className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}>Open →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);