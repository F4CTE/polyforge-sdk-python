/* Polyforge — Wallet & funding */

const TX = [
  { t: '2026-04-29 12:14', kind: 'deposit',  src: 'USDC · Coinbase',  amt: '+$2,000.00', state: 'cleared',   hash: '0x4f...c81a' },
  { t: '2026-04-28 09:02', kind: 'fee',      src: 'Polymarket · gas',  amt: '−$1.42',     state: 'cleared',   hash: '—' },
  { t: '2026-04-26 18:47', kind: 'profit',   src: 'fed-rate-cut-tracker', amt: '+$48.20', state: 'cleared',   hash: '—' },
  { t: '2026-04-25 14:20', kind: 'withdraw', src: 'USDC · Bank ****4421', amt: '−$500.00', state: 'pending',   hash: '0x9b...e7f0' },
  { t: '2026-04-24 11:08', kind: 'deposit',  src: 'USDC · Coinbase',  amt: '+$1,500.00', state: 'cleared',   hash: '0x21...aab3' },
  { t: '2026-04-22 22:31', kind: 'profit',   src: 'cpi-cool-fade',     amt: '+$132.40',   state: 'cleared',   hash: '—' },
  { t: '2026-04-19 03:22', kind: 'loss',     src: 'oscars-favorite-hedge', amt: '−$58.00', state: 'cleared',  hash: '—' },
];

const txKindMeta = {
  deposit:  { icon: 'arrow-down', color: 'var(--gain-text)',  label: 'Deposit' },
  withdraw: { icon: 'arrow-up',   color: 'var(--text-secondary)', label: 'Withdraw' },
  profit:   { icon: 'trending',   color: 'var(--gain-text)',  label: 'Profit' },
  loss:     { icon: 'trending',   color: 'var(--loss-text)',  label: 'Loss' },
  fee:      { icon: 'minus',      color: 'var(--text-tertiary)', label: 'Fee' },
};

function App() {
  const [view, setView] = React.useState('overview');
  return (
    <UsrShell active="wallet" title="Wallet" actions={
      <>
        <button className="adm-btn adm-btn-secondary"><AdmIcon name="arrow-up" size={12} />Withdraw</button>
        <button className="adm-btn adm-btn-primary"><AdmIcon name="arrow-down" size={12} />Deposit</button>
      </>
    }>
      <AdmPageHead title="Wallet" subtitle="Funding, transfers, and account ledger across paper and live wallets." />

      {/* Account balance hero */}
      <div className="adm-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Total balance</span>
              <span className="adm-pill is-gain has-dot is-pulse" style={{ fontSize: 9.5, height: 16 }}>live</span>
            </div>
            <div className="mono tabnum" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1, marginBottom: 10, letterSpacing: '-0.02em' }}>$12,847.42</div>
            <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
              <span>Available <span className="mono tabnum" style={{ color: 'var(--text-primary)', fontWeight: 500, marginLeft: 4 }}>$8,806.42</span></span>
              <span style={{ width: 1, background: 'var(--border-subtle)' }} />
              <span>Deployed <span className="mono tabnum" style={{ color: 'var(--text-primary)', fontWeight: 500, marginLeft: 4 }}>$4,041.00</span></span>
              <span style={{ width: 1, background: 'var(--border-subtle)' }} />
              <span>30d P&L <span className="mono tabnum" style={{ color: 'var(--gain-text)', fontWeight: 500, marginLeft: 4 }}>+$1,847.20 (16.8%)</span></span>
            </div>
          </div>
          <div>
            <UsrEquityCurve points={[10800, 11020, 10980, 11250, 11400, 11680, 11420, 11890, 12100, 12340, 12290, 12520, 12700, 12847]} height={72} kind="gain" label="+18.9%" />
          </div>
        </div>

        {/* Sub-balances */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: 'Polymarket', bal: '$4,892.18', curr: 'USDC', color: '#4F6EF7' },
            { label: 'Kalshi',     bal: '$3,914.24', curr: 'USD',  color: '#16A34A' },
            { label: 'Paper',      bal: '$50,000.00', curr: 'PAPER', color: 'var(--accent-default)' },
            { label: 'In transit', bal: '$500.00', curr: 'pending', color: 'var(--warn)' },
          ].map((b, i) => (
            <div key={i} style={{ padding: '0 16px', borderLeft: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{b.label}</span>
              </div>
              <div className="mono tabnum" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{b.bal}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, letterSpacing: '0.04em' }}>{b.curr}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-grid-3" style={{ marginBottom: 20 }}>
        {[
          { icon: 'arrow-down', title: 'Deposit USDC',     body: 'From Coinbase, Binance, MetaMask, or any chain. Avg confirmation 2 min.' },
          { icon: 'dollar',     title: 'Deposit USD (ACH)', body: 'For Kalshi balance. Free, takes 1–3 business days.' },
          { icon: 'arrow-up',   title: 'Withdraw funds',    body: 'To linked bank or crypto wallet. Settlement within 24 hours.' },
        ].map(c => (
          <button
            key={c.title}
            className="adm-card"
            style={{ padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              display: 'grid', placeItems: 'center', color: 'var(--accent-text)'
            }}>
              <AdmIcon name={c.icon} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</span>
                <AdmIcon name="arrow-right" size={12} className="adm-icon-tertiary" />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{c.body}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="adm-table-wrap">
        <div className="adm-table-tools">
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Transactions</h3>
          <div className="adm-filter-group" style={{ marginLeft: 'auto' }}>
            <button className={`adm-filter${view === 'overview' ? ' is-active' : ''}`} onClick={() => setView('overview')}>All <span className="count">{TX.length}</span></button>
            <button className="adm-filter">Deposits <span className="count">2</span></button>
            <button className="adm-filter">Withdrawals <span className="count">1</span></button>
            <button className="adm-filter">P&L <span className="count">3</span></button>
          </div>
          <button className="adm-btn adm-btn-ghost"><AdmIcon name="download" size={12} />Export</button>
        </div>
        <table className="adm-table">
          <thead><tr><th>Time</th><th>Type</th><th>Source</th><th>Amount</th><th>State</th><th>Tx hash</th></tr></thead>
          <tbody>
            {TX.map((t, i) => {
              const meta = txKindMeta[t.kind];
              return (
                <tr key={i}>
                  <td className="col-mono col-tertiary">{t.t}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: meta.color, fontWeight: 500, fontSize: 11.5 }}>
                      <AdmIcon name={meta.icon} size={12} />{meta.label}
                    </div>
                  </td>
                  <td className="col-secondary">{t.src}</td>
                  <td className="col-mono col-num" style={{ color: meta.color, fontWeight: 600 }}>{t.amt}</td>
                  <td>
                    <span className={`adm-pill ${t.state === 'pending' ? 'is-warn' : 'is-gain'} has-dot`} style={{ height: 18, fontSize: 10 }}>{t.state}</span>
                  </td>
                  <td className="col-mono col-tertiary">{t.hash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="adm-table-foot">7 transactions · last 30 days · net <span style={{ color: 'var(--gain-text)' }}>+$3,121.18</span></div>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
