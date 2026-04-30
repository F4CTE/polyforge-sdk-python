/* Docs — SDK Reference. Covers Client, Strategy, whales, blocks, types */

const SDK_INSTALL = {
  ts: `npm install <span class="tok-s">@polyforge/sdk</span>`,
  py: `pip install <span class="tok-s">polyforge</span>`,
  rs: `cargo add polyforge <span class="tok-p">--features</span> <span class="tok-s">"full"</span>`,
  sh: `curl -sSf <span class="tok-s">https://get.polyforge.app</span> | sh`,
};

const CLIENT_CONNECT = {
  ts: `<span class="tok-k">import</span> <span class="tok-p">{</span> <span class="tok-t">Client</span> <span class="tok-p">}</span> <span class="tok-k">from</span> <span class="tok-s">"@polyforge/sdk"</span><span class="tok-p">;</span>

<span class="tok-k">const</span> pf <span class="tok-p">=</span> <span class="tok-k">await</span> <span class="tok-t">Client</span><span class="tok-p">.</span><span class="tok-m">connect</span><span class="tok-p">(</span><span class="tok-p">{</span>
  apiKey<span class="tok-p">:</span> <span class="tok-s">"pk_live_..."</span><span class="tok-p">,</span>
  venues<span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-s">"kalshi"</span><span class="tok-p">,</span> <span class="tok-s">"polymarket"</span><span class="tok-p">],</span>
  timeoutMs<span class="tok-p">:</span> <span class="tok-n">5000</span><span class="tok-p">,</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
  py: `<span class="tok-k">import</span> polyforge <span class="tok-k">as</span> pf

client <span class="tok-p">=</span> pf<span class="tok-p">.</span><span class="tok-m">Client</span><span class="tok-p">.</span><span class="tok-m">connect</span><span class="tok-p">(</span>
  api_key<span class="tok-p">=</span><span class="tok-s">"pk_live_..."</span><span class="tok-p">,</span>
  venues<span class="tok-p">=[</span><span class="tok-s">"kalshi"</span><span class="tok-p">,</span> <span class="tok-s">"polymarket"</span><span class="tok-p">],</span>
  timeout<span class="tok-p">=</span><span class="tok-n">5.0</span><span class="tok-p">,</span>
<span class="tok-p">)</span>`,
  rs: `<span class="tok-k">use</span> polyforge<span class="tok-p">::{</span><span class="tok-t">Client</span><span class="tok-p">,</span> <span class="tok-t">ConnectOpts</span><span class="tok-p">};</span>

<span class="tok-k">let</span> pf <span class="tok-p">=</span> <span class="tok-t">Client</span><span class="tok-p">::</span><span class="tok-f">connect</span><span class="tok-p">(</span><span class="tok-t">ConnectOpts</span> <span class="tok-p">{</span>
  api_key<span class="tok-p">:</span> <span class="tok-s">"pk_live_..."</span><span class="tok-p">.</span><span class="tok-f">into</span><span class="tok-p">(),</span>
  venues<span class="tok-p">:</span> <span class="tok-f">vec!</span><span class="tok-p">[</span><span class="tok-t">Venue</span><span class="tok-p">::</span><span class="tok-t">Kalshi</span><span class="tok-p">,</span> <span class="tok-t">Venue</span><span class="tok-p">::</span><span class="tok-t">Polymarket</span><span class="tok-p">],</span>
  timeout<span class="tok-p">:</span> <span class="tok-t">Duration</span><span class="tok-p">::</span><span class="tok-f">from_secs</span><span class="tok-p">(</span><span class="tok-n">5</span><span class="tok-p">),</span>
<span class="tok-p">}).</span><span class="tok-f">await</span><span class="tok-p">?;</span>`,
  sh: `<span class="tok-c"># The CLI reads from ~/.config/polyforge/config.toml</span>
polyforge auth login --api-key pk_live_...`,
};

const STRATEGY_RUN = {
  ts: `<span class="tok-k">const</span> handle <span class="tok-p">=</span> <span class="tok-k">await</span> strat<span class="tok-p">.</span><span class="tok-m">run</span><span class="tok-p">(</span><span class="tok-p">{</span>
  mode<span class="tok-p">:</span> <span class="tok-s">"live"</span><span class="tok-p">,</span>             <span class="tok-c">// "live" | "paper" | "dry"</span>
  bankroll<span class="tok-p">:</span> <span class="tok-n">10_000</span><span class="tok-p">,</span>
  maxDailyLoss<span class="tok-p">:</span> <span class="tok-n">0.03</span><span class="tok-p">,</span>     <span class="tok-c">// 3% auto-pause</span>
  onFill<span class="tok-p">:</span> <span class="tok-p">(</span>t<span class="tok-p">)</span> <span class="tok-p">=&gt;</span> console<span class="tok-p">.</span><span class="tok-m">log</span><span class="tok-p">(</span>t<span class="tok-p">),</span>
<span class="tok-p">}</span><span class="tok-p">);</span>

<span class="tok-k">await</span> handle<span class="tok-p">.</span><span class="tok-m">stop</span><span class="tok-p">(</span><span class="tok-p">);</span>   <span class="tok-c">// Graceful shutdown + cancel live orders</span>`,
  py: `handle <span class="tok-p">=</span> strat<span class="tok-p">.</span><span class="tok-m">run</span><span class="tok-p">(</span>
  mode<span class="tok-p">=</span><span class="tok-s">"live"</span><span class="tok-p">,</span>
  bankroll<span class="tok-p">=</span><span class="tok-n">10_000</span><span class="tok-p">,</span>
  max_daily_loss<span class="tok-p">=</span><span class="tok-n">0.03</span><span class="tok-p">,</span>
  on_fill<span class="tok-p">=</span><span class="tok-k">lambda</span> t<span class="tok-p">:</span> <span class="tok-k">print</span><span class="tok-p">(</span>t<span class="tok-p">),</span>
<span class="tok-p">)</span>
handle<span class="tok-p">.</span><span class="tok-m">stop</span><span class="tok-p">()</span>`,
  rs: `<span class="tok-k">let</span> handle <span class="tok-p">=</span> strat
  <span class="tok-p">.</span><span class="tok-f">run</span><span class="tok-p">()</span>
  <span class="tok-p">.</span><span class="tok-f">mode</span><span class="tok-p">(</span><span class="tok-t">Mode</span><span class="tok-p">::</span><span class="tok-t">Live</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">bankroll</span><span class="tok-p">(</span><span class="tok-n">10_000</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">max_daily_loss</span><span class="tok-p">(</span><span class="tok-n">0.03</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">spawn</span><span class="tok-p">().</span><span class="tok-f">await</span><span class="tok-p">?;</span>

handle<span class="tok-p">.</span><span class="tok-f">stop</span><span class="tok-p">().</span><span class="tok-f">await</span><span class="tok-p">?;</span>`,
  sh: `polyforge run eth-5k-crossover \\
  --mode live --bankroll 10000 --max-daily-loss 0.03`,
};

