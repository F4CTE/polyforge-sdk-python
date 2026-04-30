/* Docs — REST API reference */

// Code snippet helpers
const AUTH_CODE = {
  sh: `curl <span class="tok-s">https://api.polyforge.app/v1/markets</span> \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span>`,
  ts: `<span class="tok-k">const</span> r <span class="tok-p">=</span> <span class="tok-k">await</span> <span class="tok-f">fetch</span><span class="tok-p">(</span><span class="tok-s">"https://api.polyforge.app/v1/markets"</span><span class="tok-p">,</span> <span class="tok-p">{</span>
  headers<span class="tok-p">:</span> <span class="tok-p">{</span> <span class="tok-s">"Authorization"</span><span class="tok-p">:</span> <span class="tok-s">\`Bearer \${process.env.POLYFORGE_KEY}\`</span> <span class="tok-p">}</span><span class="tok-p">,</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
  py: `<span class="tok-k">import</span> requests<span class="tok-p">,</span> os

r <span class="tok-p">=</span> requests<span class="tok-p">.</span><span class="tok-m">get</span><span class="tok-p">(</span>
  <span class="tok-s">"https://api.polyforge.app/v1/markets"</span><span class="tok-p">,</span>
  headers<span class="tok-p">={</span><span class="tok-s">"Authorization"</span><span class="tok-p">:</span> <span class="tok-s">f"Bearer {os.environ['POLYFORGE_KEY']}"</span><span class="tok-p">},</span>
<span class="tok-p">)</span>`,
};

const CREATE_STRATEGY = {
  sh: `curl <span class="tok-s">https://api.polyforge.app/v1/strategies</span> \\
  -X POST \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span> \\
  -H <span class="tok-s">"Content-Type: application/json"</span> \\
  -d <span class="tok-s">'{
    "name": "eth-5k-crossover",
    "source": "base64:<Lzo9...>",
    "mode": "paper",
    "bankroll": 10000
  }'</span>`,
  ts: `<span class="tok-k">const</span> res <span class="tok-p">=</span> <span class="tok-k">await</span> <span class="tok-f">fetch</span><span class="tok-p">(</span><span class="tok-s">"https://api.polyforge.app/v1/strategies"</span><span class="tok-p">,</span> <span class="tok-p">{</span>
  method<span class="tok-p">:</span> <span class="tok-s">"POST"</span><span class="tok-p">,</span>
  headers<span class="tok-p">:</span> <span class="tok-p">{</span>
    <span class="tok-s">"Authorization"</span><span class="tok-p">:</span> <span class="tok-s">\`Bearer \${key}\`</span><span class="tok-p">,</span>
    <span class="tok-s">"Content-Type"</span><span class="tok-p">:</span> <span class="tok-s">"application/json"</span><span class="tok-p">,</span>
  <span class="tok-p">}</span><span class="tok-p">,</span>
  body<span class="tok-p">:</span> <span class="tok-t">JSON</span><span class="tok-p">.</span><span class="tok-m">stringify</span><span class="tok-p">(</span><span class="tok-p">{</span>
    name<span class="tok-p">:</span> <span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">,</span>
    source<span class="tok-p">:</span> <span class="tok-f">btoa</span><span class="tok-p">(</span>code<span class="tok-p">),</span>
    mode<span class="tok-p">:</span> <span class="tok-s">"paper"</span><span class="tok-p">,</span>
    bankroll<span class="tok-p">:</span> <span class="tok-n">10000</span><span class="tok-p">,</span>
  <span class="tok-p">}</span><span class="tok-p">),</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
  py: `res <span class="tok-p">=</span> requests<span class="tok-p">.</span><span class="tok-m">post</span><span class="tok-p">(</span>
  <span class="tok-s">"https://api.polyforge.app/v1/strategies"</span><span class="tok-p">,</span>
  headers<span class="tok-p">={</span><span class="tok-s">"Authorization"</span><span class="tok-p">:</span> <span class="tok-s">f"Bearer {key}"</span><span class="tok-p">},</span>
  json<span class="tok-p">={</span>
    <span class="tok-s">"name"</span><span class="tok-p">:</span> <span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">,</span>
    <span class="tok-s">"source"</span><span class="tok-p">:</span> base64<span class="tok-p">.</span><span class="tok-m">b64encode</span><span class="tok-p">(</span>code<span class="tok-p">),</span>
    <span class="tok-s">"mode"</span><span class="tok-p">:</span> <span class="tok-s">"paper"</span><span class="tok-p">,</span>
    <span class="tok-s">"bankroll"</span><span class="tok-p">:</span> <span class="tok-n">10000</span><span class="tok-p">,</span>
  <span class="tok-p">},</span>
<span class="tok-p">)</span>`,
};

const CREATE_RESPONSE = {
  sh: `<span class="tok-p">{</span>
  <span class="tok-s">"id"</span><span class="tok-p">:</span> <span class="tok-s">"strat_0f3a9b2c"</span><span class="tok-p">,</span>
  <span class="tok-s">"name"</span><span class="tok-p">:</span> <span class="tok-s">"eth-5k-crossover"</span><span class="tok-p">,</span>
  <span class="tok-s">"mode"</span><span class="tok-p">:</span> <span class="tok-s">"paper"</span><span class="tok-p">,</span>
  <span class="tok-s">"status"</span><span class="tok-p">:</span> <span class="tok-s">"running"</span><span class="tok-p">,</span>
  <span class="tok-s">"bankroll"</span><span class="tok-p">:</span> <span class="tok-n">10000</span><span class="tok-p">,</span>
  <span class="tok-s">"createdAt"</span><span class="tok-p">:</span> <span class="tok-s">"2026-04-21T09:14:22Z"</span>
<span class="tok-p">}</span>`,
};

const PLACE_ORDER = {
  sh: `curl <span class="tok-s">https://api.polyforge.app/v1/orders</span> \\
  -X POST \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span> \\
  -H <span class="tok-s">"Content-Type: application/json"</span> \\
  -d <span class="tok-s">'{
    "marketId": "kalshi:PRESELECT-2028",
    "side": "yes",
    "size": 100,
    "type": "limit",
    "price": 0.42
  }'</span>`,
  ts: `<span class="tok-k">await</span> <span class="tok-f">fetch</span><span class="tok-p">(</span><span class="tok-s">"https://api.polyforge.app/v1/orders"</span><span class="tok-p">,</span> <span class="tok-p">{</span>
  method<span class="tok-p">:</span> <span class="tok-s">"POST"</span><span class="tok-p">,</span>
  headers<span class="tok-p">,</span>
  body<span class="tok-p">:</span> <span class="tok-t">JSON</span><span class="tok-p">.</span><span class="tok-m">stringify</span><span class="tok-p">(</span><span class="tok-p">{</span>
    marketId<span class="tok-p">:</span> <span class="tok-s">"kalshi:PRESELECT-2028"</span><span class="tok-p">,</span>
    side<span class="tok-p">:</span> <span class="tok-s">"yes"</span><span class="tok-p">,</span>
    size<span class="tok-p">:</span> <span class="tok-n">100</span><span class="tok-p">,</span>
    type<span class="tok-p">:</span> <span class="tok-s">"limit"</span><span class="tok-p">,</span>
    price<span class="tok-p">:</span> <span class="tok-n">0.42</span><span class="tok-p">,</span>
  <span class="tok-p">}</span><span class="tok-p">),</span>
<span class="tok-p">}</span><span class="tok-p">);</span>`,
};

