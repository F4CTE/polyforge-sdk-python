/* Guide — Paper to Live */
const TOC = [
  { id: 'modes', text: 'Paper vs. live', level: 2 },
  { id: '7-day', text: 'The 7-day rule', level: 2 },
  { id: 'limits', text: 'Risk limits — set them now', level: 2 },
  { id: 'checklist', text: 'The going-live checklist', level: 2 },
  { id: 'first-week', text: 'The first week live', level: 2 },
  { id: 'kill', text: 'The kill switch', level: 2 },
  { id: 'red-flags', text: 'Red flags to watch for', level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="live"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Using Polyforge' }, { label: 'Paper → Live' }]}
      prev={{ title: 'Backtesting', href: 'Guide-Backtest.html' }}
      next={{ title: 'Account & billing', href: 'Guide-Account-Billing.html' }}
    >
      <h1>Going from paper to live — safely</h1>
      <p className="docs-lede">Moving a strategy from paper to live is the highest-stakes button click in Polyforge. Get it right and you might make money. Get it wrong and you lose real money fast. This page is the safety harness.</p>

      <h2 id="modes">Paper vs. live, concretely</h2>
      <p>Paper mode uses the <em>exact same</em> data feed, the <em>exact same</em> execution logic, and the <em>exact same</em> code as live mode. The only difference: when live mode sends an order to the venue, paper mode writes it to a simulation. Every other thing — signals, timing, fees, slippage — is identical.</p>
      <Callout type="tip" title="If paper doesn't work, live won't either">The good news: if a strategy loses money in paper, you know to kill it before it costs you anything. The weird news: if paper looks great for one day, that's also not enough. You need a week.</Callout>

      <h2 id="7-day">The 7-day rule</h2>
      <p>Our house rule: <strong>every new live strategy runs in paper for at least 5 trading days first.</strong> Seven is better. Here's why:</p>
      <ul>
        <li>Day 1 is luck. Good or bad.</li>
        <li>Day 2–3 is when the first real signals appear. You'll find bugs.</li>
        <li>Day 4–5 is when your nerves get tested. Can you actually watch a 3% drawdown without killing the strategy?</li>
        <li>Day 6–7 is the data. If the strategy makes money across 7 days of real market conditions, you've learned something.</li>
      </ul>

      <h2 id="limits">Risk limits — set them now, not later</h2>
      <p>Before you flip the switch, set three limits. All three are in <strong>Strategy settings → Risk</strong>.</p>
      <ol>
        <li><strong>Max daily loss</strong> — auto-pauses the strategy if P&L drops this much in one day. Start with 2%. Never go above 5%.</li>
        <li><strong>Max position size</strong> — caps any single bet. A runaway loop buying 10x your bankroll is the single most common failure mode.</li>
        <li><strong>Max concurrent positions</strong> — limits how many markets you're in at once. Keeps you from accidentally spreading thin.</li>
      </ol>
      <Callout type="warn" title="Auto-pause is a friend">Pausing a strategy after a bad day isn't failure. It's the design working as intended. Review, diagnose, resume — or don't.</Callout>

      <h2 id="checklist">The going-live checklist</h2>
      <p>Before you click the "Go live" button, confirm all of these:</p>
      <ul>
        <li>☐ Backtest covers 12+ months with Sharpe above 1.0</li>
        <li>☐ Out-of-sample test survives the backtest pattern</li>
        <li>☐ Paper mode has run for at least 5 trading days</li>
        <li>☐ Paper P&L is within 15% of the backtest projection (if it's way better, something's wrong)</li>
        <li>☐ Risk limits are set — daily loss, position size, concurrent positions</li>
        <li>☐ You've funded the venue wallet (Polymarket or Kalshi) with the bankroll you said you would</li>
        <li>☐ Your venue API key has <strong>live:write</strong> scope enabled</li>
        <li>☐ You've bookmarked the kill switch (see below)</li>
      </ul>

      <h2 id="first-week">The first week live</h2>
      <p>Do less than you think. Don't tweak. Don't add a new strategy. Don't bump the bankroll. Just watch.</p>
      <p>Specifically: check the live dashboard at least twice a day for the first week. If something looks wrong — fills happening at weird prices, positions bigger than expected, logs full of errors — <strong>pause first, investigate second</strong>. Paused strategies don't lose money.</p>

      <h2 id="kill">The kill switch</h2>
      <p>Every strategy has a big red <strong>Stop all</strong> button in the top right. Click it and Polyforge does three things in under a second:</p>
      <ol>
        <li>Cancels every open order you have on every venue</li>
        <li>Stops the strategy from placing new orders</li>
        <li>Leaves your open positions alone (you close those manually — it's safer than bulk market-selling)</li>
      </ol>
      <p>There's also a global kill switch — <strong>⌘ + Shift + K</strong> — that stops every strategy you own at once. Use it when something is catastrophically wrong. You can always resume after.</p>

      <h2 id="red-flags">Red flags to watch for</h2>
      <ul>
        <li><strong>Fills look different from paper.</strong> A 5% difference is normal. A 20% difference means slippage is worse than expected — paper trade longer.</li>
        <li><strong>Error rate > 1%.</strong> One rejected order in a hundred is fine. One in ten is a connection or logic problem.</li>
        <li><strong>P&L is suspiciously good.</strong> Day one up 10%? Be skeptical, not excited. Something is probably wrong with your sizing.</li>
        <li><strong>You can't sleep.</strong> If the strategy is making you anxious, the position size is too big. Cut it in half.</li>
      </ul>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