const STRATEGY_BACKTEST = {
  ts: `<span class="tok-k">const</span> res <span class="tok-p">=</span> <span class="tok-k">await</span> strat<span class="tok-p">.</span><span class="tok-m">backtest</span><span class="tok-p">(</span><span class="tok-p">{</span>
  from<span class="tok-p">:</span> <span class="tok-s">"2024-01-01"</span><span class="tok-p">,</span>
  to<span class="tok-p">:</span> <span class="tok-s">"2025-12-31"</span><span class="tok-p">,</span>
  bankroll<span class="tok-p">:</span> <span class="tok-n">10_000</span><span class="tok-p">,</span>
  realistic<span class="tok-p">:</span> <span class="tok-k">true</span><span class="tok-p">,</span>         <span class="tok-c">// replay order book for slippage</span>
<span class="tok-p">}</span><span class="tok-p">);</span>

<span class="tok-c">// BacktestResult</span>
<span class="tok-c">// { sharpe, sortino, maxDrawdown, trades, equityCurve, … }</span>`,
  py: `res <span class="tok-p">=</span> strat<span class="tok-p">.</span><span class="tok-m">backtest</span><span class="tok-p">(</span>
  from_<span class="tok-p">=</span><span class="tok-s">"2024-01-01"</span><span class="tok-p">,</span>
  to<span class="tok-p">=</span><span class="tok-s">"2025-12-31"</span><span class="tok-p">,</span>
  bankroll<span class="tok-p">=</span><span class="tok-n">10_000</span><span class="tok-p">,</span>
  realistic<span class="tok-p">=</span><span class="tok-k">True</span><span class="tok-p">,</span>
<span class="tok-p">)</span>

<span class="tok-c"># res is a BacktestResult dataclass</span>`,
  rs: `<span class="tok-k">let</span> res <span class="tok-p">=</span> strat
  <span class="tok-p">.</span><span class="tok-f">backtest</span><span class="tok-p">()</span>
  <span class="tok-p">.</span><span class="tok-f">range</span><span class="tok-p">(</span><span class="tok-s">"2024-01-01"</span><span class="tok-p">,</span> <span class="tok-s">"2025-12-31"</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">bankroll</span><span class="tok-p">(</span><span class="tok-n">10_000</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">realistic</span><span class="tok-p">(</span><span class="tok-k">true</span><span class="tok-p">)</span>
  <span class="tok-p">.</span><span class="tok-f">run</span><span class="tok-p">().</span><span class="tok-f">await</span><span class="tok-p">?;</span>`,
  sh: `polyforge backtest eth-5k-crossover \\
  --from 2024-01-01 --to 2025-12-31 \\
  --bankroll 10000 --realistic`,
};

