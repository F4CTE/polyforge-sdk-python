import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { EndpointDef, EndpointField } from './api-docs-endpoints';
import { MARKETS, STRATEGIES, LIVE_WATCHING, TRADING, ORDERS,
  CONDITIONAL_ORDERS, PORTFOLIO, BACKTESTS, COPY_TRADING,
  WHALE_FEED, NEWS_SIGNALS, ALERTS, WEBHOOKS, SCORES } from './api-docs-endpoints';

/* ─── Types ─────────────────────────────────────────────────────────── */

type Lang = 'curl' | 'ts' | 'py' | 'rust';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const METHOD_CLS: Record<string, string> = {
  GET:    'bg-emerald-500/10 text-emerald-400',
  POST:   'bg-sky-500/10 text-sky-400',
  PATCH:  'bg-amber-500/10 text-amber-400',
  DELETE: 'bg-red-500/10 text-red-400',
};
const SCOPE_CLS: Record<string, string> = {
  READ:  'bg-emerald-500/10 text-emerald-400',
  WRITE: 'bg-sky-500/10 text-sky-400',
  TRADE: 'bg-amber-500/10 text-amber-400',
  None:  'bg-pf-overlay text-pf-text-muted',
};
const LANG_LABELS: Record<Lang, string> = { curl: 'curl', ts: 'TypeScript', py: 'Python', rust: 'Rust' };

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>{text}</span>;
}

function Code({ code }: { code: string }) {
  return (
    <pre className="bg-pf-base border border-pf-border rounded-pf p-4 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre leading-5">
      {code.trim()}
    </pre>
  );
}

function InlineCode({ children }: { children: string }) {
  return <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-[11px] font-mono text-pf-cyan-300">{children}</code>;
}

