/* Guide — Glossary */
const TERMS = [
  ['Backtest', 'Replaying a strategy against historical market data to see how it would have performed. Cheap, fast, and easy to fool yourself with.'],
  ['Bankroll', 'The amount of money allocated to a strategy. All position sizing is relative to bankroll, not your total wallet balance.'],
  ['Block', 'A single unit of strategy logic in the visual builder. Sources, indicators, filters, and actions are all blocks.'],
  ['Cohort (whale)', 'A group of whale wallets you track or copy as a set. E.g. "Top 10 politics whales".'],
  ['Daily loss cap', 'The percentage drop after which a strategy auto-pauses. Set this before going live.'],
  ['Drawdown', 'A peak-to-trough decline in equity. "Max drawdown" is the worst one the strategy has ever seen.'],
  ['EMA (Exponential Moving Average)', 'A moving average that weights recent prices more heavily. "Fast" and "slow" EMAs crossing is a classic trend signal.'],
  ['Fill', 'When an order actually executes. A $100 buy that gets 70% filled at $0.42 produced a $70 fill.'],
  ['IOC (Immediate-or-Cancel)', 'An order that fills whatever it can right now and cancels the rest. Good for avoiding stale limit orders.'],
  ['Kelly criterion', 'A math-optimal position-sizing formula. In theory, maximally aggressive. In practice, halve it or quarter it.'],
  ['Limit order', 'An order that will only fill at your specified price or better. Sits on the book until filled or cancelled.'],
  ['Liquidity', 'How much money can move in or out of a market without moving the price. Thin markets have low liquidity.'],
  ['Live mode', 'The strategy uses real money. The opposite of paper mode.'],
  ['MCP (Model Context Protocol)', 'The open standard for giving LLMs typed access to tools and data. Polyforge ships an MCP server so Claude, Cursor, etc. can drive your account.'],
  ['Market order', 'An order that sweeps the best available prices on the book until filled. Fast but pays the spread.'],
  ['Paper mode', 'Simulated trading with fake money. Uses the same data, same logic, same timing as live — just no real orders.'],
  ['Polymarket', 'A large prediction-market venue settling in USDC on Polygon. Polyforge\'s primary venue.'],
  ['Position', 'An open holding in a market. "Long NO on FED-MAY" means you\'ve bought NO contracts.'],
  ['Prediction market', 'A market where you bet on the outcome of a real-world event. Contracts settle at $1 (yes) or $0 (no).'],
  ['Resolution', 'When a market ends and its outcome becomes official. YES contracts pay $1; NO contracts pay $0 (or vice versa).'],
  ['Scale (copy)', 'How big your copy trades are relative to the whale\'s. 0.1 means 10% of their size.'],
  ['Sharpe ratio', 'Risk-adjusted return. Higher is better. Above 1.0 is decent; above 2.0, be suspicious.'],
  ['Signal', 'A condition your strategy is watching for. "EMA cross up" is a signal.'],
  ['Slippage', 'The difference between the price you expected and the price you got. Bigger orders + thinner markets = more slippage.'],
  ['Strategy', 'A complete set of rules that decide when to buy, sell, or hold. In the builder, a strategy is a canvas full of connected blocks.'],
  ['Spread', 'The gap between the best bid and the best ask. Tight spreads are cheap to trade.'],
  ['Venue', 'A prediction-market exchange. Polymarket and Kalshi are venues.'],
  ['Whale', 'A wallet with significant trading volume and consistent edge. Polyforge surfaces the top 500 by default.'],
  ['YES / NO contract', 'The two sides of a binary prediction market. YES pays $1 if the event happens; NO pays $1 if it doesn\'t.'],
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="glossary"
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Get started' }, { label: 'Glossary' }]}
      prev={{ title: 'Security & 2FA', href: 'Guide-Security.html' }}
      next={{ title: 'FAQ', href: 'Guide-FAQ.html' }}
    >
      <h1>Glossary</h1>
      <p className="docs-lede">Every term you'll encounter in Polyforge, defined in plain English. Alphabetical. Bookmark it — you'll come back.</p>
      <dl style={{margin:'32px 0',display:'flex',flexDirection:'column',gap:18}}>
        {TERMS.map(([term, def], i) => (
          <div key={i} style={{paddingBottom:18,borderBottom:'1px solid var(--border-subtle)'}}>
            <dt style={{fontSize:16,fontWeight:600,color:'var(--text-primary)',marginBottom:6}}>{term}</dt>
            <dd style={{margin:0,color:'var(--text-secondary)',fontSize:14,lineHeight:1.6}}>{def}</dd>
          </div>
        ))}
      </dl>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