const WHALES_CODE = {
  ts: `<span class="tok-c">// Subscribe to the top-500 whale feed</span>
<span class="tok-k">const</span> stream <span class="tok-p">=</span> pf<span class="tok-p">.</span>whales<span class="tok-p">.</span><span class="tok-m">subscribe</span><span class="tok-p">(</span><span class="tok-p">{</span>
  cohort<span class="tok-p">:</span> <span class="tok-s">"top500"</span><span class="tok-p">,</span>
  minNotional<span class="tok-p">:</span> <span class="tok-n">10_000</span><span class="tok-p">,</span>     <span class="tok-c">// ignore dust</span>
<span class="tok-p">}</span><span class="tok-p">);</span>

<span class="tok-k">for await</span> <span class="tok-p">(</span><span class="tok-k">const</span> event <span class="tok-k">of</span> stream<span class="tok-p">)</span> <span class="tok-p">{</span>
  <span class="tok-k">if</span> <span class="tok-p">(</span>event<span class="tok-p">.</span>side <span class="tok-p">===</span> <span class="tok-s">"buy"</span><span class="tok-p">)</span> <span class="tok-p">{</span>
    <span class="tok-k">await</span> pf<span class="tok-p">.</span>orders<span class="tok-p">.</span><span class="tok-m">place</span><span class="tok-p">(</span><span class="tok-p">{</span> <span class="tok-p">...</span>event<span class="tok-p">.</span>order<span class="tok-p">,</span> size<span class="tok-p">:</span> event<span class="tok-p">.</span>order<span class="tok-p">.</span>size <span class="tok-p">*</span> <span class="tok-n">0.1</span> <span class="tok-p">}</span><span class="tok-p">);</span>
  <span class="tok-p">}</span>
<span class="tok-p">}</span>`,
  py: `stream <span class="tok-p">=</span> pf<span class="tok-p">.</span>whales<span class="tok-p">.</span><span class="tok-m">subscribe</span><span class="tok-p">(</span>cohort<span class="tok-p">=</span><span class="tok-s">"top500"</span><span class="tok-p">,</span> min_notional<span class="tok-p">=</span><span class="tok-n">10_000</span><span class="tok-p">)</span>

<span class="tok-k">async for</span> event <span class="tok-k">in</span> stream<span class="tok-p">:</span>
  <span class="tok-k">if</span> event<span class="tok-p">.</span>side <span class="tok-p">==</span> <span class="tok-s">"buy"</span><span class="tok-p">:</span>
    <span class="tok-k">await</span> pf<span class="tok-p">.</span>orders<span class="tok-p">.</span><span class="tok-m">place</span><span class="tok-p">(**</span>event<span class="tok-p">.</span>order<span class="tok-p">.</span><span class="tok-m">scaled</span><span class="tok-p">(</span><span class="tok-n">0.1</span><span class="tok-p">))</span>`,
  rs: `<span class="tok-k">let mut</span> stream <span class="tok-p">=</span> pf<span class="tok-p">.</span><span class="tok-f">whales</span><span class="tok-p">().</span><span class="tok-f">subscribe</span><span class="tok-p">(</span>
  <span class="tok-t">WhaleFilter</span><span class="tok-p">::</span><span class="tok-f">cohort</span><span class="tok-p">(</span><span class="tok-s">"top500"</span><span class="tok-p">).</span><span class="tok-f">min_notional</span><span class="tok-p">(</span><span class="tok-n">10_000</span><span class="tok-p">),</span>
<span class="tok-p">).</span><span class="tok-f">await</span><span class="tok-p">?;</span>

<span class="tok-k">while let</span> <span class="tok-t">Some</span><span class="tok-p">(</span>event<span class="tok-p">)</span> <span class="tok-p">=</span> stream<span class="tok-p">.</span><span class="tok-f">next</span><span class="tok-p">().</span><span class="tok-f">await</span> <span class="tok-p">{</span>
  <span class="tok-k">if</span> event<span class="tok-p">.</span>side <span class="tok-p">==</span> <span class="tok-t">Side</span><span class="tok-p">::</span><span class="tok-t">Buy</span> <span class="tok-p">{</span>
    pf<span class="tok-p">.</span><span class="tok-f">orders</span><span class="tok-p">().</span><span class="tok-f">place</span><span class="tok-p">(</span>event<span class="tok-p">.</span>order<span class="tok-p">.</span><span class="tok-f">scale</span><span class="tok-p">(</span><span class="tok-n">0.1</span><span class="tok-p">)).</span><span class="tok-f">await</span><span class="tok-p">?;</span>
  <span class="tok-p">}</span>
<span class="tok-p">}</span>`,
  sh: `<span class="tok-c"># Tail whale events to stdout, filter with jq</span>
polyforge whales follow --cohort top500 \\
  | jq -c <span class="tok-s">'select(.side == "buy" and .notional &gt; 10000)'</span>`,
};

