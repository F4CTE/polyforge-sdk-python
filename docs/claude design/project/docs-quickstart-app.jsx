/* Docs — Quickstart + Guides (concepts, backtesting, paper, live, alerts, first-strategy) */

// Syntax-highlighted code snippets (HTML strings, escaped for insertion via dangerouslySetInnerHTML)
const INSTALL_SNIPPETS = {
  ts: `<span class="tok-c"># npm</span>
npm install <span class="tok-s">@polyforge/sdk</span>

<span class="tok-c"># pnpm</span>
pnpm add <span class="tok-s">@polyforge/sdk</span>`,
  py: `<span class="tok-c"># pip</span>
pip install <span class="tok-s">polyforge</span>

<span class="tok-c"># uv</span>
uv add <span class="tok-s">polyforge</span>`,
  rs: `<span class="tok-c"># Cargo.toml</span>
<span class="tok-p">[dependencies]</span>
polyforge = <span class="tok-s">"0.3"</span>
tokio = <span class="tok-p">{</span> version = <span class="tok-s">"1"</span>, features = <span class="tok-p">[</span><span class="tok-s">"full"</span><span class="tok-p">]</span> <span class="tok-p">}</span>`,
  sh: `<span class="tok-c"># Download the CLI (macOS / Linux)</span>
curl -sSf <span class="tok-s">https://get.polyforge.app</span> | sh

<span class="tok-c"># Verify</span>
polyforge --version`,
};

const CONNECT_SNIPPETS = {
  ts: `<span class="tok-k">import</span> <span class="tok-p">{</span> <span class="tok-t">Client</span> <span class="tok-p">}</span> <span class="tok-k">from</span> <span class="tok-s">"@polyforge/sdk"</span><span class="tok-p">;</span>

<span class="tok-k">const</span> pf <span class="tok-p">=</span> <span class="tok-k">await</span> <span class="tok-t">Client</span><span class="tok-p">.</span><span class="tok-m">connect</span><span class="tok-p">(</span><span class="tok-p">{</span>
  apiKey<span class="tok-p">:</span> process<span class="tok-p">.</span>env<span class="tok-p">.</span><span class="tok-n">POLYFORGE_KEY</span><span class="tok-p">!,</span>
  venues<span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-s">"kalshi"</span><span class="tok-p">,</span> <span class="tok-s">"polymarket"</span><span class="tok-p">],</span>
<span class="tok-p">}</span><span class="tok-p">);</span>

console<span class="tok-p">.</span><span class="tok-m">log</span><span class="tok-p">(</span><span class="tok-k">await</span> pf<span class="tok-p">.</span><span class="tok-m">markets</span><span class="tok-p">.</span><span class="tok-m">list</span><span class="tok-p">(</span><span class="tok-p">))</span><span class="tok-p">;</span>`,
  py: `<span class="tok-k">import</span> polyforge <span class="tok-k">as</span> pf
<span class="tok-k">import</span> os

client <span class="tok-p">=</span> pf<span class="tok-p">.</span><span class="tok-m">Client</span><span class="tok-p">.</span><span class="tok-m">connect</span><span class="tok-p">(</span>
  api_key<span class="tok-p">=</span>os<span class="tok-p">.</span>environ<span class="tok-p">[</span><span class="tok-s">"POLYFORGE_KEY"</span><span class="tok-p">],</span>
  venues<span class="tok-p">=[</span><span class="tok-s">"kalshi"</span><span class="tok-p">,</span> <span class="tok-s">"polymarket"</span><span class="tok-p">],</span>
<span class="tok-p">)</span>

<span class="tok-k">print</span><span class="tok-p">(</span>client<span class="tok-p">.</span><span class="tok-m">markets</span><span class="tok-p">.</span><span class="tok-m">list</span><span class="tok-p">())</span>`,
  rs: `<span class="tok-k">use</span> polyforge<span class="tok-p">::</span><span class="tok-t">Client</span><span class="tok-p">;</span>

<span class="tok-p">#[</span>tokio<span class="tok-p">::</span>main<span class="tok-p">]</span>
<span class="tok-k">async fn</span> <span class="tok-f">main</span><span class="tok-p">()</span> <span class="tok-p">-&gt;</span> <span class="tok-t">anyhow</span><span class="tok-p">::</span><span class="tok-t">Result</span><span class="tok-p">&lt;()&gt;</span> <span class="tok-p">{</span>
  <span class="tok-k">let</span> pf <span class="tok-p">=</span> <span class="tok-t">Client</span><span class="tok-p">::</span><span class="tok-f">connect</span><span class="tok-p">(</span>
    std<span class="tok-p">::</span>env<span class="tok-p">::</span><span class="tok-f">var</span><span class="tok-p">(</span><span class="tok-s">"POLYFORGE_KEY"</span><span class="tok-p">)?,</span>
    <span class="tok-p">&amp;[</span><span class="tok-s">"kalshi"</span><span class="tok-p">,</span> <span class="tok-s">"polymarket"</span><span class="tok-p">],</span>
  <span class="tok-p">)</span><span class="tok-p">.</span><span class="tok-f">await</span><span class="tok-p">?;</span>

  <span class="tok-f">println!</span><span class="tok-p">(</span><span class="tok-s">"{:?}"</span><span class="tok-p">,</span> pf<span class="tok-p">.</span><span class="tok-f">markets</span><span class="tok-p">().</span><span class="tok-f">list</span><span class="tok-p">().</span><span class="tok-f">await</span><span class="tok-p">?);</span>
  <span class="tok-t">Ok</span><span class="tok-p">(())</span>
<span class="tok-p">}</span>`,
  sh: `curl <span class="tok-s">https://api.polyforge.app/v1/markets</span> \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span>`,
};

