/* renderContent — all non-endpoint prose sections of the API docs. */

import { Link } from 'react-router';
import {
  Badge,
  Code,
  InlineCode,
  LangTabs,
  Sub,
  PageTitle,
  SCOPE_CLS,
  type Lang,
} from './api-docs-primitives';
import { EndpointCard } from './api-docs-endpoint-card';
import { McpSection } from './api-docs-content-mcp';
import { StatusSection } from './api-docs-content-status';
import { ENDPOINT_SECTIONS } from './api-docs-nav';

/* ─── Changelog data ─────────────────────────────────────────────── */

interface ChangelogEntry {
  date: string;
  tag: 'Breaking' | 'Feature' | 'Fix' | 'Improvement';
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'March 2026',
    tag: 'Feature',
    items: [
      'Added conditional orders API: TAKE_PROFIT, STOP_LOSS, TRAILING_STOP, LIMIT, PEGGED types.',
      'Introduced POST /strategies/from-description for AI-generated strategy creation.',
      'New MCP server with 23 tools for Claude Desktop and Claude Code integration.',
    ],
  },
  {
    date: 'February 2026',
    tag: 'Breaking',
    items: [
      'GET /markets response shape changed: totalPages and hasNext added, total now reflects global count.',
      'API key prefix changed from pk_ to pf_live_ — old keys continue working until April 2026.',
      'Removed deprecated GET /portfolio/positions; use GET /portfolio instead.',
    ],
  },
  {
    date: 'January 2026',
    tag: 'Improvement',
    items: [
      'Rate limit raised from 60 to 120 requests/minute for all tiers.',
      'SSE endpoint now sends a heartbeat comment every 15 s to prevent proxy disconnections.',
      'Backtest results now include sharpe ratio and maxDrawdown fields.',
    ],
  },
  {
    date: 'December 2025',
    tag: 'Feature',
    items: [
      'Copy trading API launched: PERCENTAGE, FIXED, and MIRROR scaling modes.',
      'Whale feed endpoint added with configurable minimum trade size filter.',
      'AI news signals endpoint added with confidence score and direction fields.',
    ],
  },
  {
    date: 'November 2025',
    tag: 'Fix',
    items: [
      'Fixed race condition in strategy start/stop that could cause duplicate orders.',
      'GET /orders now correctly returns orders filtered by strategyId across all pages.',
      'WebSocket reconnection after 401 now correctly prompts for a fresh JWT.',
    ],
  },
];

/* ─── Tag badge colour helper ────────────────────────────────────── */

function tagCls(tag: ChangelogEntry['tag']): string {
  switch (tag) {
    case 'Breaking':    return 'bg-pf-danger/10 text-pf-danger';
    case 'Feature':     return 'bg-pf-info/10 text-pf-info';
    case 'Improvement': return 'bg-pf-success/10 text-pf-success';
    case 'Fix':         return 'bg-pf-warning/10 text-pf-warning';
  }
}

/* ─── renderContent ──────────────────────────────────────────────── */

interface RenderContentProps {
  activeId: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  openEndpointId?: string;
  navigate: (id: string) => void;
}

