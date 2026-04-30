/* Guide — Whale dashboard */
const TOC = [
  { id: 'what', text: 'What is a whale?', level: 2 },
  { id: 'finding', text: 'Finding whales worth following', level: 2 },
  { id: 'profile', text: 'The whale profile', level: 2 },
  { id: 'copy', text: 'Copy trading', level: 2 },
  { id: 'cohorts', text: 'Cohorts & custom lists', level: 2 },
  { id: 'alerts', text: 'Whale alerts', level: 2 },
  { id: 'risks', text: 'The risks of copying', level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="whales"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Using Polyforge' }, { label: 'Whale dashboard' }]}
      prev={{ title: 'Strategy builder', href: 'Guide-Strategy-Builder.html' }}
      next={{ title: 'Backtesting', href: 'Guide-Backtest.html' }}
    >
      <h1>The whale dashboard</h1>
      <p className="docs-lede">Prediction markets are small enough that you can actually see who the best traders are and what they're doing — in real time. The whale dashboard is where you find them and, if you want, mirror their moves.</p>

      <h2 id="what">What is a whale?</h2>
      <p>We call a wallet a "whale" if it meets two thresholds: <strong>volume</strong> (at least $100k traded in the last 90 days) and <strong>edge</strong> (positive risk-adjusted return over the same window). About 2,300 wallets qualify at any given time across Kalshi and Polymarket. The top 500 of those — ranked by a composite of consistency, size, and category coverage — are who we surface by default.</p>

      <h2 id="finding">Finding whales worth following</h2>
      <p>The dashboard's main table is sortable by everything: 7-day P&L, 30-day P&L, win rate, average bet size, category specialty. Start by filtering for the categories you care about. A politics-only whale probably isn't useful to you if you trade crypto markets.</p>
      <Callout type="tip" title="Don't chase last week's leader">The wallet that's up 40% this week is almost always the wallet that will be down 40% next week. Look for whales with <strong>12+ months of positive risk-adjusted returns</strong>, not a single hot streak.</Callout>

      <h2 id="profile">The whale profile</h2>
      <p>Click any wallet to open its profile. You'll see:</p>
      <ul>
        <li><strong>Equity curve</strong> — their P&L over time, with drawdowns called out</li>
        <li><strong>Open positions</strong> — everything they currently hold, with entry price and size</li>
        <li><strong>Recent trades</strong> — live feed, updated every few seconds</li>
        <li><strong>Category breakdown</strong> — where they make money vs. where they lose</li>
        <li><strong>Style tags</strong> — "mean reverter", "news trader", "resolution hunter", etc.</li>
      </ul>

      <h2 id="copy">Copy trading</h2>
      <p>From a whale's profile, click <strong>Copy this wallet</strong>. You'll get a dialog with three settings:</p>
      <ul>
        <li><strong>Scale</strong> — how big your trades are relative to theirs. 0.1 means you bet 10% of what they bet. Never set this to 1.0 unless you have as much capital as they do.</li>
        <li><strong>Categories</strong> — which markets to copy. Default is all. If a whale trades both politics and weather and you only care about politics, uncheck weather.</li>
        <li><strong>Max per trade</strong> — a hard cap in dollars. Prevents a whale's oversized bet from wiping you out.</li>
      </ul>
      <p>Click <strong>Create strategy</strong>. Polyforge spins up a ready-made copy strategy in your account — running in paper mode by default.</p>
      <Callout type="warn" title="Always paper first">Even copying a great whale, you should run in paper for a week. Fills happen at slightly different prices in your account than in theirs, and that gap can turn a winner into a loser.</Callout>

      <h2 id="cohorts">Cohorts & custom lists</h2>
      <p>A <strong>cohort</strong> is a group of whales you copy together. Polyforge comes with several built-in cohorts (Top 10, Crypto specialists, Politics veterans). On the Team plan you can create custom cohorts — for example, "sports whales with 1+ year of history and Kelly sizing under 5%".</p>

      <h2 id="alerts">Whale alerts</h2>
      <p>You don't have to copy a whale to benefit from watching one. From any profile, click the bell icon and pick a trigger:</p>
      <ul>
        <li><strong>Any trade</strong> over $10k</li>
        <li><strong>New position</strong> in a market you care about</li>
        <li><strong>Position closed</strong> — especially useful for long-held bets</li>
      </ul>
      <p>Alerts arrive via email, Discord webhook, Telegram, or push notification. Most users wire them to a private Discord channel and scan it with coffee.</p>

      <h2 id="risks">The risks of copying</h2>
      <p>Copy trading feels like a free lunch. It is not. Three things to keep in mind:</p>
      <ul>
        <li><strong>Slippage gap:</strong> whales often move markets. By the time their fill appears on-chain and your copy strategy sees it, the price has moved against you.</li>
        <li><strong>Size mismatch:</strong> a whale betting 1% of their $5M bankroll is risking $50k. You copying at 0.1 scale risk $5k — but that might be 50% of YOUR bankroll.</li>
        <li><strong>Style drift:</strong> a whale that made money in 2024 isn't necessarily the same trader in 2026. Check their recent edge, not just their all-time record.</li>
      </ul>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