const STRATEGY_SNIPPETS = {
  ts: `<span class="tok-k">import</span> <span class="tok-p">{</span> <span class="tok-t">Strategy</span><span class="tok-p">,</span> <span class="tok-t">blocks</span> <span class="tok-p">}</span> <span class="tok-k">from</span> <span class="tok-s">"@polyforge/sdk"</span><span class="tok-p">;</span>

<span class="tok-k">const</span> strat <span class="tok-p">=</span> <span class="tok-k">new</span> <span class="tok-t">Strategy</span><span class="tok-p">(</span><span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-m">on</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">emaCross</span><span class="tok-p">(</span><span class="tok-p">{</span> fast<span class="tok-p">:</span> <span class="tok-n">12</span><span class="tok-p">,</span> slow<span class="tok-p">:</span> <span class="tok-n">48</span> <span class="tok-p">}))</span>
  <span class="tok-p">.</span><span class="tok-m">when</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">priceAbove</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">))</span>
  <span class="tok-p">.</span><span class="tok-m">do</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">buyKelly</span><span class="tok-p">(</span><span class="tok-p">{</span> edge<span class="tok-p">:</span> <span class="tok-n">0.03</span><span class="tok-p">,</span> maxBankroll<span class="tok-p">:</span> <span class="tok-n">0.25</span> <span class="tok-p">}));</span>

<span class="tok-c">// Paper-trade for a week before going live</span>
<span class="tok-k">await</span> strat<span class="tok-p">.</span><span class="tok-m">run</span><span class="tok-p">(</span><span class="tok-p">{</span> mode<span class="tok-p">:</span> <span class="tok-s">"paper"</span><span class="tok-p">,</span> duration<span class="tok-p">:</span> <span class="tok-s">"7d"</span> <span class="tok-p">}))</span><span class="tok-p">;</span>`,
  py: `<span class="tok-k">from</span> polyforge <span class="tok-k">import</span> <span class="tok-t">Strategy</span><span class="tok-p">,</span> blocks

strat <span class="tok-p">=</span> <span class="tok-p">(</span><span class="tok-t">Strategy</span><span class="tok-p">(</span><span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-m">on</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">ema_cross</span><span class="tok-p">(</span>fast<span class="tok-p">=</span><span class="tok-n">12</span><span class="tok-p">,</span> slow<span class="tok-p">=</span><span class="tok-n">48</span><span class="tok-p">))</span>
  <span class="tok-p">.</span><span class="tok-m">when</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">price_above</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">))</span>
  <span class="tok-p">.</span><span class="tok-m">do_</span><span class="tok-p">(</span>blocks<span class="tok-p">.</span><span class="tok-m">buy_kelly</span><span class="tok-p">(</span>edge<span class="tok-p">=</span><span class="tok-n">0.03</span><span class="tok-p">,</span> max_bankroll<span class="tok-p">=</span><span class="tok-n">0.25</span><span class="tok-p">)))</span>

<span class="tok-c"># Paper-trade for a week before going live</span>
strat<span class="tok-p">.</span><span class="tok-m">run</span><span class="tok-p">(</span>mode<span class="tok-p">=</span><span class="tok-s">"paper"</span><span class="tok-p">,</span> duration<span class="tok-p">=</span><span class="tok-s">"7d"</span><span class="tok-p">)</span>`,
  rs: `<span class="tok-k">use</span> polyforge<span class="tok-p">::{</span><span class="tok-t">Strategy</span><span class="tok-p">,</span> blocks<span class="tok-p">};</span>

<span class="tok-k">let</span> strat <span class="tok-p">=</span> <span class="tok-t">Strategy</span><span class="tok-p">::</span><span class="tok-f">new</span><span class="tok-p">(</span><span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">on</span><span class="tok-p">(</span>blocks<span class="tok-p">::</span><span class="tok-f">ema_cross</span><span class="tok-p">(</span><span class="tok-n">12</span><span class="tok-p">,</span> <span class="tok-n">48</span><span class="tok-p">))</span>
  <span class="tok-p">.</span><span class="tok-f">when</span><span class="tok-p">(</span>blocks<span class="tok-p">::</span><span class="tok-f">price_above</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">))</span>
  <span class="tok-p">.</span><span class="tok-f">do_</span><span class="tok-p">(</span>blocks<span class="tok-p">::</span><span class="tok-f">buy_kelly</span><span class="tok-p">(</span><span class="tok-n">0.03</span><span class="tok-p">,</span> <span class="tok-n">0.25</span><span class="tok-p">));</span>

strat<span class="tok-p">.</span><span class="tok-f">run</span><span class="tok-p">(</span><span class="tok-t">Mode</span><span class="tok-p">::</span><span class="tok-t">Paper</span><span class="tok-p">,</span> <span class="tok-s">"7d"</span><span class="tok-p">).</span><span class="tok-f">await</span><span class="tok-p">?;</span>`,
  sh: `polyforge strategy create eth-5k-crossover \\
  --block <span class="tok-s">"ema_cross(fast=12, slow=48)"</span> \\
  --filter <span class="tok-s">"price_above(0.55)"</span> \\
  --action <span class="tok-s">"buy_kelly(edge=0.03, max_bankroll=0.25)"</span> \\
  --mode paper --duration 7d`,
};

