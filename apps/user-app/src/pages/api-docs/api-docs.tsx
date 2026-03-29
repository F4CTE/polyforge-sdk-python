import { useState, useRef } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { EndpointDef, EndpointField } from './api-docs-endpoints';
import { MARKETS, STRATEGIES, LIVE_WATCHING, TRADING, ORDERS,
  CONDITIONAL_ORDERS, PORTFOLIO, BACKTESTS, COPY_TRADING,
  WHALE_FEED, NEWS_SIGNALS, ALERTS, WEBHOOKS, SCORES } from './api-docs-endpoints';

type Lang = 'curl' | 'ts' | 'py' | 'rust';

/* ─── Constants ──────────────────────────────────────────────────── */

// Method: pill badges matching app status badge pattern
const METHOD_CLS: Record<string, string> = {
  GET:    'bg-pf-success/10 text-pf-success',
  POST:   'bg-pf-info/10 text-pf-info',
  PATCH:  'bg-pf-warning/10 text-pf-warning',
  DELETE: 'bg-pf-danger/10 text-pf-danger',
};
const METHOD_BORDER: Record<string, string> = {
  GET:    'border-l-pf-success/50',
  POST:   'border-l-pf-info/50',
  PATCH:  'border-l-pf-warning/50',
  DELETE: 'border-l-pf-danger/50',
};
const SCOPE_CLS: Record<string, string> = {
  READ:  'bg-pf-success/10 text-pf-success',
  WRITE: 'bg-pf-info/10 text-pf-info',
  TRADE: 'bg-pf-warning/10 text-pf-warning',
  None:  'bg-pf-overlay text-pf-text-muted',
};
const LANG_LABELS: Record<Lang, string> = { curl: 'cURL', ts: 'TypeScript', py: 'Python', rust: 'Rust' };

/* ─── Primitive components ───────────────────────────────────────── */

// Pill badge — matches app's status badge pattern exactly
function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {text}
    </span>
  );
}

// Code block — clean, no macOS decorations; matches app's monospace surfaces
function Code({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="rounded-pf-lg overflow-hidden border border-pf-border">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 bg-pf-surface border-b border-pf-border">
          <span className="text-[11px] font-mono text-pf-text-muted">{LANG_LABELS[lang as Lang] ?? lang}</span>
        </div>
      )}
      <pre className="bg-pf-base px-4 py-3.5 text-[11.5px] font-mono text-pf-text overflow-x-auto whitespace-pre leading-relaxed">
        {code.trim()}
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return (
    <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-[11px] font-mono text-pf-cyan-300">
      {children}
    </code>
  );
}

