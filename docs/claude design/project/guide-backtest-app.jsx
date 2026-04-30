/* Guide — Backtesting */
const TOC = [
  { id: 'why', text: 'Why backtest?', level: 2 },
  { id: 'running', text: 'Running a backtest', level: 2 },
  { id: 'report', text: 'Reading the report', level: 2 },
  { id: 'metrics', text: 'The four metrics that matter', level: 2 },
  { id: 'pitfalls', text: 'Common pitfalls', level: 2 },
  { id: 'realistic', text: 'Realistic mode', level: 2 },
  { id: 'when-done', text: 'When is a backtest "done"?', level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="backtest"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Using Polyforge' }, { label: 'Backtesting' }]}
      prev={{ title: 'Whale dashboard', href: 'Guide-Whales.html' }}
      next={{ title: 'Paper → Live', href: 'Guide-Going-Live.html' }}
    >
      <h1>Backtesting, for humans</h1>
      <p className="docs-lede">A backtest replays your strategy against real market history — as if you'd been running it the whole time. It's the cheapest way to find out whether an idea is any good, and the easiest way to lie to yourself. This page covers both sides.</p>

      <h2 id="why">Why backtest?</h2>
      <p>You have an idea. "Buy when the fast moving average crosses the slow one." Does it make money? Lose money? Lose money only in election years? A backtest answers this in seconds — and costs nothing.</p>
      <p>The alternative is to paper-trade for six weeks to get a tiny sample of data. Backtesting compresses years into minutes.</p>

      <h2 id="running">Running a backtest</h2>
      <p>From any strategy in the builder, click <strong>Backtest</strong> in the top bar. You'll see four options:</p>
      <ul>
        <li><strong>Date range</strong> — defaults to the last 12 months. Longer is better, but old markets may not look like today's markets.</li>
        <li><strong>Bankroll</strong> — simulated starting balance. Match your real bankroll for realistic position sizing.</li>
        <li><strong>Realistic mode</strong> — on by default. Replays the actual order book so you get realistic slippage.</li>
        <li><strong>Include delisted markets</strong> — include markets that got pulled before resolution. Off by default.</li>
      </ul>
      <p>Click <strong>Run</strong>. A typical one-year backtest finishes in 10–60 seconds.</p>

      <h2 id="report">Reading the report</h2>
      <p>The report has three panels:</p>
      <ol>
        <li><strong>The equity curve</strong> at the top. A smooth line up-and-to-the-right is what you want. Big drops (drawdowns) are what you're trying to avoid.</li>
        <li><strong>The metrics grid</strong> in the middle. Sharpe, Sortino, Max Drawdown, Win Rate, and more. See below for what actually matters.</li>
        <li><strong>The trade log</strong> at the bottom. Every single simulated fill, clickable to see the market state at that moment.</li>
      </ol>

      <h2 id="metrics">The four metrics that matter</h2>
      <p>Polyforge shows you 14 metrics. Four of them are worth caring about:</p>
      <ul>
        <li><strong>Sharpe ratio</strong> — risk-adjusted return. Above 1.0 is decent. Above 2.0 is suspicious (probably overfit). Above 3.0 is almost certainly a bug.</li>
        <li><strong>Max drawdown</strong> — the biggest peak-to-trough loss. If your max drawdown is 40%, ask yourself: would I actually hold through losing 40%? Be honest.</li>
        <li><strong>Trades per month</strong> — too few and your sample is meaningless. Under 20/month usually isn't enough signal to trust.</li>
        <li><strong>Profit factor</strong> — gross wins divided by gross losses. Under 1.2 means you're barely covering fees. Over 1.5 is solid.</li>
      </ul>
      <Callout type="warn" title="Ignore win rate">A strategy that wins 90% of the time but loses 10x on the losers is a disaster. A strategy that wins 30% of the time but wins 5x on the winners prints money. Win rate on its own tells you nothing.</Callout>

      <h2 id="pitfalls">Common pitfalls</h2>
      <ul>
        <li><strong>Overfitting</strong> — tuning parameters until the backtest looks great. The cure: test on data you didn't tune on. Polyforge's "out-of-sample" toggle does this automatically.</li>
        <li><strong>Look-ahead bias</strong> — accidentally using future info. Polyforge prevents this at the block level, but it's still possible to contrive.</li>
        <li><strong>Survivorship bias</strong> — only testing on markets that resolved. If your strategy depends on a market existing, it's implicitly picking winners. Turn on "include delisted markets" to see.</li>
        <li><strong>Fees and slippage</strong> — easy to forget. Realistic mode handles this; if you turn it off, know why.</li>
      </ul>

      <h2 id="realistic">Realistic mode</h2>
      <p>With realistic mode on (the default), Polyforge replays the actual bid/ask book that existed at each moment — so your simulated orders get filled at the price they would have really gotten. This usually makes backtests look 10–30% worse than a naive simulation. That's good. That's the truth.</p>

      <h2 id="when-done">When is a backtest "done"?</h2>
      <p>A backtest is never "done" in the sense that you've proven the strategy works. It can only rule things out. A backtest is <strong>good enough</strong> when:</p>
      <ol>
        <li>It covers at least 12 months, ideally 24+</li>
        <li>It survives an out-of-sample test (data the strategy wasn't tuned on)</li>
        <li>The max drawdown is something you could actually stomach</li>
        <li>You understand why it works — not just that it does</li>
      </ol>
      <p>Meet all four and you're ready for paper trading. Not a step sooner.</p>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