const BACKTEST_SNIPPETS = {
  ts: `<span class="tok-k">const</span> result <span class="tok-p">=</span> <span class="tok-k">await</span> strat<span class="tok-p">.</span><span class="tok-m">backtest</span><span class="tok-p">(</span><span class="tok-p">{</span>
  from<span class="tok-p">:</span> <span class="tok-s">"2025-01-01"</span><span class="tok-p">,</span>
  to<span class="tok-p">:</span> <span class="tok-s">"2025-12-31"</span><span class="tok-p">,</span>
  bankroll<span class="tok-p">:</span> <span class="tok-n">10_000</span><span class="tok-p">,</span>
<span class="tok-p">}</span><span class="tok-p">);</span>

console<span class="tok-p">.</span><span class="tok-m">log</span><span class="tok-p">(</span>result<span class="tok-p">.</span>sharpe<span class="tok-p">,</span> result<span class="tok-p">.</span>maxDrawdown<span class="tok-p">,</span> result<span class="tok-p">.</span>trades<span class="tok-p">.</span>length<span class="tok-p">);</span>
<span class="tok-c">// 1.84     0.12         342</span>`,
  py: `result <span class="tok-p">=</span> strat<span class="tok-p">.</span><span class="tok-m">backtest</span><span class="tok-p">(</span>
  from_<span class="tok-p">=</span><span class="tok-s">"2025-01-01"</span><span class="tok-p">,</span>
  to<span class="tok-p">=</span><span class="tok-s">"2025-12-31"</span><span class="tok-p">,</span>
  bankroll<span class="tok-p">=</span><span class="tok-n">10_000</span><span class="tok-p">,</span>
<span class="tok-p">)</span>
<span class="tok-k">print</span><span class="tok-p">(</span>result<span class="tok-p">.</span>sharpe<span class="tok-p">,</span> result<span class="tok-p">.</span>max_drawdown<span class="tok-p">,</span> <span class="tok-k">len</span><span class="tok-p">(</span>result<span class="tok-p">.</span>trades<span class="tok-p">))</span>
<span class="tok-c"># 1.84 0.12 342</span>`,
  rs: `<span class="tok-k">let</span> result <span class="tok-p">=</span> strat<span class="tok-p">.</span><span class="tok-f">backtest</span><span class="tok-p">()</span>
  <span class="tok-p">.</span><span class="tok-f">range</span><span class="tok-p">(</span><span class="tok-s">"2025-01-01"</span><span class="tok-p">,</span> <span class="tok-s">"2025-12-31"</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">bankroll</span><span class="tok-p">(</span><span class="tok-n">10_000</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">run</span><span class="tok-p">().</span><span class="tok-f">await</span><span class="tok-p">?;</span>

<span class="tok-f">println!</span><span class="tok-p">(</span><span class="tok-s">"{} {} {}"</span><span class="tok-p">,</span> result<span class="tok-p">.</span>sharpe<span class="tok-p">,</span> result<span class="tok-p">.</span>max_drawdown<span class="tok-p">,</span> result<span class="tok-p">.</span>trades<span class="tok-p">.</span><span class="tok-f">len</span><span class="tok-p">());</span>`,
  sh: `polyforge backtest eth-5k-crossover \\
  --from 2025-01-01 --to 2025-12-31 \\
  --bankroll 10000 --format json`,
};