const WEBHOOK_CODE = {
  sh: `<span class="tok-c"># Register a webhook</span>
curl <span class="tok-s">https://api.polyforge.app/v1/webhooks</span> -X POST \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span> \\
  -H <span class="tok-s">"Content-Type: application/json"</span> \\
  -d <span class="tok-s">'{
    "url": "https://your.app/polyforge",
    "events": ["fill", "breach"],
    "secret": "whsec_..."
  }'</span>

<span class="tok-c"># Your endpoint receives signed events</span>
<span class="tok-c"># Verify with: X-Polyforge-Signature = HMAC-SHA256(secret, body)</span>`,
};

const TOC = [
  { id: 'base-url', text: 'Base URL', level: 2 },
  { id: 'auth', text: 'Authentication', level: 2 },
  { id: 'errors', text: 'Errors', level: 2 },
  { id: 'pagination', text: 'Pagination', level: 2 },
  { id: 'markets', text: 'Markets', level: 2 },
  { id: 'create-strategy', text: 'Strategies', level: 2 },
  { id: 'get-strategy', text: 'Get strategy', level: 3 },
  { id: 'place-order', text: 'Orders', level: 2 },
  { id: 'whales-api', text: 'Whales', level: 2 },
  { id: 'webhooks', text: 'Webhooks', level: 2 },
  { id: 'rate-limits', text: 'Rate limits', level: 2 },
];

