/* eslint-disable */
/* Changelog page — versioned timeline with filterable tags */

(() => {
  const { useState, useMemo } = React;

  // All entries; category keys: 'new' | 'improved' | 'fixed' | 'breaking'
  const ENTRIES = [
    {
      version: 'v1.5.0', date: '2026-04-22', title: 'Kalshi is live · multi-venue routing',
      highlighted: true,
      groups: {
        new: [
          <>Kalshi adapter ships as a first-class venue alongside Polymarket. Connect in Settings → Venues with a scoped API key.</>,
          <>Strategies can now target both venues with <code>.scope(["polymarket", "kalshi"])</code>. Bankroll is enforced per-venue against each live balance.</>,
          <>Cross-venue market search in the terminal: type a topic, see matching contracts from both sides with spread and liquidity flags.</>,
          <>Whale feed picks up Kalshi account flows (for the subset of traders who've opted into public profiles).</>,
        ],
        improved: [
          <>Order router falls back from Polymarket to Kalshi (or vice-versa) on venue-side errors — strategies stay live through partial outages.</>,
          <>System status popover split: Polymarket and Kalshi are tracked as separate rows.</>,
          <>Docs: every <code>marketId</code> example now shows both <code>polymarket:</code> and <code>kalshi:</code> prefixes.</>,
        ],
        fixed: [
          <>Blocks referencing a venue that wasn't connected raised a silent error. They now fail loudly at strategy save time.</>,
        ],
      },
    },
    {
      version: 'v1.4.2', date: '2026-04-18', title: 'Rust SDK 0.3 · paper-trading parity',
      highlighted: true,
      groups: {
        new: [
          <>Rust SDK <code>v0.3.0</code> with <code>tokio</code> runtime and <code>rustls</code>. Full parity with TypeScript SDK.</>,
          <>Paper-trading now shares the exact execution path as live mode — no more "it worked in paper."</>,
        ],
        improved: [
          <>Backtest engine ~2.3× faster on strategies with 8+ blocks. Rewrote the condition solver.</>,
          <>Whale-feed latency down from 480ms to 180ms at p95.</>,
        ],
        fixed: [
          <>Safari crashed on the block editor when dragging an <code>ema_cross</code> block past the viewport edge.</>,
          <>Backtest progress bar could stall at 97% if the market had no trades in the final 30s window.</>,
        ],
      },
    },
    {
      version: 'v1.4.0', date: '2026-04-02', title: 'Copy trading · live',
      groups: {
        new: [
          <>Copy-trade any whale wallet with Kelly, proportional, or fixed sizing.</>,
          <>Per-wallet alerts via webhook, Discord, or Telegram.</>,
        ],
        improved: [
          <>Builder attribution headers (<code>X-PF-Builder</code>) are now HMAC-signed by default.</>,
        ],
      },
    },
    {
      version: 'v1.3.4', date: '2026-03-21', title: 'MCP server · stable',
      groups: {
        new: [
          <>MCP server exits beta. 11 tools exposed for agent-driven strategy construction.</>,
          <>Natural-language prompt → strategy JSON via Claude, GPT, or local models.</>,
        ],
        fixed: [
          <>Strategy JSON schema now validates versions <code>v1</code> through <code>v3</code> simultaneously.</>,
        ],
      },
    },
    {
      version: 'v1.3.0', date: '2026-02-14', title: 'Whale intelligence beta',
      groups: {
        new: [
          <>Top-500 wallet tracker with realized PnL, win-rate, avg hold-time.</>,
          <>"Move money" alerts: trigger a strategy when a whale opens/closes a position of size N.</>,
        ],
        improved: [
          <>Strategy marketplace rebrand — cleaner card layout, strategy preview without signup.</>,
        ],
        fixed: [
          <>Order-fill latency dashboard was showing bucketed averages instead of p50/p95.</>,
        ],
      },
    },
    {
      version: 'v1.2.0', date: '2026-01-08', title: 'Strategy marketplace',
      groups: {
        new: [
          <>Publish strategies publicly with opt-in rev share.</>,
          <>Import any <code>.polyforge</code> JSON from a URL or file.</>,
        ],
        breaking: [
          <>Legacy <code>strategy.config.yaml</code> format removed. Use <code>polyforge migrate</code> to convert.</>,
        ],
      },
    },
    {
      version: 'v1.1.2', date: '2025-12-03', title: 'Circuit breakers',
      groups: {
        new: [
          <>Global kill-switch: pause all strategies on a given market with one click.</>,
          <>Per-strategy daily loss limits.</>,
        ],
        improved: [
          <>2FA now supports TOTP + hardware keys (WebAuthn / Yubikey).</>,
        ],
      },
    },
    {
      version: 'v1.1.0', date: '2025-11-14', title: 'OpenAPI 3.1',
      groups: {
        new: [
          <>Full OpenAPI 3.1 spec at <code>/openapi.yaml</code>. 84 operations, 23 schemas.</>,
          <>Webhooks: <code>ORDER_FILLED</code>, <code>STRATEGY_PAUSED</code>, <code>BACKTEST_PROGRESS</code>.</>,
        ],
        fixed: [
          <>Rate-limit headers were off by one bucket on the WebSocket side.</>,
        ],
      },
    },
    {
      version: 'v1.0.0', date: '2025-11-01', title: 'Polyforge 1.0 — public beta',
      highlighted: true,
      groups: {
        new: [
          <>Out of private alpha. Open signups. 12-month free builder tier.</>,
          <>TypeScript SDK <code>v1.0</code> and Python SDK <code>v1.0</code> shipped.</>,
          <>Strategy builder, backtest, paper trading, live execution, analytics — all in one product.</>,
        ],
      },
    },
  ];

  const CATEGORIES = [
    { key: 'all',      label: 'All changes', count: (e) => true },
    { key: 'new',      label: 'New',      color: 'new' },
    { key: 'improved', label: 'Improved', color: 'improved' },
    { key: 'fixed',    label: 'Fixed',    color: 'fixed' },
    { key: 'breaking', label: 'Breaking', color: 'breaking' },
  ];

  const GROUP_ORDER = ['breaking', 'new', 'improved', 'fixed'];
  const GROUP_LABELS = { new: 'New', improved: 'Improved', fixed: 'Fixed', breaking: 'Breaking' };

  function App() {
    const [filter, setFilter] = useState('all');

    const visibleEntries = useMemo(() => {
      if (filter === 'all') return ENTRIES;
      return ENTRIES
        .map(e => {
          if (!e.groups[filter]) return null;
          return { ...e, groups: { [filter]: e.groups[filter] } };
        })
        .filter(Boolean);
    }, [filter]);

    return (
      <CompanyPage active="changelog">
        <CompanyPageHeader
          eyebrow="Changelog"
          title="What's new in Polyforge."
          lede="Every version since v1.0. Breaking changes are marked in red, because we owe you the warning."
          meta={[
            { label: 'Latest', value: 'v1.4.2' },
            { label: 'Release cadence', value: 'Every ~2 weeks' },
            { label: 'RSS', value: <a href="#" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>changelog.xml</a> },
          ]}
        />

        <CompanySection>
          <div className="changelog-filters">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                className={'chip chip-toggle' + (filter === c.key ? ' chip-active' : '')}
                onClick={() => setFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div>
            {visibleEntries.map((entry) => (
              <article key={entry.version} className={'changelog-entry' + (entry.highlighted ? ' highlighted' : '')}>
                <div className="changelog-meta">
                  <div className="changelog-version">
                    {entry.version}
                    {entry.highlighted && <span className="changelog-version-tag">Major</span>}
                  </div>
                  <div className="changelog-date">{entry.date}</div>
                </div>
                <div>
                  <h3 className="changelog-title">{entry.title}</h3>
                  {GROUP_ORDER.filter(g => entry.groups[g]).map(g => (
                    <div className="changelog-group" key={g}>
                      <div className={'changelog-group-label ' + g}>{GROUP_LABELS[g]}</div>
                      <ul>
                        {entry.groups[g].map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 40, textAlign: 'center', paddingTop: 32, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Earlier versions (v0.1 through v0.9) are archived.
            </div>
            <a className="btn btn-ghost btn-sm" href="#">View archived releases</a>
          </div>
        </CompanySection>
      </CompanyPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