const ALERTS_SNIPPETS = {
  ts: `strat<span class="tok-p">.</span><span class="tok-m">on</span><span class="tok-p">(</span><span class="tok-s">"fill"</span><span class="tok-p">,</span> <span class="tok-k">async</span> <span class="tok-p">(</span>trade<span class="tok-p">)</span> <span class="tok-p">=&gt;</span> <span class="tok-p">{</span>
  <span class="tok-k">await</span> pf<span class="tok-p">.</span>alerts<span class="tok-p">.</span><span class="tok-m">discord</span><span class="tok-p">(</span><span class="tok-p">{</span>
    webhook<span class="tok-p">:</span> process<span class="tok-p">.</span>env<span class="tok-p">.</span><span class="tok-n">DISCORD_URL</span><span class="tok-p">!,</span>
    content<span class="tok-p">:</span> <span class="tok-s">\`\${trade.side} \${trade.size} @ \${trade.price}\`</span><span class="tok-p">,</span>
  <span class="tok-p">}</span><span class="tok-p">);</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
  py: `<span class="tok-p">@</span>strat<span class="tok-p">.</span><span class="tok-m">on</span><span class="tok-p">(</span><span class="tok-s">"fill"</span><span class="tok-p">)</span>
<span class="tok-k">def</span> <span class="tok-f">notify</span><span class="tok-p">(</span>trade<span class="tok-p">):</span>
  pf<span class="tok-p">.</span>alerts<span class="tok-p">.</span><span class="tok-m">discord</span><span class="tok-p">(</span>
    webhook<span class="tok-p">=</span>os<span class="tok-p">.</span>environ<span class="tok-p">[</span><span class="tok-s">"DISCORD_URL"</span><span class="tok-p">],</span>
    content<span class="tok-p">=</span><span class="tok-s">f"{trade.side} {trade.size} @ {trade.price}"</span><span class="tok-p">,</span>
  <span class="tok-p">)</span>`,
  rs: `strat<span class="tok-p">.</span><span class="tok-f">on_fill</span><span class="tok-p">(|</span>trade<span class="tok-p">|</span> <span class="tok-k">async</span> <span class="tok-k">move</span> <span class="tok-p">{</span>
  pf<span class="tok-p">.</span><span class="tok-f">alerts</span><span class="tok-p">().</span><span class="tok-f">discord</span><span class="tok-p">(&amp;</span>webhook<span class="tok-p">,</span>
    <span class="tok-f">format!</span><span class="tok-p">(</span><span class="tok-s">"{:?} {} @ {}"</span><span class="tok-p">,</span> trade<span class="tok-p">.</span>side<span class="tok-p">,</span> trade<span class="tok-p">.</span>size<span class="tok-p">,</span> trade<span class="tok-p">.</span>price<span class="tok-p">)</span>
  <span class="tok-p">).</span><span class="tok-f">await</span><span class="tok-p">?;</span>
<span class="tok-p">}).</span><span class="tok-f">await</span><span class="tok-p">;</span>`,
  sh: `<span class="tok-c"># Trigger a Discord alert when a strategy fires</span>
polyforge alerts add \\
  --strategy eth-5k-crossover \\
  --event fill \\
  --target discord \\
  --url <span class="tok-s">https://discord.com/api/webhooks/...</span>`,
};