const BLOCKS_CODE = {
  ts: `<span class="tok-c">// Built-in blocks are plain functions</span>
<span class="tok-k">import</span> <span class="tok-p">{</span> blocks <span class="tok-p">}</span> <span class="tok-k">from</span> <span class="tok-s">"@polyforge/sdk"</span><span class="tok-p">;</span>

blocks<span class="tok-p">.</span><span class="tok-m">emaCross</span><span class="tok-p">(</span><span class="tok-p">{</span> fast<span class="tok-p">:</span> <span class="tok-n">12</span><span class="tok-p">,</span> slow<span class="tok-p">:</span> <span class="tok-n">48</span> <span class="tok-p">})</span>
blocks<span class="tok-p">.</span><span class="tok-m">priceAbove</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">)</span>
blocks<span class="tok-p">.</span><span class="tok-m">buyKelly</span><span class="tok-p">(</span><span class="tok-p">{</span> edge<span class="tok-p">:</span> <span class="tok-n">0.03</span> <span class="tok-p">})</span>

<span class="tok-c">// Write your own — any function that returns a Block&lt;T&gt;</span>
<span class="tok-k">export const</span> onWhaleBuy <span class="tok-p">=</span> blocks<span class="tok-p">.</span><span class="tok-m">define</span><span class="tok-p">(</span><span class="tok-p">{</span>
  name<span class="tok-p">:</span> <span class="tok-s">"onWhaleBuy"</span><span class="tok-p">,</span>
  inputs<span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-s">"whaleStream"</span><span class="tok-p">],</span>
  fn<span class="tok-p">:</span> <span class="tok-p">({</span> whaleStream <span class="tok-p">}</span><span class="tok-p">)</span> <span class="tok-p">=&gt;</span> whaleStream<span class="tok-p">.</span><span class="tok-m">filter</span><span class="tok-p">(</span>e <span class="tok-p">=&gt;</span> e<span class="tok-p">.</span>side <span class="tok-p">===</span> <span class="tok-s">"buy"</span><span class="tok-p">),</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
  py: `<span class="tok-k">from</span> polyforge <span class="tok-k">import</span> blocks

blocks<span class="tok-p">.</span><span class="tok-m">ema_cross</span><span class="tok-p">(</span>fast<span class="tok-p">=</span><span class="tok-n">12</span><span class="tok-p">,</span> slow<span class="tok-p">=</span><span class="tok-n">48</span><span class="tok-p">)</span>
blocks<span class="tok-p">.</span><span class="tok-m">price_above</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">)</span>
blocks<span class="tok-p">.</span><span class="tok-m">buy_kelly</span><span class="tok-p">(</span>edge<span class="tok-p">=</span><span class="tok-n">0.03</span><span class="tok-p">)</span>

<span class="tok-p">@</span>blocks<span class="tok-p">.</span><span class="tok-m">define</span><span class="tok-p">(</span>inputs<span class="tok-p">=[</span><span class="tok-s">"whale_stream"</span><span class="tok-p">])</span>
<span class="tok-k">def</span> <span class="tok-f">on_whale_buy</span><span class="tok-p">(</span>whale_stream<span class="tok-p">):</span>
  <span class="tok-k">return</span> <span class="tok-p">(</span>e <span class="tok-k">for</span> e <span class="tok-k">in</span> whale_stream <span class="tok-k">if</span> e<span class="tok-p">.</span>side <span class="tok-p">==</span> <span class="tok-s">"buy"</span><span class="tok-p">)</span>`,
  rs: `<span class="tok-k">use</span> polyforge<span class="tok-p">::</span>blocks<span class="tok-p">::{</span>ema_cross<span class="tok-p">,</span> price_above<span class="tok-p">,</span> buy_kelly<span class="tok-p">};</span>

<span class="tok-f">ema_cross</span><span class="tok-p">(</span><span class="tok-n">12</span><span class="tok-p">,</span> <span class="tok-n">48</span><span class="tok-p">)</span>
<span class="tok-f">price_above</span><span class="tok-p">(</span><span class="tok-n">0.55</span><span class="tok-p">)</span>
<span class="tok-f">buy_kelly</span><span class="tok-p">(</span><span class="tok-n">0.03</span><span class="tok-p">)</span>

<span class="tok-c">// Define your own as an impl Block trait</span>`,
  sh: `<span class="tok-c"># List built-in blocks</span>
polyforge blocks list

<span class="tok-c"># Publish one from a local file</span>
polyforge blocks publish ./blocks/on_whale_buy.ts`,
};