function ApiPage() {
  return (
    <DocsLayout
      activeId="api"
      section="docs"
      toc={TOC}
      breadcrumbs={[{ label: 'Docs', href: 'Docs.html' }, { label: 'Reference' }, { label: 'REST API' }]}
      prev={{ title: 'SDK Reference', href: 'Docs-SDK.html' }}
      next={{ title: 'MCP Server', href: 'Docs-MCP.html' }}
    >
      <h1>REST API</h1>
      <p className="docs-lede">
        Everything the SDK does, over HTTPS. Use this for webhooks, custom integrations, or non-supported languages. All endpoints return JSON, use standard HTTP verbs, and return meaningful status codes.
      </p>

      <h2 id="base-url">Base URL</h2>
      <Endpoint method="GET" path="" />
      <p>All endpoints are rooted at:</p>
      <CodeBlock code={`https://api.polyforge.app/v1`} lang="url" />
      <p>Test keys (starting with <code>pk_test_</code>) route to an isolated sandbox that mirrors the production schema but uses paper fills only. Test-mode strategies can't execute live orders.</p>

      <h2 id="auth">Authentication</h2>
      <p>Pass your API key as a bearer token in the <code>Authorization</code> header. Keys are long-lived; rotate them from the dashboard.</p>
      <CodeBlock snippets={AUTH_CODE} />
      <Callout type="warn" title="Scope your keys">
        Production keys can be scoped to <strong>read</strong>, <strong>read+paper</strong>, or <strong>read+paper+live</strong>. Use a read-only key for anything that doesn't need to execute — your Grafana dashboard, your trading journal, your webhook receiver.
      </Callout>

      <h2 id="errors">Errors</h2>
      <p>Conventional HTTP codes. 4xx means you did something wrong; 5xx means we did. All error responses share this shape:</p>
      <CodeBlock code={`<span class="tok-p">{</span>
  <span class="tok-s">"error"</span><span class="tok-p">:</span> <span class="tok-p">{</span>
    <span class="tok-s">"code"</span><span class="tok-p">:</span> <span class="tok-s">"insufficient_bankroll"</span><span class="tok-p">,</span>
    <span class="tok-s">"message"</span><span class="tok-p">:</span> <span class="tok-s">"Strategy requested 12500 but bankroll is 10000"</span><span class="tok-p">,</span>
    <span class="tok-s">"docUrl"</span><span class="tok-p">:</span> <span class="tok-s">"https://polyforge.app/docs/errors#insufficient_bankroll"</span><span class="tok-p">,</span>
    <span class="tok-s">"requestId"</span><span class="tok-p">:</span> <span class="tok-s">"req_0f3a9b2c"</span>
  <span class="tok-p">}</span>
<span class="tok-p">}</span>`} lang="json" />
      <p>Include <code>requestId</code> when you email support. It's the fastest way to find your exact call in our logs.</p>

      <h2 id="pagination">Pagination</h2>
      <p>List endpoints use cursor-based pagination. Pass <code>?cursor=...</code> from the previous response's <code>nextCursor</code>, or <code>?limit=100</code> (default 20, max 200).</p>

      <h2 id="markets">Markets</h2>
      <Endpoint method="GET" path="/markets" />
      <p>List open markets across all connected venues. Supports filtering by venue, category, resolution window, and liquidity floor.</p>
      <h3>Query parameters</h3>
      <ParamsTable rows={[
        { name: 'venue', type: 'string', desc: 'Filter to one venue. "kalshi" | "polymarket".' },
        { name: 'category', type: 'string', desc: 'Category tag. "politics" | "sports" | "crypto" | "weather" | "finance".' },
        { name: 'resolvesBefore', type: 'ISO-8601', desc: 'Only markets resolving before this date.' },
        { name: 'minLiquidity', type: 'number', desc: 'USD liquidity floor. Default 0.' },
      ]} />
      <Endpoint method="GET" path="/markets/{id}" />
      <p>Fetch a single market, including full order-book depth and resolution metadata.</p>

      <h2 id="create-strategy">Strategies</h2>
      <Endpoint method="POST" path="/strategies" />
      <p>Create and deploy a new strategy. The source field should be a base64-encoded bundle — the SDK's <code>pack()</code> helper handles this for you.</p>
      <CodeBlock snippets={CREATE_STRATEGY} />
      <h3>Body</h3>
      <ParamsTable rows={[
        { name: 'name', type: 'string', required: true, desc: 'Unique within your org. Used as the strategy identifier in logs, alerts, and the dashboard.' },
        { name: 'source', type: 'string', required: true, desc: 'Base64-encoded strategy bundle. Must be <2 MiB after decode.' },
        { name: 'mode', type: '"live" | "paper" | "dry"', required: true, desc: 'Execution mode. Can be changed later via PATCH /strategies/{id}.' },
        { name: 'bankroll', type: 'number', required: true, desc: 'USD allocated to the strategy. Must be ≤ your account balance for live mode.' },
        { name: 'maxDailyLoss', type: 'number', desc: 'Auto-pause fraction between 0 and 1. Default: no auto-pause.' },
      ]} />
      <h3>Response</h3>
      <CodeBlock snippets={CREATE_RESPONSE} lang="json" />

      <h3 id="get-strategy">Get a strategy</h3>
      <Endpoint method="GET" path="/strategies/{id}" />
      <p>Returns the strategy's current config, status, and live P&L. Cache-friendly — <code>ETag</code> headers are stable until the strategy changes.</p>

      <Endpoint method="PATCH" path="/strategies/{id}" />
      <p>Update mode, bankroll, or risk limits. Changes take effect at the next candle boundary.</p>

      <Endpoint method="DELETE" path="/strategies/{id}" />
      <p>Stops the strategy, cancels live orders, and archives it. Archived strategies can be restored within 30 days.</p>

      <h2 id="place-order">Orders</h2>
      <Endpoint method="POST" path="/orders" />
      <p>Place an order directly, bypassing the strategy layer. Useful for manual intervention, hedging, or one-off trades.</p>
      <CodeBlock snippets={PLACE_ORDER} />
      <h3>Body</h3>
      <ParamsTable rows={[
        { name: 'marketId', type: 'string', required: true, desc: 'Fully-qualified venue market ID, e.g. "kalshi:PRESELECT-2028".' },
        { name: 'side', type: '"yes" | "no"', required: true, desc: 'Which side of the binary market to buy.' },
        { name: 'size', type: 'number', required: true, desc: 'Number of contracts. 1 contract pays $1 at resolution.' },
        { name: 'type', type: '"limit" | "market" | "ioc"', required: true, desc: 'Order type. Market orders sweep the book; limit sits on it; IOC cancels any unfilled portion.' },
        { name: 'price', type: 'number', desc: 'Required for limit + IOC. Between 0.01 and 0.99.' },
        { name: 'ttl', type: 'seconds', desc: 'Time-in-force for limit orders. Default 86400 (24h). Max 604800 (7d).' },
      ]} />

      <Endpoint method="GET" path="/orders" />
      <Endpoint method="GET" path="/orders/{id}" />
      <Endpoint method="DELETE" path="/orders/{id}" />
      <p>List, get, or cancel orders. Listing supports filters for <code>strategyId</code>, <code>status</code>, and date ranges.</p>

      <h2 id="whales-api">Whales</h2>
      <Endpoint method="GET" path="/whales" />
      <p>List tracked whale wallets. Pro plan returns top 500; Team plan returns your custom cohorts.</p>
      <Endpoint method="GET" path="/whales/{wallet}/trades" />
      <p>Trade history for a specific wallet. Pagination via cursor; replay up to 365 days.</p>
      <Endpoint method="GET" path="/whales/stream" />
      <p>Server-sent events (SSE) stream of whale trades as they settle on-venue. Open a long-lived connection and handle events as they arrive.</p>
      <CodeBlock code={`curl -N <span class="tok-s">https://api.polyforge.app/v1/whales/stream?cohort=top500</span> \\
  -H <span class="tok-s">"Authorization: Bearer $POLYFORGE_KEY"</span>

<span class="tok-c"># data: {"wallet":"0xa3b...","side":"buy","marketId":"polymarket:RECESSION-2026",...}</span>
<span class="tok-c"># data: {"wallet":"0x9fe...","side":"sell","marketId":"kalshi:FED-MAY",...}</span>`} lang="bash" />

      <h2 id="webhooks">Webhooks</h2>
      <p>Push events to your own endpoint. Polyforge signs every request with HMAC-SHA256; verify the <code>X-Polyforge-Signature</code> header before trusting the payload.</p>
      <Endpoint method="POST" path="/webhooks" />
      <Endpoint method="GET" path="/webhooks" />
      <Endpoint method="DELETE" path="/webhooks/{id}" />
      <CodeBlock snippets={WEBHOOK_CODE} />
      <p>Supported events: <code>fill</code>, <code>cancel</code>, <code>reject</code>, <code>breach</code>, <code>resolution</code>, <code>strategy_started</code>, <code>strategy_paused</code>, <code>strategy_stopped</code>.</p>

      <h2 id="rate-limits">Rate limits</h2>
      <p>Limits are per API key and reset every rolling minute:</p>
      <ul>
        <li><strong>Free:</strong> 60 requests/min · 5 concurrent WebSocket streams</li>
        <li><strong>Pro:</strong> 600 requests/min · 50 concurrent streams</li>
        <li><strong>Team:</strong> 3000 requests/min · 500 concurrent streams</li>
      </ul>
      <p>Every response includes <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>, and <code>X-RateLimit-Limit</code> headers. On 429, respect the <code>Retry-After</code> header — hammering past it will get you longer timeouts.</p>
      <Callout type="tip">
        If you hit the limit on a single workload — usually backtest parallelism — open <a href="mailto:support@polyforge.app">support</a>. We can raise it for legitimate use without bumping your plan.
      </Callout>
    </DocsLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ApiPage />);