const TOC = [
  { id: 'install', text: '1. Install', level: 2 },
  { id: 'connect', text: '2. Connect a venue', level: 2 },
  { id: 'concepts', text: '3. Core concepts', level: 2 },
  { id: 'first-strategy', text: '4. Your first strategy', level: 2 },
  { id: 'backtesting', text: '5. Backtest it', level: 2 },
  { id: 'paper', text: '6. Paper trade it', level: 2 },
  { id: 'live', text: '7. Go live', level: 2 },
  { id: 'alerts', text: '8. Hook up alerts', level: 2 },
  { id: 'next', text: '9. Where to go next', level: 2 },
];

function QuickstartPage() {
  return (
    <DocsLayout
      activeId="quickstart"
      section="docs"
      toc={TOC}
      breadcrumbs={[{ label: 'Docs', href: 'Docs.html' }, { label: 'Getting started' }, { label: 'Quickstart' }]}
      next={{ title: 'SDK Reference', href: 'Docs-SDK.html' }}
    >
      <h1>Quickstart</h1>
      <p className="docs-lede">
        This guide takes you from zero to a live strategy in under fifteen minutes. By the end you'll have installed the SDK, connected a venue, written a strategy, backtested it on a year of historical data, paper-traded it, and pushed it live with Discord alerts.
      </p>

      <Callout title="Before you start">
        You need a Polyforge account and an API key. <a href="#">Create an account</a> if you haven't — free tier is fine for this tutorial.
      </Callout>

      <h2 id="install">1. Install the SDK</h2>
      <p>Polyforge ships as first-class libraries in TypeScript, Python, and Rust, plus a standalone CLI. Pick whichever you already know — they all talk to the same API.</p>
      <CodeBlock snippets={INSTALL_SNIPPETS} />

      <h2 id="connect">2. Connect a venue</h2>
      <p>Set your API key and tell the client which exchanges to route through. Polyforge never sees your venue credentials — you add them in the dashboard with trade-only scopes, and we reference them by handle.</p>
      <CodeBlock snippets={CONNECT_SNIPPETS} />
      <Callout type="tip" title="Where to put the key">
        In development, a <code>.env</code> file is fine. In production, use your secrets manager — Doppler, AWS Secrets Manager, 1Password CLI, whatever you already use.
      </Callout>

      <h2 id="concepts">3. Core concepts</h2>
      <p>Three things to understand before you write anything:</p>
      <ul>
        <li><strong>Strategy</strong> — a named pipeline of <code>.on()</code> signals, <code>.when()</code> filters, and <code>.do()</code> actions. Each strategy gets its own P&L, risk budget, and logs.</li>
        <li><strong>Block</strong> — a reusable function. Some are built in (<code>emaCross</code>, <code>priceAbove</code>, <code>buyKelly</code>). You can write your own in TypeScript and publish them to your team's library.</li>
        <li><strong>Venue</strong> — an exchange (Kalshi, Polymarket, Manifold soon). Strategies fan out to every connected venue by default; scope per-venue with <code>.scope(["kalshi"])</code>.</li>
      </ul>

      <h2 id="first-strategy">4. Your first strategy</h2>
      <p>We'll build the canonical "something's happening" detector: buy when the 12-candle EMA crosses above the 48-candle EMA, if the market is already priced above 55¢, sized by Kelly with a 3% edge assumption.</p>
      <CodeBlock snippets={STRATEGY_SNIPPETS} />
      <p>That <code>.run()</code> starts paper trading immediately. You can watch fills stream in the dashboard or tail <code>polyforge logs eth-5k-crossover -f</code>.</p>

      <h2 id="backtesting">5. Backtest it</h2>
      <p>Before you trust paper, trust history. The same strategy object can be replayed through any historical window — execution uses the same code path as live, so there's no "it worked in backtest" divergence.</p>
      <CodeBlock snippets={BACKTEST_SNIPPETS} />
      <Callout type="warn" title="Backtests lie about one thing">
        They assume you get filled at the historical price. For small orders this is fine. For size above ~0.5% of typical depth, use <code>realistic: true</code> to replay the order book and simulate slippage.
      </Callout>

      <h2 id="paper">6. Paper trade it</h2>
      <p>Paper mode runs against live market data with a simulated wallet. It's the same path as live — same WebSocket streams, same order router, same logging — just with fills handled locally instead of sent to the venue.</p>
      <p>We recommend at least a week of paper trading before you move to live, especially for strategies with fewer than 50 expected trades per week.</p>

      <h2 id="live">7. Go live</h2>
      <p>Change <code>mode: "paper"</code> to <code>mode: "live"</code>. That's it. But read this first:</p>
      <Callout type="warn" title="One-way door">
        Going live routes real orders to real exchanges with real money. There is no dry-run equivalent of a live fill. Confirm your bankroll is what you expect, your risk limits are set, and your alerts are wired up before flipping the switch.
      </Callout>
      <p>Polyforge enforces three guardrails on every strategy you deploy:</p>
      <ul>
        <li><strong>Max bankroll fraction</strong> — nothing risks more than you said it could. Default 25%.</li>
        <li><strong>Daily loss limit</strong> — strategy auto-pauses at -3% P&L for the day, resumes at midnight UTC.</li>
        <li><strong>Venue allowlist</strong> — an explicit list of venues the strategy can trade on. Typo a market ID and you'll see an error, not a position in SPX binary options.</li>
      </ul>

      <h2 id="alerts">8. Hook up alerts</h2>
      <p>Silent strategies are hard to trust. Attach listeners for <code>fill</code>, <code>error</code>, <code>breach</code>, or anything you care about, and fan them out to Discord, Telegram, Slack (Team plan), or a plain HTTP webhook.</p>
      <CodeBlock snippets={ALERTS_SNIPPETS} />

      <h2 id="next">9. Where to go next</h2>
      <p>You've shipped a strategy. Here's what to read next:</p>
      <ul>
        <li><a href="Docs-SDK.html">SDK Reference</a> — every class and method, synced across TS/Py/Rust</li>
        <li><a href="Docs-SDK.html#whales">whales.subscribe</a> — copy-trade the top 500 wallets</li>
        <li><a href="Docs-API.html">REST API</a> — everything the SDK does, over HTTPS</li>
        <li><a href="Docs-MCP.html">MCP server</a> — drive Polyforge with natural language from Claude or Cursor</li>
      </ul>
    </DocsLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<QuickstartPage />);