const TOC = [
  { id: 'install', text: 'Install', level: 2 },
  { id: 'connect', text: 'Client', level: 2 },
  { id: 'strategy', text: 'Strategy', level: 2 },
  { id: 'strategy-run', text: '.run()', level: 3 },
  { id: 'backtest', text: '.backtest()', level: 3 },
  { id: 'whales', text: 'whales', level: 2 },
  { id: 'blocks', text: 'Blocks', level: 2 },
  { id: 'types', text: 'Types', level: 2 },
  { id: 'cli', text: 'CLI reference', level: 2 },
];

function SDKPage() {
  return (
    <DocsLayout
      activeId="sdk"
      section="docs"
      toc={TOC}
      breadcrumbs={[{ label: 'Docs', href: 'Docs.html' }, { label: 'Reference' }, { label: 'SDK' }]}
      prev={{ title: 'Quickstart', href: 'Docs-Quickstart.html' }}
      next={{ title: 'REST API', href: 'Docs-API.html' }}
    >
      <h1>SDK Reference</h1>
      <p className="docs-lede">
        First-class SDKs for TypeScript, Python, and Rust. Every class and method is a thin wrapper over the REST API with the types written by hand, not generated. Switch languages in any code block — the selection syncs across the whole page.
      </p>

      <h2 id="install">Install</h2>
      <CodeBlock snippets={SDK_INSTALL} />
      <p>All three SDKs track the same semver. Minor versions ship together every two weeks; patch versions as needed.</p>

      <h2 id="connect"><code>Client</code></h2>
      <p>The entry point. Connects to the Polyforge API and, optionally, eagerly opens WebSocket streams to your configured venues for lower first-fill latency.</p>
      <CodeBlock snippets={CLIENT_CONNECT} />
      <h3>Parameters</h3>
      <ParamsTable rows={[
        { name: 'apiKey',  type: 'string',   required: true,  desc: 'Your Polyforge API key. Starts with pk_live_ or pk_test_. Never commit to source control.' },
        { name: 'venues',  type: 'Venue[]',  required: true,  desc: 'List of venues this client will trade on. "kalshi" | "polymarket" | "manifold" (coming soon).' },
        { name: 'timeoutMs', type: 'number', desc: 'HTTP request timeout. Default 10000.' },
        { name: 'retryPolicy', type: 'RetryPolicy', desc: 'How to handle 5xx / transient errors. Default: exponential backoff, 3 attempts.' },
      ]} />

      <h2 id="strategy"><code>Strategy</code></h2>
      <p>A fluent pipeline: <code>.on()</code> declares signal sources, <code>.when()</code> adds filters, <code>.do()</code> attaches actions. Multiple of each are allowed and compose in order.</p>

      <h3 id="strategy-run"><code>.run(opts)</code></h3>
      <p>Starts the strategy. Returns a handle you can introspect and stop. Safe to call concurrently — each run gets isolated state.</p>
      <CodeBlock snippets={STRATEGY_RUN} />
      <ParamsTable rows={[
        { name: 'mode', type: '"live" | "paper" | "dry"', required: true, desc: '"live" executes real orders. "paper" uses the live data feed with a simulated wallet. "dry" checks connectivity without opening any subscriptions.' },
        { name: 'bankroll', type: 'number', required: true, desc: 'USD allocated to this strategy. Kelly and max-fraction sizing are relative to this number.' },
        { name: 'maxDailyLoss', type: 'number', desc: 'Auto-pause fraction. 0.03 = pause at -3% cumulative daily P&L. Default: no auto-pause.' },
        { name: 'onFill', type: '(trade: Trade) => void', desc: 'Fires on every fill. Use this for logging, alerts, or updating your own state.' },
      ]} />

      <h3 id="backtest"><code>.backtest(opts)</code></h3>
      <p>Replays the strategy against historical data. Shares the same execution path as live — no two-codepath divergence — so a passing backtest is a strong signal.</p>
      <CodeBlock snippets={STRATEGY_BACKTEST} />
      <Callout type="warn" title="Survivorship bias">
        Backtests only see markets that resolved. If your strategy relies on a market existing, it's implicitly selecting for markets liquid enough to survive — which may be cherry-picking. Use <code>includeDelisted: true</code> to also include markets that were pulled before resolution.
      </Callout>

      <h2 id="whales"><code>whales.subscribe(filter)</code></h2>
      <p>Real-time stream of wallet activity from the top prediction-market traders. Pro plan (top 500 whales) or Team plan (custom cohorts + private wallet tagging).</p>
      <CodeBlock snippets={WHALES_CODE} />
      <ParamsTable rows={[
        { name: 'cohort', type: '"top10" | "top100" | "top500" | "custom"', required: true, desc: 'Which whale set to follow. "custom" requires a cohortId from the dashboard.' },
        { name: 'minNotional', type: 'number', desc: 'Ignore events below this USD size. Helpful for filtering dust.' },
        { name: 'venues', type: 'Venue[]', desc: 'Only include events from these venues. Default: all connected venues.' },
      ]} />

      <h2 id="blocks">Blocks</h2>
      <p>Blocks are reusable units of strategy logic. The SDK ships with 50+ built-ins; you can also publish your own to a private or public library.</p>
      <CodeBlock snippets={BLOCKS_CODE} />
      <p>Full built-in block catalog: <a href="#">blocks reference</a>. Common ones:</p>
      <ul>
        <li><code>emaCross</code>, <code>rsi</code>, <code>bollinger</code>, <code>vwap</code> — indicators</li>
        <li><code>priceAbove</code>, <code>priceBelow</code>, <code>volumeSpike</code> — filters</li>
        <li><code>buyKelly</code>, <code>buyFraction</code>, <code>marketOut</code> — actions</li>
        <li><code>onWhaleBuy</code>, <code>onResolution</code>, <code>onNewMarket</code> — event sources</li>
      </ul>

      <h2 id="types">Types</h2>
      <p>The SDK's type exports are the canonical source for Polyforge's domain model. Use them directly — or re-export them into your own API layer.</p>
      <ul>
        <li><code>Market</code> — id, title, venue, yesPrice, noPrice, volume, resolution</li>
        <li><code>Order</code> — marketId, side, size, price, type (limit/market/ioc), ttl</li>
        <li><code>Trade</code> — orderId, fillPrice, fillSize, timestamp, fees</li>
        <li><code>Position</code> — marketId, side, size, avgPrice, unrealizedPnL</li>
        <li><code>WhaleEvent</code> — wallet, action, marketId, side, size, notional, timestamp</li>
        <li><code>BacktestResult</code> — sharpe, sortino, maxDrawdown, trades, equityCurve, windowedMetrics</li>
      </ul>

      <h2 id="cli">CLI reference</h2>
      <p>The <code>polyforge</code> CLI wraps the SDK for shell scripting and CI/CD. It reads config from <code>~/.config/polyforge/config.toml</code> or env vars.</p>
      <CodeBlock
        code={`<span class="tok-c"># Common commands</span>
polyforge auth login --api-key pk_live_...
polyforge strategy list
polyforge strategy deploy ./strats/eth-5k-crossover.ts
polyforge run eth-5k-crossover --mode paper
polyforge backtest eth-5k-crossover --from 2024-01-01 --to 2025-12-31
polyforge logs eth-5k-crossover -f
polyforge kill eth-5k-crossover
polyforge whales follow --cohort top500
polyforge blocks publish ./blocks/my_block.ts`}
        lang="bash"
      />
    </DocsLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<SDKPage />);