// Table — matches app's exact table pattern: bg-pf-surface header, divide-y rows, uppercase tracking-wider
function FieldTable({ fields }: { fields: EndpointField[] }) {
  return (
    <div className="border border-pf-border rounded-pf-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border">
            <th scope="col" className="px-4 py-3 font-medium">Field</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            <th scope="col" className="px-4 py-3 font-medium">Req.</th>
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pf-border-subtle">
          {fields.map(f => (
            <tr key={f.name} className="group hover:bg-pf-elevated/50 transition-colors">
              <td className="px-4 py-3 font-mono text-pf-cyan-400 text-xs">{f.name}</td>
              <td className="px-4 py-3 text-pf-text-secondary text-xs">{f.type}</td>
              <td className="px-4 py-3 text-xs">
                {f.required ? <span className="text-pf-success">✓</span> : <span className="text-pf-text-muted">—</span>}
              </td>
              <td className="px-4 py-3 text-pf-text-secondary text-xs leading-relaxed">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Lang tabs — matches app's filter chip pattern (rounded-full border pills)
function LangTabs({ lang, setLang, available }: { lang: Lang; setLang: (l: Lang) => void; available: Lang[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {available.map(l => (
        <button
          type="button"
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            lang === l
              ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
              : 'border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text'
          }`}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

// Sub-section label — matches app's table header label style
function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-pf-text-muted uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// Endpoint accordion — left method border, hover lift, matches app card pattern
function EndpointCard({ ep, lang, setLang }: { ep: EndpointDef; lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const available = (Object.keys(ep.examples) as Lang[]).filter(k => ep.examples[k]);
  const code = ep.examples[lang] ?? ep.examples[available[0] ?? 'curl'] ?? '';

  return (
    <div className={`border border-pf-border border-l-[3px] ${METHOD_BORDER[ep.method]} rounded-pf-lg overflow-hidden transition-all duration-200 ${open ? '' : 'hover:border-pf-border-strong'}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-pf-elevated hover:bg-pf-elevated/80 text-left transition-colors duration-200 cursor-pointer"
        aria-expanded={open}
      >
        <Badge text={ep.method} cls={METHOD_CLS[ep.method]} />
        <code className="flex-1 text-xs font-mono text-pf-text">{ep.path}</code>
        <span className="hidden sm:block text-xs text-pf-text-muted mr-2 truncate max-w-48">{ep.summary}</span>
        <Badge text={ep.scope} cls={`${SCOPE_CLS[ep.scope]} hidden sm:inline-flex`} />
        {open
          ? <ChevronDown className="size-4 text-pf-text-muted shrink-0" />
          : <ChevronRight className="size-4 text-pf-text-muted shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-pf-border bg-pf-base px-4 py-5 space-y-5">
          <p className="text-sm text-pf-text-secondary leading-relaxed">{ep.description ?? ep.summary}</p>
          {ep.queryParams && ep.queryParams.length > 0 && (
            <Sub title="Query Parameters"><FieldTable fields={ep.queryParams} /></Sub>
          )}
          {ep.requestFields && ep.requestFields.length > 0 && (
            <Sub title="Request Body"><FieldTable fields={ep.requestFields} /></Sub>
          )}
          {ep.responseNote && (
            <p className="text-xs text-pf-text-muted bg-pf-elevated border border-pf-border rounded-pf px-3 py-2.5">
              {ep.responseNote}
            </p>
          )}
          {available.length > 0 && (
            <>
              <LangTabs lang={lang} setLang={setLang} available={available} />
              <Code code={code} lang={lang} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Page section header — matches app's h1 style + subtitle pattern
function PageTitle({ title, subtitle, count }: { title: string; subtitle?: string; count?: number }) {
  return (
    <div className="pb-5 mb-6 border-b border-pf-border-subtle">
      <div className="flex items-center gap-3 mb-1.5">
        <h1 className="text-2xl font-semibold text-pf-text">{title}</h1>
        {count !== undefined && (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted">
            {count} endpoint{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-pf-text-secondary leading-relaxed">{subtitle}</p>}
    </div>
  );
}

/* ─── Navigation data ────────────────────────────────────────────── */

const NAV_GROUPS = [
  { group: null as string | null, items: [
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'sdks', label: 'SDKs & Clients' },
  ]},
  { group: 'Reference', items: [
    { id: 'markets', label: 'Markets' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'live-watching', label: 'Execution Watching' },
    { id: 'trading', label: 'Direct Trading' },
    { id: 'orders', label: 'Orders' },
    { id: 'conditional-orders', label: 'Conditional Orders' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'backtests', label: 'Backtests' },
    { id: 'copy-trading', label: 'Copy Trading' },
    { id: 'whale-feed', label: 'Whale Feed' },
    { id: 'news-signals', label: 'News & Signals' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'webhooks', label: 'Webhooks' },
    { id: 'scores', label: 'Scores' },
  ]},
  { group: 'Real-time', items: [
    { id: 'websocket', label: 'WebSocket' },
    { id: 'sse', label: 'SSE Events' },
    { id: 'webhook-signatures', label: 'Webhook Signatures' },
  ]},
  { group: 'Guides', items: [
    { id: 'rate-limits', label: 'Rate Limits' },
    { id: 'error-handling', label: 'Error Handling' },
    { id: 'mcp-server', label: 'MCP Server (Claude)' },
  ]},
];

const ENDPOINT_SECTIONS: { id: string; title: string; eps: EndpointDef[] }[] = [
  { id: 'markets',            title: 'Markets',            eps: MARKETS },
  { id: 'strategies',         title: 'Strategies',         eps: STRATEGIES },
  { id: 'live-watching',      title: 'Execution Watching', eps: LIVE_WATCHING },
  { id: 'trading',            title: 'Direct Trading',     eps: TRADING },
  { id: 'orders',             title: 'Orders',             eps: ORDERS },
  { id: 'conditional-orders', title: 'Conditional Orders', eps: CONDITIONAL_ORDERS },
  { id: 'portfolio',          title: 'Portfolio',          eps: PORTFOLIO },
  { id: 'backtests',          title: 'Backtests',          eps: BACKTESTS },
  { id: 'copy-trading',       title: 'Copy Trading',       eps: COPY_TRADING },
  { id: 'whale-feed',         title: 'Whale Feed',         eps: WHALE_FEED },
  { id: 'news-signals',       title: 'News & Signals',     eps: NEWS_SIGNALS },
  { id: 'alerts',             title: 'Alerts',             eps: ALERTS },
  { id: 'webhooks',           title: 'Webhooks',           eps: WEBHOOKS },
  { id: 'scores',             title: 'Scores',             eps: SCORES },
];

/* ─── Main Component ─────────────────────────────────────────────── */

export function Component() {
  const [lang, setLang] = useState<Lang>('curl');
  const [activeId, setActiveId] = useState('getting-started');
  const contentRef = useRef<HTMLDivElement>(null);

  function navigate(id: string) {
    setActiveId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activeId))?.group;
  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeId)?.label ?? '';

  function renderContent() {

    /* ── Getting Started ── */
    if (activeId === 'getting-started') return (
      <div className="space-y-6">
        <PageTitle
          title="Getting Started"
          subtitle="Three steps to make your first API call against the Polyforge REST API."
        />
        {/* Base URL card — matches app elevated card pattern */}
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
            { step: '1', title: 'Create an API key', body: (
              <p className="text-sm text-pf-text-secondary">
                Go to <Link to="/settings" className="text-pf-cyan-400 hover:text-pf-cyan-300 underline underline-offset-2">Settings → API Keys</Link> and
                click <strong className="text-pf-text">Create Key</strong>. Choose the scopes you need
                (<InlineCode>READ</InlineCode> / <InlineCode>WRITE</InlineCode> / <InlineCode>TRADE</InlineCode>) and
                copy the key — it is shown only once.
              </p>
            )},
            { step: '2', title: 'Set the Authorization header', body: (
              <Code code={'Authorization: Bearer pf_live_your_key_here'} lang="curl" />
            )},
            { step: '3', title: 'Make your first call', body: (
              <>
                <LangTabs lang={lang} setLang={setLang} available={['curl', 'ts', 'py', 'rust']} />
                {lang === 'curl' && <Code code={`curl https://api.polyforge.app/api/v1/markets \\\n  -H "Authorization: Bearer pf_live_..."`} lang="curl" />}
                {lang === 'ts' && <Code code={`import { PolyforgeClient } from '@polyforge/sdk';\n\nconst client = new PolyforgeClient({ apiKey: 'pf_live_...' });\nconst { data } = await client.listMarkets({ limit: 5 });\ndata.forEach(m => console.log(m.title, m.tokens[0]?.price));`} lang="ts" />}
                {lang === 'py' && <Code code={`from polyforge import PolyforgeClient\n\nwith PolyforgeClient(api_key='pf_live_...') as client:\n    markets = client.list_markets(limit=5)\n    for m in markets.items:\n        print(m.title, m.tokens[0].price)`} lang="py" />}
                {lang === 'rust' && <Code code={`use polyforge::PolyforgeClient;\n\n#[tokio::main]\nasync fn main() -> polyforge::Result<()> {\n    let client = PolyforgeClient::new("pf_live_...");\n    let markets = client.list_markets(&Default::default()).await?;\n    for m in &markets.data { println!("{}", m.title); }\n    Ok(())\n}`} lang="rust" />}
              </>
            )},
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
            <Badge text="Claude Desktop" cls="bg-pf-purple-500/10 text-pf-purple-400" />
          </div>
          <Code code={'npx @polyforge/mcp-server'} lang="curl" />
          <p className="text-xs text-pf-text-secondary">
            23 tools covering markets, strategies, orders, and live events.{' '}
            <button type="button" onClick={() => navigate('mcp-server')} className="text-pf-cyan-400 hover:text-pf-cyan-300 underline underline-offset-2 cursor-pointer">Setup guide →</button>
          </p>
        </div>
      </div>
    );

    /* ── Endpoint reference sections ── */
    const epSection = ENDPOINT_SECTIONS.find(s => s.id === activeId);
    if (epSection) return (
      <div className="space-y-3">
        <PageTitle title={epSection.title} count={epSection.eps.length} />
        {epSection.eps.map((ep, i) => (
          <EndpointCard key={i} ep={ep} lang={lang} setLang={setLang} />
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

    /* ── MCP Server ── */
    if (activeId === 'mcp-server') return (
      <div className="space-y-6">
        <PageTitle
          title="MCP Server (Claude)"
          subtitle="23 tools for Claude Desktop and Claude Code covering markets, strategies, portfolio, orders, whale feed, news signals, and live execution watching."
        />
        <Sub title="Claude Desktop setup">
          <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>claude_desktop_config.json</InlineCode>:</p>
          <Code code={`{\n  "mcpServers": {\n    "polyforge": {\n      "command": "npx",\n      "args": ["@polyforge/mcp-server"],\n      "env": {\n        "POLYFORGE_API_URL": "https://api.polyforge.app",\n        "POLYFORGE_API_KEY": "pf_live_your_key"\n      }\n    }\n  }\n}`} lang="ts" />
        </Sub>
        <Sub title="Claude Code setup">
          <Code code={'claude mcp add polyforge -- npx @polyforge/mcp-server\nexport POLYFORGE_API_KEY=pf_live_your_key'} lang="curl" />
        </Sub>
        <Sub title="Available tools">
          <div className="flex flex-wrap gap-1.5">
            {['list_markets','get_market','list_strategies','get_strategy',
              'create_strategy','create_strategy_from_description','start_strategy',
              'stop_strategy','get_strategy_templates','export_strategy',
              'get_strategy_events','get_portfolio','get_orders','get_score',
              'place_order','cancel_order','get_whale_feed','get_news_signals',
              'list_alerts','list_copy_configs','list_webhooks','create_webhook',
              'ai_query'].map(tool => (
              <InlineCode key={tool}>{tool}</InlineCode>
            ))}
          </div>
        </Sub>
        <Sub title="Example prompts">
          <div className="space-y-2">
            {[
              '"What are the top prediction markets about crypto right now?"',
              '"Create a strategy that buys YES when price drops below 0.30"',
              '"Start my momentum strategy in paper mode and watch for events"',
              '"Show me whale trades over $50,000 from the last hour"',
              '"What\'s my portfolio P&L this week?"',
            ].map(p => (
              <p key={p} className="text-xs text-pf-text-secondary bg-pf-elevated border border-pf-border rounded-pf px-3.5 py-2.5 font-mono hover:border-pf-border-strong transition-all duration-200">{p}</p>
            ))}
          </div>
        </Sub>
      </div>
    );

    return null;
  }

  return (
    <div className="flex h-screen animate-fade-in">

      {/* ── Sidebar — bg-pf-surface matches app's surface panels ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-pf-border bg-pf-surface overflow-y-auto">

        {/* Branding */}
        <div className="px-4 py-4 border-b border-pf-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-pf-text">API Reference</span>
            <Badge text="v1" cls="bg-pf-cyan-500/10 text-pf-cyan-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pf-success shrink-0" />
            <code className="text-[11px] font-mono text-pf-text-muted">api.polyforge.app</code>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map(g => (
            <div key={g.group ?? 'overview'}>
              {g.group && (
                <p className="text-xs font-medium text-pf-text-muted uppercase tracking-wider mb-1.5 px-2">{g.group}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-pf text-sm transition-colors duration-150 cursor-pointer border-l-2 ${
                      activeId === item.id
                        ? 'border-pf-cyan-500 bg-pf-cyan-500/10 text-pf-cyan-400 font-medium'
                        : 'border-transparent text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-pf-border shrink-0">
          <Link to="/settings" className="text-xs text-pf-text-muted hover:text-pf-text transition-colors">
            Settings → API Keys
          </Link>
        </div>
      </aside>

      {/* ── Content ── */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto bg-pf-base">

        {/* Breadcrumb — matches app's secondary text style */}
        <nav aria-label="Breadcrumb" className="sticky top-0 z-10 flex items-center gap-1.5 px-6 py-3 bg-pf-base/90 backdrop-blur-sm border-b border-pf-border text-xs text-pf-text-muted">
          <span>Docs</span>
          <ChevronRight className="size-3 shrink-0" />
          {currentGroup && <><span>{currentGroup}</span><ChevronRight className="size-3 shrink-0" /></>}
          <span className="text-pf-text-secondary">{currentLabel}</span>
        </nav>

        <div className="max-w-3xl mx-auto px-6 py-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