export function renderContent({
  activeId,
  lang,
  setLang,
  openEndpointId,
  navigate,
}: RenderContentProps): React.ReactNode {

  /* ── Getting Started ── */
  if (activeId === 'getting-started') return (
    <div className="space-y-6">
      <PageTitle
        title="Getting Started"
        subtitle="Three steps to make your first API call against the Polyforge REST API."
      />
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-pf-text-muted uppercase tracking-wider mb-1">Base URL</p>
          <code className="text-sm font-mono text-pf-cyan-400">https://api.polyforge.app/api/v1</code>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-secondary">REST · JSON</span>
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-secondary">TLS 1.2+</span>
        </div>
      </div>
      <div className="space-y-3">
        {[
          {
            step: '1', title: 'Create an API key', body: (
              <p className="text-sm text-pf-text-secondary">
                Go to <Link to="/settings" className="text-pf-cyan-400 hover:text-pf-cyan-300 underline underline-offset-2">Settings → API Keys</Link> and
                click <strong className="text-pf-text">Create Key</strong>. Choose the scopes you need
                (<InlineCode>READ</InlineCode> / <InlineCode>WRITE</InlineCode> / <InlineCode>TRADE</InlineCode>) and
                copy the key — it is shown only once.
              </p>
            ),
          },
          {
            step: '2', title: 'Set the Authorization header', body: (
              <Code code={'Authorization: Bearer pf_live_your_key_here'} lang="curl" />
            ),
          },
          {
            step: '3', title: 'Make your first call', body: (
              <>
                <LangTabs lang={lang} setLang={setLang} available={['curl', 'ts', 'py', 'rust']} />
                {lang === 'curl' && <Code code={`curl https://api.polyforge.app/api/v1/markets \\\n  -H "Authorization: Bearer pf_live_..."`} lang="curl" />}
                {lang === 'ts' && <Code code={`import { PolyforgeClient } from '@polyforge/sdk';\n\nconst client = new PolyforgeClient({ apiKey: 'pf_live_...' });\nconst { data } = await client.listMarkets({ limit: 5 });\ndata.forEach(m => console.log(m.title, m.tokens[0]?.price));`} lang="ts" />}
                {lang === 'py' && <Code code={`from polyforge import PolyforgeClient\n\nwith PolyforgeClient(api_key='pf_live_...') as client:\n    markets = client.list_markets(limit=5)\n    for m in markets.items:\n        print(m.title, m.tokens[0].price)`} lang="py" />}
                {lang === 'rust' && <Code code={`use polyforge::PolyforgeClient;\n\n#[tokio::main]\nasync fn main() -> polyforge::Result<()> {\n    let client = PolyforgeClient::new("pf_live_...");\n    let markets = client.list_markets(&Default::default()).await?;\n    for m in &markets.data { println!("{}", m.title); }\n    Ok(())\n}`} lang="rust" />}
              </>
            ),
          },
        ].map(({ step, title, body }) => (
          <div key={step} className="flex gap-4 p-4 bg-pf-elevated border border-pf-border rounded-pf-lg">
            <span className="shrink-0 w-6 h-6 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 text-xs font-bold flex items-center justify-center">{step}</span>
            <div className="flex-1 space-y-3">
              <p className="text-sm font-medium text-pf-text">{title}</p>
              {body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Authentication ── */
  if (activeId === 'authentication') return (
    <div className="space-y-6">
      <PageTitle
        title="Authentication"
        subtitle="All requests use Bearer token authentication. API keys are recommended for external integrations — scoped, rotatable, and non-expiring by default."
      />
      <Code code={'Authorization: Bearer pf_live_abc123...\nContent-Type: application/json'} lang="curl" />
      <Sub title="Scopes">
        <div className="space-y-2">
          {([
            { scope: 'READ',  cls: SCOPE_CLS.READ,  desc: 'View markets, strategies, orders, portfolio, whale feed, signals, leaderboard.' },
            { scope: 'WRITE', cls: SCOPE_CLS.WRITE, desc: 'Create/update strategies, alerts, webhooks, and run backtests.' },
            { scope: 'TRADE', cls: SCOPE_CLS.TRADE, desc: 'Place and cancel orders, start/stop strategies, manage copy trading.' },
          ] as { scope: string; cls: string; desc: string }[]).map(s => (
            <div key={s.scope} className="flex items-start gap-3 p-3 bg-pf-elevated border border-pf-border rounded-pf-lg hover:border-pf-border-strong transition-all duration-200">
              <Badge text={s.scope} cls={s.cls} />
              <p className="text-xs text-pf-text-secondary leading-relaxed pt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title="API Key lifecycle">
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Keys are prefixed <InlineCode>pf_</InlineCode>. The full key is shown <strong className="text-pf-text">once</strong> at
          creation — store it securely. Up to 10 active keys per account. Revoke via{' '}
          <InlineCode>DELETE /api/v1/api-keys/:id</InlineCode> or from the Settings page.
        </p>
      </Sub>
    </div>
  );

  /* ── SDKs ── */
  if (activeId === 'sdks') return (
    <div className="space-y-6">
      <PageTitle
        title="SDKs & Clients"
        subtitle="Typed clients for TypeScript, Python, and Rust with full type safety, automatic retries on 429, and native streaming for live execution events."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {([
          { label: 'TypeScript', install: 'npm install @polyforge/sdk', cls: 'text-pf-info', code: `import { PolyforgeClient } from '@polyforge/sdk';\nconst client = new PolyforgeClient({ apiKey: 'pf_...' });` },
          { label: 'Python',     install: 'pip install polyforge',       cls: 'text-pf-success', code: `from polyforge import PolyforgeClient\nclient = PolyforgeClient(api_key='pf_...')` },
          { label: 'Rust',       install: 'cargo add polyforge tokio',   cls: 'text-pf-warning', code: `use polyforge::PolyforgeClient;\nlet client = PolyforgeClient::new("pf_...");` },
        ]).map(s => (
          <div key={s.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 hover:border-pf-border-strong transition-all duration-200">
            <p className={`text-sm font-semibold ${s.cls}`}>{s.label}</p>
            <Code code={s.install} />
            <Code code={s.code} />
          </div>
        ))}
      </div>
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 hover:border-pf-border-strong transition-all duration-200">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-pf-purple-300">MCP Server</p>
          <Badge text="Claude · Cursor · Windsurf · Zed" cls="bg-pf-purple-500/10 text-pf-purple-400" />
        </div>
        <Code code={'npx @polyforge/mcp-server'} lang="curl" />
        <p className="text-xs text-pf-text-secondary">
          23 tools covering markets, strategies, orders, and live events.{' '}
          <button type="button" onClick={() => navigate('mcp-server')} className="text-pf-cyan-400 hover:text-pf-cyan-300 underline underline-offset-2 cursor-pointer">
            Setup guide →
          </button>
        </p>
      </div>
    </div>
  );

  /* ── Changelog ── */
  if (activeId === 'changelog') return (
    <div className="space-y-6">
      <PageTitle title="Changelog" subtitle="API version history and breaking changes." />
      {CHANGELOG.map(entry => (
        <div key={entry.date} className="border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-pf-surface border-b border-pf-border">
            <span className="text-sm font-semibold text-pf-text">{entry.date}</span>
            <Badge text={entry.tag} cls={tagCls(entry.tag)} />
          </div>
          <div className="px-4 py-4 space-y-2">
            {entry.items.map((item, i) => (
              <p key={i} className="text-sm text-pf-text-secondary">• {item}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Endpoint reference sections ── */
  const epSection = ENDPOINT_SECTIONS.find(s => s.id === activeId);
  if (epSection) return (
    <div className="space-y-3">
      <PageTitle title={epSection.title} count={epSection.eps.length} />
      {epSection.eps.map(ep => (
        <EndpointCard
          key={`${ep.method}-${ep.path}`}
          ep={ep}
          lang={lang}
          setLang={setLang}
          forceOpen={openEndpointId === `${ep.method}-${ep.path}` ? true : undefined}
        />
      ))}
    </div>
  );

  /* ── WebSocket ── */
  if (activeId === 'websocket') return (
    <div className="space-y-6">
      <PageTitle
        title="WebSocket"
        subtitle="Real-time push events for orders, strategies, and notifications. Connect with a valid JWT."
      />
      <Sub title="Connection">
        <Code code={'wss://api.polyforge.app/ws?token=<JWT>'} lang="curl" />
      </Sub>
      <Sub title="Subscribe to a strategy">
        <Code code={`// Send after connection opens\n{ "event": "subscribe", "data": { "strategyId": "strat-uuid" } }`} lang="ts" />
      </Sub>
      <Sub title="Inbound event types">
        <div className="border border-pf-border rounded-pf-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border">
                <th scope="col" className="px-4 py-3 font-medium">Event</th>
                <th scope="col" className="px-4 py-3 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {[
                ['ORDER_FILLED',       '{ orderId, marketId, side, outcome, size, price, strategyId? }'],
                ['ORDER_CANCELLED',    '{ orderId }'],
                ['STRATEGY_STARTED',   '{ strategyId, mode }'],
                ['STRATEGY_STOPPED',   '{ strategyId, reason? }'],
                ['STRATEGY_ERROR',     '{ strategyId, error }'],
                ['BACKTEST_PROGRESS',  '{ strategyId, percent, currentDate }'],
                ['BACKTEST_COMPLETED', '{ strategyId, runId, pnl, winRate, sharpe }'],
                ['PRICE_ALERT',        '{ alertId, marketId, tokenId, price }'],
                ['NOTIFICATION',       '{ type, title, message }'],
              ].map(([ev, payload]) => (
                <tr key={ev} className="group hover:bg-pf-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-pf-cyan-400 text-xs">{ev}</td>
                  <td className="px-4 py-3 font-mono text-pf-text-secondary text-xs">{payload}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sub>
    </div>
  );

  /* ── SSE ── */
  if (activeId === 'sse') return (
    <div className="space-y-6">
      <PageTitle
        title="SSE Events"
        subtitle="Streams execution events over a persistent HTTP connection using text/event-stream. Ideal for API-key clients that cannot use WebSocket JWT auth."
      />
      <Sub title="Endpoint">
        <Code code={'GET /api/v1/strategies/:id/events\nAuthorization: Bearer pf_live_...\nAccept: text/event-stream'} lang="curl" />
        <p className="text-xs text-pf-text-muted mt-2">Scope: <strong className="text-pf-text-secondary">READ</strong> · Heartbeat comment every 15 s</p>
      </Sub>
      <Sub title="Event shape">
        <Code code={`{\n  "type": "ORDER_FILLED",\n  "strategyId": "uuid",\n  "data": { "orderId": "...", "price": 0.62 },\n  "timestamp": 1711720000000\n}`} lang="ts" />
        <p className="text-xs text-pf-text-muted mt-2">First event is always <InlineCode>{'{"type":"CONNECTED","strategyId":"...","timestamp":...}'}</InlineCode></p>
      </Sub>
      <Sub title="SDK usage">
        <LangTabs lang={lang} setLang={setLang} available={['ts', 'py', 'rust']} />
        {lang === 'ts' && <Code code={`const ac = new AbortController();\nfor await (const event of client.watchStrategy('strat-uuid', ac.signal)) {\n  console.log(event.type, event.data);\n  if (event.type === 'STRATEGY_STOPPED') break;\n}\nac.abort(); // stop watching`} lang="ts" />}
        {lang === 'py' && <Code code={`# Synchronous\nfor event in client.watch_strategy('strat-uuid'):\n    print(event.type, event.data)\n    if event.type == 'STRATEGY_STOPPED':\n        break\n\n# Async\nasync for event in client.watch_strategy('strat-uuid'):\n    print(event.type, event.data)`} lang="py" />}
        {lang === 'rust' && <Code code={`let mut stream = client.watch_strategy("strat-uuid").await?;\nwhile let Some(event) = stream.next().await {\n    let event = event?;\n    println!("{}: {:?}", event.event_type, event.data);\n    if event.event_type == "STRATEGY_STOPPED" { break; }\n}`} lang="rust" />}
        {lang === 'curl' && <Code code={`curl -N https://api.polyforge.app/api/v1/strategies/strat-uuid/events \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Accept: text/event-stream"`} lang="curl" />}
      </Sub>
    </div>
  );

  /* ── Webhook Signatures ── */
  if (activeId === 'webhook-signatures') return (
    <div className="space-y-6">
      <PageTitle
        title="Webhook Signatures"
        subtitle="Every webhook POST includes an X-Polyforge-Signature header. Verify it to confirm the payload originated from Polyforge."
      />
      <Sub title="Signature format">
        <Code code={'X-Polyforge-Signature: sha256=<hex-digest>'} lang="curl" />
        <p className="text-xs text-pf-text-muted mt-2">
          Computed as <InlineCode>HMAC-SHA256(raw body bytes, webhookSecret)</InlineCode>.
        </p>
      </Sub>
      <Sub title="Verification example">
        <LangTabs lang={lang} setLang={setLang} available={['ts', 'py']} />
        {(lang === 'curl' || lang === 'rust' || lang === 'ts') && <Code code={`import { createHmac, timingSafeEqual } from 'node:crypto';\n\nfunction verifyWebhook(rawBody: Buffer, signature: string, secret: string): boolean {\n  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));\n}`} lang="ts" />}
        {lang === 'py' && <Code code={`import hmac, hashlib\n\ndef verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:\n    expected = 'sha256=' + hmac.new(\n        secret.encode(), raw_body, hashlib.sha256\n    ).hexdigest()\n    return hmac.compare_digest(expected, signature)`} lang="py" />}
      </Sub>
      <Sub title="Webhook events">
        <div className="flex flex-wrap gap-1.5">
          {['ORDER_FILLED','ORDER_CANCELLED','STRATEGY_STARTED','STRATEGY_STOPPED',
            'STRATEGY_ERROR','BACKTEST_COMPLETED','PRICE_ALERT','WHALE_TRADE',
            'NEWS_SIGNAL','MARKET_RESOLVED'].map(ev => (
            <InlineCode key={ev}>{ev}</InlineCode>
          ))}
        </div>
      </Sub>
    </div>
  );

  /* ── Rate Limits ── */
  if (activeId === 'rate-limits') return (
    <div className="space-y-6">
      <PageTitle
        title="Rate Limits"
        subtitle="120 requests per minute per API key. Exceeding the limit returns 429 with a Retry-After header."
      />
      <div className="border border-pf-border rounded-pf-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border">
              <th scope="col" className="px-4 py-3 font-medium">Header</th>
              <th scope="col" className="px-4 py-3 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pf-border-subtle">
            {[
              ['X-RateLimit-Limit',     'Maximum requests per window (120)'],
              ['X-RateLimit-Remaining', 'Requests remaining in the current window'],
              ['X-RateLimit-Reset',     'Unix timestamp when the window resets'],
              ['Retry-After',           'Seconds to wait (only on 429 responses)'],
            ].map(([h, v]) => (
              <tr key={h} className="group hover:bg-pf-elevated/50 transition-colors">
                <td className="px-4 py-3 font-mono text-pf-cyan-400 text-xs">{h}</td>
                <td className="px-4 py-3 text-pf-text-secondary text-xs">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-pf-text-muted bg-pf-elevated border border-pf-border rounded-pf px-3 py-2.5">
        Auth endpoints (register, forgot-password) have tighter per-IP limits.
        The SSE endpoint does not count toward the rate limit while the connection is held open.
      </p>
    </div>
  );

  /* ── Error Handling ── */
  if (activeId === 'error-handling') return (
    <div className="space-y-6">
      <PageTitle
        title="Error Handling"
        subtitle="All errors return a consistent JSON shape with a machine-readable code, human-readable message, and requestId."
      />
      <Sub title="Error shape">
        <Code code={`{\n  "statusCode": 422,\n  "code": "STRATEGY_IS_RUNNING",\n  "message": "Stop the strategy before editing its blocks",\n  "field": null,\n  "requestId": "req_5f3a1e"\n}`} lang="ts" />
      </Sub>
      <Sub title="HTTP status codes">
        <div className="border border-pf-border rounded-pf-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border">
                <th scope="col" className="px-4 py-3 font-medium w-16">Code</th>
                <th scope="col" className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {[
                [400, 'Bad Request — invalid parameters or malformed body'],
                [401, 'Unauthorized — missing, invalid, or expired API key'],
                [403, 'Forbidden — key lacks the required scope'],
                [404, 'Not Found — resource does not exist'],
                [409, 'Conflict — action conflicts with current state'],
                [422, 'Unprocessable — business logic validation failed'],
                [429, 'Too Many Requests — rate limit exceeded; see Retry-After'],
                [500, 'Server Error — unexpected error; include requestId when reporting'],
              ].map(([code, meaning]) => (
                <tr key={code} className="group hover:bg-pf-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-pf-text text-xs font-medium">{code}</td>
                  <td className="px-4 py-3 text-pf-text-secondary text-xs">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sub>
      <Sub title="Retry pattern">
        <LangTabs lang={lang} setLang={setLang} available={['ts', 'py']} />
        {(lang === 'curl' || lang === 'rust' || lang === 'ts') && <Code code={`async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {\n  for (let attempt = 0; attempt <= maxRetries; attempt++) {\n    try {\n      return await fn();\n    } catch (err: any) {\n      if (err.status === 429 && attempt < maxRetries) {\n        const wait = (err.retryAfter ?? (2 ** attempt)) * 1000;\n        await new Promise(r => setTimeout(r, wait));\n        continue;\n      }\n      throw err;\n    }\n  }\n  throw new Error('Max retries exceeded');\n}`} lang="ts" />}
        {lang === 'py' && <Code code={`import time\nfrom polyforge import RateLimitError\n\ndef with_retry(fn, max_retries=3):\n    for attempt in range(max_retries + 1):\n        try:\n            return fn()\n        except RateLimitError as e:\n            if attempt == max_retries:\n                raise\n            time.sleep(e.retry_after or 2 ** attempt)`} lang="py" />}
      </Sub>
    </div>
  );

  /* ── Service Status ── */
  if (activeId === 'status') return <StatusSection />;

  /* ── MCP Server ── */
  if (activeId === 'mcp-server') return <McpSection />;

  return null;
}
