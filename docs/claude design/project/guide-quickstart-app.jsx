/* Guide — 5-Minute Quickstart */
const TOC = [
  { id: 'signup', text: 'Create your account', level: 2 },
  { id: 'no-code', text: 'No-code, for real?', level: 2 },
  { id: 'link', text: 'Link your wallet', level: 2 },
  { id: 'template', text: 'Pick a template', level: 2 },
  { id: 'paper', text: 'Paper trade first', level: 2 },
  { id: 'review', text: 'Review & enable', level: 2 },
  { id: 'next', text: "What's next", level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="quickstart"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Get started' }, { label: 'Quickstart' }]}
      prev={{ title: 'Welcome', href: 'Guide.html' }}
      next={{ title: 'Strategy builder', href: 'Guide-Strategy-Builder.html' }}
    >
      <h1>The 5-minute quickstart</h1>
      <p className="docs-lede">If this is your first time, follow this page top to bottom. By the end you'll have a running strategy placing paper trades against live markets. No code, no credit card.</p>

      <h2 id="signup">1 — Create your account</h2>
      <p>Head to <a href="Pricing.html">polyforge.app/signup</a>. Free tier is fine for everything in this guide — you can upgrade later when you're ready to go live.</p>
      <Callout type="tip" title="Use a real email">We send fill alerts and security notices to this address. A burner inbox is fine, but make sure you can actually check it.</Callout>

      <h2 id="no-code">2 — Yes, really, no code</h2>
      <p>Polyforge has two faces. Developers use our SDKs. Everyone else uses the visual <strong>Strategy Builder</strong> — a canvas where you drag blocks and connect them. That's what this guide covers. If you can use a spreadsheet, you can use Polyforge.</p>

      <h2 id="link">3 — Link your Polymarket wallet</h2>
      <p>From the dashboard, click <strong>Settings → Venues → Connect Polymarket</strong>. You'll be redirected to Polymarket to approve a read-only connection. You can upgrade this to trade access later — for now, read-only is enough to build and backtest strategies.</p>
      <Callout type="warn" title="We never hold your keys">Polyforge connects to your wallet via Polymarket's official OAuth flow. Your private keys stay on your device. Revoke access any time from your Polymarket settings.</Callout>

      <h2 id="template">4 — Pick a template</h2>
      <p>The dashboard home tab shows six starter strategies. Each one is a working strategy you can clone and tweak:</p>
      <ul>
        <li><strong>EMA crossover</strong> — the classic trend follower</li>
        <li><strong>Mean reversion</strong> — buy dips, sell rips</li>
        <li><strong>Copy whale</strong> — mirror a single top trader</li>
        <li><strong>Resolution hunter</strong> — buy tight-spread markets near resolution</li>
        <li><strong>New-market sniper</strong> — post liquidity on fresh markets</li>
        <li><strong>Range bot</strong> — quote both sides inside a band</li>
      </ul>
      <p>Click <strong>Clone</strong> on any of them. The builder opens with the strategy already wired up. You don't need to understand every block yet — just hit <strong>Run</strong> to move to the next step.</p>

      <h2 id="paper">5 — Paper trade first</h2>
      <p>When you hit Run for the first time, you'll see a dialog asking <strong>Paper or Live?</strong> Always pick paper on day one. It's identical to live trading — same data, same fills, same logs — but uses a simulated $10,000 instead of your real balance.</p>
      <Callout type="tip" title="Paper for at least a week">Every serious Polyforge user paper-trades a new strategy for at least 5 market days before going live. The first day will look great. The fifth will tell you the truth.</Callout>

      <h2 id="review">6 — Review & enable</h2>
      <p>The strategy is now running. Watch the <strong>Live</strong> tab for a few minutes. Every time a signal fires, you'll see a row appear in the fills table. Click any fill to see exactly what the strategy was looking at when it decided to buy or sell.</p>
      <p>Once you're ready for real money — and not a day sooner — <a href="Guide-Going-Live.html">the Going Live guide</a> walks you through the handoff safely.</p>

      <h2 id="next">What to read next</h2>
      <ul>
        <li><a href="Guide-Strategy-Builder.html">Strategy builder →</a> — how blocks and wires actually work</li>
        <li><a href="Guide-Backtest.html">Backtesting →</a> — replay your strategy against 2 years of history</li>
        <li><a href="Guide-Whales.html">Whale dashboard →</a> — find and follow the best traders</li>
      </ul>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