function FieldTable({ fields }: { fields: EndpointField[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-pf-border">
            <th className="text-left py-1.5 pr-4 font-semibold text-pf-text-muted">Field</th>
            <th className="text-left py-1.5 pr-4 font-semibold text-pf-text-muted">Type</th>
            <th className="text-left py-1.5 pr-4 font-semibold text-pf-text-muted">Req.</th>
            <th className="text-left py-1.5 font-semibold text-pf-text-muted">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.name} className="border-b border-pf-border-subtle">
              <td className="py-1.5 pr-4 font-mono text-pf-cyan-300">{f.name}</td>
              <td className="py-1.5 pr-4 text-pf-text-secondary">{f.type}</td>
              <td className="py-1.5 pr-4 text-pf-text-secondary">{f.required ? '✓' : '—'}</td>
              <td className="py-1.5 text-pf-text-secondary">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LangTabs({ lang, setLang, available }: { lang: Lang; setLang: (l: Lang) => void; available: Lang[] }) {
  return (
    <div className="flex gap-1 mb-2">
      {available.map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
            lang === l ? 'bg-pf-cyan-500/20 text-pf-cyan-300' : 'text-pf-text-muted hover:text-pf-text'
          }`}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

function EndpointCard({ ep, lang, setLang }: { ep: EndpointDef; lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const available = (Object.keys(ep.examples) as Lang[]).filter(k => ep.examples[k]);
  const code = ep.examples[lang] ?? ep.examples[available[0] ?? 'curl'] ?? '';
  return (
    <div className="border border-pf-border rounded-pf overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-pf-elevated hover:bg-pf-elevated/80 text-left transition-colors"
        aria-expanded={open}
      >
        <Badge text={ep.method} cls={METHOD_CLS[ep.method]} />
        <code className="flex-1 text-xs font-mono text-pf-text">{ep.path}</code>
        <Badge text={ep.scope} cls={SCOPE_CLS[ep.scope]} />
        <span className="text-pf-text-muted text-[18px] leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-pf-border bg-pf-surface px-4 py-4 space-y-4">
          <p className="text-sm text-pf-text-secondary leading-relaxed">
            {ep.description ?? ep.summary}
          </p>
          {ep.queryParams && ep.queryParams.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-pf-text mb-2">Query Parameters</p>
              <FieldTable fields={ep.queryParams} />
            </div>
          )}
          {ep.requestFields && ep.requestFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-pf-text mb-2">Request Body</p>
              <FieldTable fields={ep.requestFields} />
            </div>
          )}
          {ep.responseNote && (
            <p className="text-xs text-pf-text-muted">{ep.responseNote}</p>
          )}
          {available.length > 0 && (
            <div>
              <LangTabs lang={lang} setLang={setLang} available={available} />
              <Code code={code} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-5 border-b border-pf-border-subtle pb-10 mb-10 last:border-none last:mb-0">
      <h2 className="text-xl font-bold text-pf-text">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-pf-text">{title}</h3>
      {children}
    </div>
  );
}

/* ─── Navigation structure ───────────────────────────────────────────── */

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

/* ─── Endpoint data (imported at top of file) ────────────────────────── */

/* ─── Main Component ─────────────────────────────────────────────────── */

export function Component() {
  const [lang, setLang] = useState<Lang>('curl');
  const [activeId, setActiveId] = useState('getting-started');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { root: document.getElementById('main-content'), rootMargin: '0px 0px -80% 0px', threshold: 0 }
    );
    const sectionEls = mainRef.current?.querySelectorAll('section[id]') ?? [];
    sectionEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const container = document.getElementById('main-content');
    if (container) {
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 24;
      container.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="flex animate-fade-in">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-pf-border-subtle bg-pf-surface overflow-y-auto py-6 px-3 sticky top-0 h-screen self-start">
        <div className="mb-6 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-pf-text-muted mb-0.5">Base URL</p>
          <code className="text-[10px] font-mono text-pf-cyan-300 break-all">api.polyforge.app</code>
        </div>
        {NAV_GROUPS.map(g => (
          <div key={g.group ?? 'overview'} className="mb-5">
            {g.group && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-pf-text-muted mb-1.5 px-2">{g.group}</p>
            )}
            {g.items.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors ${
                  activeId === item.id
                    ? 'bg-pf-cyan-500/10 text-pf-cyan-300 font-medium'
                    : 'text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* ── Content ── */}
      <div ref={mainRef} className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-pf-text mb-2">API Reference</h1>
            <p className="text-pf-text-secondary leading-relaxed">
              Build on Polyforge — automate strategies, query markets, place orders, and receive real-time events.
            </p>
            <div className="flex flex-wrap gap-3 mt-4 text-xs">
              <span className="flex items-center gap-1.5 bg-pf-elevated border border-pf-border rounded px-3 py-1.5 font-mono text-pf-cyan-300">
                https://api.polyforge.app/api/v1
              </span>
              <span className="flex items-center gap-1.5 bg-pf-elevated border border-pf-border rounded px-3 py-1.5 text-pf-text-secondary">
                REST · JSON · TLS 1.2+
              </span>
            </div>
          </div>

          {/* ── Getting Started ── */}
          <Section id="getting-started" title="Getting Started">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              Three steps to make your first API call.
            </p>
            <div className="space-y-3">
              {[
                { step: '1', title: 'Create an API key', body: (
                  <p className="text-sm text-pf-text-secondary">
                    Go to <Link to="/settings" className="text-pf-cyan-400 hover:underline">Settings → API Keys</Link> and
                    click <strong className="text-pf-text">Create Key</strong>. Choose the scopes you need
                    (<InlineCode>READ</InlineCode> / <InlineCode>WRITE</InlineCode> / <InlineCode>TRADE</InlineCode>) and
                    copy the key — it is shown only once.
                  </p>
                )},
                { step: '2', title: 'Set the Authorization header', body: (
                  <Code code={'Authorization: Bearer pf_live_your_key_here'} />
                )},
                { step: '3', title: 'Make your first call', body: (
                  <>
                    <LangTabs lang={lang} setLang={setLang} available={['curl', 'ts', 'py', 'rust']} />
                    {lang === 'curl' && <Code code={`curl https://api.polyforge.app/api/v1/markets \\\n  -H "Authorization: Bearer pf_live_..."`} />}
                    {lang === 'ts' && <Code code={`import { PolyforgeClient } from '@polyforge/sdk';\n\nconst client = new PolyforgeClient({ apiKey: 'pf_live_...' });\nconst { data } = await client.listMarkets({ limit: 5 });\ndata.forEach(m => console.log(m.title, m.tokens[0]?.price));`} />}
                    {lang === 'py' && <Code code={`from polyforge import PolyforgeClient\n\nwith PolyforgeClient(api_key='pf_live_...') as client:\n    markets = client.list_markets(limit=5)\n    for m in markets.items:\n        print(m.title, m.tokens[0].price)`} />}
                    {lang === 'rust' && <Code code={`use polyforge::PolyforgeClient;\n\n#[tokio::main]\nasync fn main() -> polyforge::Result<()> {\n    let client = PolyforgeClient::new("pf_live_...");\n    let markets = client.list_markets(&Default::default()).await?;\n    for m in &markets.data { println!("{}", m.title); }\n    Ok(())\n}`} />}
                  </>
                )},
              ].map(({ step, title, body }) => (
                <div key={step} className="flex gap-4 p-4 bg-pf-elevated border border-pf-border rounded-pf">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 text-xs font-bold flex items-center justify-center">{step}</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-pf-text">{title}</p>
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Authentication ── */}
          <Section id="authentication" title="Authentication">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              All API requests authenticate with a <strong className="text-pf-text">Bearer token</strong> in the
              {' '}<InlineCode>Authorization</InlineCode> header. Tokens can be either a
              {' '}<strong className="text-pf-text">User JWT</strong> (issued by the web app at login) or an
              {' '}<strong className="text-pf-text">API key</strong> (created in Settings → API Keys). External tools
              should always use API keys — they are scoped, rotatable, and do not expire by default.
            </p>
            <Code code={'Authorization: Bearer pf_live_abc123...\nContent-Type: application/json'} />
            <Sub title="Scopes">
              <div className="space-y-2">
                {([
                  { scope: 'READ',  cls: SCOPE_CLS.READ,  desc: 'View markets, strategies, orders, portfolio, whale feed, signals, leaderboard.' },
                  { scope: 'WRITE', cls: SCOPE_CLS.WRITE, desc: 'Create/update strategies, alerts, webhooks, and run backtests.' },
                  { scope: 'TRADE', cls: SCOPE_CLS.TRADE, desc: 'Place and cancel orders, start/stop strategies, manage copy trading.' },
                ] as { scope: string; cls: string; desc: string }[]).map(s => (
                  <div key={s.scope} className="flex items-start gap-3 p-3 bg-pf-elevated border border-pf-border rounded-pf">
                    <Badge text={s.scope} cls={s.cls} />
                    <p className="text-xs text-pf-text-secondary leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </Sub>
            <Sub title="API Key lifecycle">
              <p className="text-sm text-pf-text-secondary leading-relaxed">
                Keys are prefixed <InlineCode>pf_</InlineCode>. The full key is shown <strong className="text-pf-text">once</strong> at
                creation — store it securely. Up to 10 active keys per account. Keys can have an optional expiry
                (<InlineCode>expiresInDays</InlineCode>). Revoke a key immediately via{' '}
                <InlineCode>DELETE /api/v1/api-keys/:id</InlineCode> or from the Settings page.
              </p>
            </Sub>
          </Section>

          {/* ── SDKs ── */}
          <Section id="sdks" title="SDKs & Clients">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              Typed clients for TypeScript, Python, and Rust. All SDKs mirror the REST API with full type safety,
              automatic retries on 429, and native streaming support for live execution events.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { lang: 'TypeScript', install: 'npm install @polyforge/sdk', color: 'text-sky-400', code: `import { PolyforgeClient } from '@polyforge/sdk';\nconst client = new PolyforgeClient({ apiKey: 'pf_...' });` },
                { lang: 'Python', install: 'pip install polyforge', color: 'text-amber-400', code: `from polyforge import PolyforgeClient\nclient = PolyforgeClient(api_key='pf_...')` },
                { lang: 'Rust', install: 'cargo add polyforge tokio', color: 'text-orange-400', code: `use polyforge::PolyforgeClient;\nlet client = PolyforgeClient::new("pf_...");` },
              ]).map(s => (
                <div key={s.lang} className="bg-pf-elevated border border-pf-border rounded-pf p-4 space-y-3">
                  <p className={`text-sm font-bold ${s.color}`}>{s.lang}</p>
                  <Code code={s.install} />
                  <Code code={s.code} />
                </div>
              ))}
            </div>
            <div className="p-4 bg-pf-elevated border border-pf-border rounded-pf space-y-2">
              <p className="text-sm font-bold text-purple-400">MCP Server — Claude Desktop</p>
              <Code code={'npx @polyforge/mcp-server'} />
              <p className="text-xs text-pf-text-secondary">
                23 tools for Claude Desktop covering markets, strategies, orders, and live execution watching.
                See the <a href="#mcp-server" onClick={e => { e.preventDefault(); scrollTo('mcp-server'); }} className="text-pf-cyan-400 hover:underline">MCP Server</a> section for setup.
              </p>
            </div>
          </Section>

          {/* ── Endpoint sections ── */}
          {[
            { id: 'markets',           title: 'Markets',              eps: MARKETS },
            { id: 'strategies',        title: 'Strategies',           eps: STRATEGIES },
            { id: 'live-watching',     title: 'Execution Watching',   eps: LIVE_WATCHING },
            { id: 'trading',           title: 'Direct Trading',       eps: TRADING },
            { id: 'orders',            title: 'Orders',               eps: ORDERS },
            { id: 'conditional-orders',title: 'Conditional Orders',   eps: CONDITIONAL_ORDERS },
            { id: 'portfolio',         title: 'Portfolio',            eps: PORTFOLIO },
            { id: 'backtests',         title: 'Backtests',            eps: BACKTESTS },
            { id: 'copy-trading',      title: 'Copy Trading',         eps: COPY_TRADING },
            { id: 'whale-feed',        title: 'Whale Feed',           eps: WHALE_FEED },
            { id: 'news-signals',      title: 'News & Signals',       eps: NEWS_SIGNALS },
            { id: 'alerts',            title: 'Alerts',               eps: ALERTS },
            { id: 'webhooks',          title: 'Webhooks',             eps: WEBHOOKS },
            { id: 'scores',            title: 'Scores',               eps: SCORES },
          ].map(({ id, title, eps }) => (
            <Section key={id} id={id} title={title}>
              <div className="space-y-2">
                {eps.map((ep, i) => (
                  <EndpointCard key={i} ep={ep} lang={lang} setLang={setLang} />
                ))}
              </div>
            </Section>
          ))}

          {/* ── WebSocket ── */}
          <Section id="websocket" title="WebSocket">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              The WebSocket gateway provides real-time push events for orders, strategies, and notifications.
              Connect with a valid JWT (obtained from the login endpoint or the web app).
            </p>
            <Sub title="Connection">
              <Code code={'wss://api.polyforge.app/ws?token=<JWT>'} />
            </Sub>
            <Sub title="Subscribe to a strategy">
              <Code code={`// Send after connection opens
{ "event": "subscribe", "data": { "strategyId": "strat-uuid" } }`} />
            </Sub>
            <Sub title="Inbound event types">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-pf-border">
                      <th className="text-left py-1.5 pr-6 font-semibold text-pf-text-muted">Event</th>
                      <th className="text-left py-1.5 font-semibold text-pf-text-muted">Payload</th>
                    </tr>
                  </thead>
                  <tbody>
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
                      <tr key={ev} className="border-b border-pf-border-subtle">
                        <td className="py-1.5 pr-6 font-mono text-pf-cyan-300">{ev}</td>
                        <td className="py-1.5 text-pf-text-secondary font-mono">{payload}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sub>
          </Section>

          {/* ── SSE ── */}
          <Section id="sse" title="SSE Events">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              The SSE endpoint is designed for API-key-authenticated clients (SDKs, scripts, AI agents) that
              cannot use WebSocket JWT auth. It streams execution events for a single strategy over a persistent
              HTTP connection using the <InlineCode>text/event-stream</InlineCode> protocol.
            </p>
            <Sub title="Endpoint">
              <Code code={'GET /api/v1/strategies/:id/events\nAuthorization: Bearer pf_live_...\nAccept: text/event-stream'} />
              <p className="text-xs text-pf-text-muted mt-2">Scope required: <strong>READ</strong> · Heartbeat comment every 15 s</p>
            </Sub>
            <Sub title="Event shape">
              <Code code={`{
  "type": "ORDER_FILLED",
  "strategyId": "uuid",
  "data": { "orderId": "...", "price": 0.62 },
  "timestamp": 1711720000000
}`} />
              <p className="text-xs text-pf-text-muted mt-2">First event is always <InlineCode>{'{"type":"CONNECTED","strategyId":"...","timestamp":...}'}</InlineCode></p>
            </Sub>
            <Sub title="SDK usage">
              <LangTabs lang={lang} setLang={setLang} available={['ts', 'py', 'rust']} />
              {lang === 'ts' && <Code code={`const ac = new AbortController();\nfor await (const event of client.watchStrategy('strat-uuid', ac.signal)) {\n  console.log(event.type, event.data);\n  if (event.type === 'STRATEGY_STOPPED') break;\n}\n// Stop watching:\nac.abort();`} />}
              {lang === 'py' && <Code code={`# Synchronous\nfor event in client.watch_strategy('strat-uuid'):\n    print(event.type, event.data)\n    if event.type == 'STRATEGY_STOPPED':\n        break\n\n# Async\nasync for event in client.watch_strategy('strat-uuid'):\n    print(event.type, event.data)`} />}
              {lang === 'rust' && <Code code={`let mut stream = client.watch_strategy("strat-uuid").await?;\nwhile let Some(event) = stream.next().await {\n    let event = event?;\n    println!("{}: {:?}", event.event_type, event.data);\n    if event.event_type == "STRATEGY_STOPPED" { break; }\n}`} />}
              {lang === 'curl' && <Code code={`curl -N https://api.polyforge.app/api/v1/strategies/strat-uuid/events \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Accept: text/event-stream"`} />}
            </Sub>
          </Section>

          {/* ── Webhook Signatures ── */}
          <Section id="webhook-signatures" title="Webhook Signatures">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              Every webhook POST includes an <InlineCode>X-Polyforge-Signature</InlineCode> header.
              Verify it to confirm the payload originated from Polyforge and has not been tampered with.
            </p>
            <Sub title="Signature format">
              <Code code={'X-Polyforge-Signature: sha256=<hex-digest>'} />
              <p className="text-xs text-pf-text-muted mt-2">
                Computed as <InlineCode>HMAC-SHA256(raw body bytes, webhookSecret)</InlineCode>.
                The secret is the <InlineCode>secret</InlineCode> value returned when you create a webhook.
              </p>
            </Sub>
            <Sub title="Verification example">
              <LangTabs lang={lang} setLang={setLang} available={['ts', 'py']} />
              {(lang === 'curl' || lang === 'rust' || lang === 'ts') && <Code code={`import { createHmac, timingSafeEqual } from 'node:crypto';\n\nfunction verifyWebhook(rawBody: Buffer, signature: string, secret: string): boolean {\n  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));\n}`} />}
              {lang === 'py' && <Code code={`import hmac, hashlib\n\ndef verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:\n    expected = 'sha256=' + hmac.new(\n        secret.encode(), raw_body, hashlib.sha256\n    ).hexdigest()\n    return hmac.compare_digest(expected, signature)`} />}
            </Sub>
            <Sub title="Webhook events">
              <div className="flex flex-wrap gap-2">
                {['ORDER_FILLED','ORDER_CANCELLED','STRATEGY_STARTED','STRATEGY_STOPPED',
                  'STRATEGY_ERROR','BACKTEST_COMPLETED','PRICE_ALERT','WHALE_TRADE',
                  'NEWS_SIGNAL','MARKET_RESOLVED'].map(ev => (
                  <InlineCode key={ev}>{ev}</InlineCode>
                ))}
              </div>
            </Sub>
          </Section>

          {/* ── Rate Limits ── */}
          <Section id="rate-limits" title="Rate Limits">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              API keys are limited to <strong className="text-pf-text">120 requests per minute</strong>.
              Exceeding the limit returns <InlineCode>429 Too Many Requests</InlineCode> with a
              {' '}<InlineCode>Retry-After</InlineCode> header (seconds to wait).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-pf-border">
                    <th className="text-left py-2 pr-6 font-semibold text-pf-text-muted">Header</th>
                    <th className="text-left py-2 font-semibold text-pf-text-muted">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['X-RateLimit-Limit',     'Maximum requests per window (120)'],
                    ['X-RateLimit-Remaining', 'Requests remaining in the current window'],
                    ['X-RateLimit-Reset',     'Unix timestamp when the window resets'],
                    ['Retry-After',           'Seconds to wait (only on 429 responses)'],
                  ].map(([h, v]) => (
                    <tr key={h} className="border-b border-pf-border-subtle">
                      <td className="py-2 pr-6 font-mono text-pf-cyan-300">{h}</td>
                      <td className="py-2 text-pf-text-secondary">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-pf-text-muted">
              Certain write endpoints (e.g. register, forgot-password) have tighter per-IP limits.
              The SSE endpoint does not count toward the rate limit window while the connection is held open.
            </p>
          </Section>

          {/* ── Error Handling ── */}
          <Section id="error-handling" title="Error Handling">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              All errors return a consistent JSON shape with a machine-readable <InlineCode>code</InlineCode> you
              can branch on, a human-readable <InlineCode>message</InlineCode>, and a
              {' '}<InlineCode>requestId</InlineCode> to share with support.
            </p>
            <Sub title="Error shape">
              <Code code={`{\n  "statusCode": 422,\n  "code": "STRATEGY_IS_RUNNING",\n  "message": "Stop the strategy before editing its blocks",\n  "field": null,\n  "requestId": "req_5f3a1e"\n}`} />
            </Sub>
            <Sub title="HTTP status codes">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-pf-border">
                      <th className="text-left py-1.5 w-14 font-semibold text-pf-text-muted">Code</th>
                      <th className="text-left py-1.5 font-semibold text-pf-text-muted">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [400, 'Bad Request — invalid parameters or malformed body'],
                      [401, 'Unauthorized — missing, invalid, or expired API key'],
                      [403, 'Forbidden — key lacks the required scope, or resource belongs to another user'],
                      [404, 'Not Found — resource does not exist'],
                      [409, 'Conflict — action conflicts with current state (e.g. already running)'],
                      [422, 'Unprocessable — business logic validation failed'],
                      [429, 'Too Many Requests — rate limit exceeded; see Retry-After header'],
                      [500, 'Server Error — unexpected error; include requestId when reporting'],
                    ].map(([code, meaning]) => (
                      <tr key={code} className="border-b border-pf-border-subtle">
                        <td className="py-1.5 font-mono text-pf-text">{code}</td>
                        <td className="py-1.5 text-pf-text-secondary">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sub>
            <Sub title="Retry pattern">
              <LangTabs lang={lang} setLang={setLang} available={['ts', 'py']} />
              {(lang === 'curl' || lang === 'rust' || lang === 'ts') && <Code code={`async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {\n  for (let attempt = 0; attempt <= maxRetries; attempt++) {\n    try {\n      return await fn();\n    } catch (err: any) {\n      if (err.status === 429 && attempt < maxRetries) {\n        const wait = (err.retryAfter ?? (2 ** attempt)) * 1000;\n        await new Promise(r => setTimeout(r, wait));\n        continue;\n      }\n      throw err;\n    }\n  }\n  throw new Error('Max retries exceeded');\n}`} />}
              {lang === 'py' && <Code code={`import time\nfrom polyforge import RateLimitError\n\ndef with_retry(fn, max_retries=3):\n    for attempt in range(max_retries + 1):\n        try:\n            return fn()\n        except RateLimitError as e:\n            if attempt == max_retries:\n                raise\n            time.sleep(e.retry_after or 2 ** attempt)`} />}
            </Sub>
          </Section>

          {/* ── MCP Server ── */}
          <Section id="mcp-server" title="MCP Server (Claude)">
            <p className="text-sm text-pf-text-secondary leading-relaxed">
              The Polyforge MCP server exposes <strong className="text-pf-text">23 tools</strong> for Claude
              Desktop and Claude Code, covering markets, strategies, portfolio, orders, whale feed, news signals,
              and live execution watching.
            </p>
            <Sub title="Claude Desktop setup">
              <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>claude_desktop_config.json</InlineCode>:</p>
              <Code code={`{
  "mcpServers": {
    "polyforge": {
      "command": "npx",
      "args": ["@polyforge/mcp-server"],
      "env": {
        "POLYFORGE_API_URL": "https://api.polyforge.app",
        "POLYFORGE_API_KEY": "pf_live_your_key"
      }
    }
  }
}`} />
            </Sub>
            <Sub title="Claude Code setup">
              <Code code={'claude mcp add polyforge -- npx @polyforge/mcp-server\nexport POLYFORGE_API_KEY=pf_live_your_key'} />
            </Sub>
            <Sub title="Available tools">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  <p key={p} className="text-xs text-pf-text-secondary bg-pf-elevated border border-pf-border rounded px-3 py-2 font-mono">{p}</p>
                ))}
              </div>
            </Sub>
          </Section>

        </div>
      </div>
    </div>
  );
}
