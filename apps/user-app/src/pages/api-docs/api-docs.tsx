import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronUp, Key } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  scope: string;
  description: string;
  queryParams?: string;
  curl: string;
}

interface EndpointCategory {
  title: string;
  endpoints: Endpoint[];
}

/* ─── Data ───────────────────────────────────────────────────────────── */

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  GET:    { bg: 'bg-pf-success/10', text: 'text-pf-success' },
  POST:   { bg: 'bg-pf-info/10', text: 'text-pf-info' },
  PATCH:  { bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
  DELETE: { bg: 'bg-pf-danger/10', text: 'text-pf-danger' },
};

const SCOPE_STYLES: Record<string, { bg: string; text: string }> = {
  READ:  { bg: 'bg-pf-success/10', text: 'text-pf-success' },
  WRITE: { bg: 'bg-pf-info/10', text: 'text-pf-info' },
  TRADE: { bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
};

const ERROR_SHAPE = `{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired API key",
  "field": null,
  "requestId": "req_abc123"
}`;

const ERROR_CODES = [
  { code: 400, meaning: 'Bad Request -- invalid parameters or malformed body' },
  { code: 401, meaning: 'Unauthorized -- missing or invalid API key' },
  { code: 403, meaning: 'Forbidden -- API key lacks the required scope' },
  { code: 404, meaning: 'Not Found -- resource does not exist' },
  { code: 409, meaning: 'Conflict -- action conflicts with current state' },
  { code: 422, meaning: 'Unprocessable Entity -- validation failed' },
  { code: 429, meaning: 'Too Many Requests -- rate limit exceeded' },
  { code: 500, meaning: 'Internal Server Error -- unexpected error on our end' },
];

const CATEGORIES: EndpointCategory[] = [
  {
    title: 'Markets',
    endpoints: [
      { method: 'GET', path: '/api/v1/markets', scope: 'READ', description: 'List all available markets with optional filtering.', queryParams: 'search, sort, category',
        curl: 'curl -X GET "https://api.polyforge.app/api/v1/markets?search=election&sort=volume" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'GET', path: '/api/v1/markets/:id', scope: 'READ', description: 'Get full details for a single market.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/mkt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'GET', path: '/api/v1/markets/:tokenId/price-history', scope: 'READ', description: 'Get OHLCV price history for a market token.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/price-history \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'GET', path: '/api/v1/markets/:tokenId/book', scope: 'READ', description: 'Get the current order book for a market token.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/book \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Strategies',
    endpoints: [
      { method: 'GET', path: '/api/v1/strategies', scope: 'READ', description: 'List all your strategies.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/strategies', scope: 'WRITE', description: 'Create a new strategy.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "My Strategy", "blocks": [...]}\''},
      { method: 'GET', path: '/api/v1/strategies/:id', scope: 'READ', description: 'Get full details for a strategy.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'PATCH', path: '/api/v1/strategies/:id', scope: 'WRITE', description: 'Update a strategy.',
        curl: 'curl -X PATCH https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "Updated Name"}\'' },
      { method: 'DELETE', path: '/api/v1/strategies/:id', scope: 'WRITE', description: 'Delete a strategy. Must be stopped first.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/strategies/:id/start', scope: 'TRADE', description: 'Start live execution of a strategy.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/strategies/:id/stop', scope: 'TRADE', description: 'Stop a running strategy.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/stop \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/strategies/:id/pause', scope: 'TRADE', description: 'Pause a running strategy temporarily.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/pause \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/strategies/:id/resume', scope: 'TRADE', description: 'Resume a paused strategy.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/resume \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Trading',
    endpoints: [
      { method: 'POST', path: '/api/v1/orders/place', scope: 'TRADE', description: 'Place a direct buy or sell order on a market. Supports limit (GTC) and market (FOK) orders.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/place \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"tokenId": "tok_abc", "side": "BUY", "outcome": "YES", "size": 10, "price": 0.65, "orderType": "GTC"}\'' },
      { method: 'DELETE', path: '/api/v1/orders/:id', scope: 'TRADE', description: 'Cancel a pending or live order.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/orders/ord_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/orders/close-position', scope: 'TRADE', description: 'Close an open position by selling at market price.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/close-position \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"tokenId": "tok_abc123"}\'' },
      { method: 'POST', path: '/api/v1/orders/redeem', scope: 'TRADE', description: 'Redeem a resolved position to claim winnings.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/redeem \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"positionId": "pos_abc123"}\'' },
      { method: 'POST', path: '/api/v1/orders/split', scope: 'TRADE', description: 'Split USDC.e into YES + NO tokens for a market.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/split \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"marketId": "mkt_abc", "amount": 100}\'' },
      { method: 'POST', path: '/api/v1/orders/merge', scope: 'TRADE', description: 'Merge YES + NO tokens back into USDC.e.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/merge \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"marketId": "mkt_abc", "amount": 100}\'' },
    ],
  },
  {
    title: 'Orders',
    endpoints: [
      { method: 'GET', path: '/api/v1/orders', scope: 'READ', description: 'List your orders with optional filtering.', queryParams: 'status, strategyId, page, limit',
        curl: 'curl -X GET "https://api.polyforge.app/api/v1/orders?status=filled&limit=50" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Conditional Orders',
    endpoints: [
      { method: 'POST', path: '/api/v1/orders/conditional', scope: 'TRADE', description: 'Create a conditional order (take profit, stop loss, trailing stop, limit, or pegged).',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/conditional \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"tokenId": "tok_abc", "type": "STOP_LOSS", "side": "SELL", "outcome": "YES", "size": 10, "triggerPrice": 0.40}\'' },
      { method: 'GET', path: '/api/v1/orders/conditional', scope: 'READ', description: 'List your conditional orders.', queryParams: 'status, type, page, limit',
        curl: 'curl -X GET "https://api.polyforge.app/api/v1/orders/conditional?status=ACTIVE" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'GET', path: '/api/v1/orders/conditional/:id', scope: 'READ', description: 'Get details of a conditional order.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/orders/conditional/co_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'DELETE', path: '/api/v1/orders/conditional/:id', scope: 'TRADE', description: 'Cancel an active conditional order.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/orders/conditional/co_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Portfolio',
    endpoints: [
      { method: 'GET', path: '/api/v1/portfolio', scope: 'READ', description: 'Get your current positions and aggregated P&L.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'GET', path: '/api/v1/portfolio/pnl', scope: 'READ', description: 'Get P&L time series data for charting.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio/pnl \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Alerts',
    endpoints: [
      { method: 'GET', path: '/api/v1/alerts', scope: 'READ', description: 'List all your price alerts.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/alerts', scope: 'WRITE', description: 'Create a new price alert.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"marketId": "mkt_abc123", "condition": "above", "price": 0.75}\'' },
      { method: 'DELETE', path: '/api/v1/alerts/:id', scope: 'WRITE', description: 'Delete a price alert.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/alerts/alert_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Backtests',
    endpoints: [
      { method: 'GET', path: '/api/v1/backtests', scope: 'READ', description: 'List your backtest runs.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/backtests', scope: 'WRITE', description: 'Start a new backtest run.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"strategyId": "strat_123", "from": "2025-01-01", "to": "2025-06-01"}\'' },
      { method: 'GET', path: '/api/v1/backtests/:id', scope: 'READ', description: 'Get results for a backtest run.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests/bt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Profile',
    endpoints: [
      { method: 'GET', path: '/api/v1/profile/:username', scope: 'READ', description: 'Get a user profile including public strategies and stats.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/profile/alphatrader \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Copy Trading',
    endpoints: [
      { method: 'GET', path: '/api/v1/copy', scope: 'READ', description: 'List your copy trading configurations.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/copy \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/copy', scope: 'TRADE', description: 'Create a new copy trading configuration to follow a wallet.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/copy \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"walletAddress": "0x...", "maxSize": 100, "scaling": 0.5}\'' },
      { method: 'DELETE', path: '/api/v1/copy/:id', scope: 'TRADE', description: 'Stop and delete a copy trading configuration.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/copy/copy_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Webhooks',
    endpoints: [
      { method: 'GET', path: '/api/v1/webhooks', scope: 'READ', description: 'List your registered webhook endpoints.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/webhooks \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/webhooks', scope: 'WRITE', description: 'Register a webhook for event notifications. Events: ORDER_FILLED, STRATEGY_ERROR, WHALE_TRADE, NEWS_SIGNAL, PRICE_ALERT, MARKET_RESOLVED.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/webhooks \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url": "https://example.com/hook", "events": ["ORDER_FILLED", "PRICE_ALERT"]}\'' },
      { method: 'DELETE', path: '/api/v1/webhooks/:id', scope: 'WRITE', description: 'Unregister a webhook endpoint.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/webhooks/wh_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Whale Feed',
    endpoints: [
      { method: 'GET', path: '/api/v1/whales/feed', scope: 'READ', description: 'Get recent whale trades (large trades on Polymarket).', queryParams: 'minSize',
        curl: 'curl -X GET "https://api.polyforge.app/api/v1/whales/feed?minSize=50000" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'News & Signals',
    endpoints: [
      { method: 'GET', path: '/api/v1/news/signals', scope: 'READ', description: 'Get AI-generated trading signals from news analysis.', queryParams: 'minConfidence',
        curl: 'curl -X GET "https://api.polyforge.app/api/v1/news/signals?minConfidence=80" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Scores & Leaderboard',
    endpoints: [
      { method: 'GET', path: '/api/v1/scores/me', scope: 'READ', description: 'Get your trader edge score, rank, and earned badges.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/scores/me \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Profile',
    endpoints: [
      { method: 'GET', path: '/api/v1/profile/:username', scope: 'READ', description: 'Get a public user profile including stats and public strategies.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/profile/alphatrader \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'PATCH', path: '/api/v1/auth/me', scope: 'WRITE', description: 'Update your profile (username, avatar, bio).',
        curl: 'curl -X PATCH https://api.polyforge.app/api/v1/auth/me \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"username": "newname", "bio": "Prediction market trader"}\'' },
    ],
  },
  {
    title: 'API Keys',
    endpoints: [
      { method: 'GET', path: '/api/v1/api-keys', scope: 'READ', description: 'List your API keys (key value is masked after creation).',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/api-keys \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/api-keys', scope: 'WRITE', description: 'Create a new API key with specified scopes. The full key is only returned once.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/api-keys \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "My Bot", "scopes": ["READ", "TRADE"]}\'' },
      { method: 'DELETE', path: '/api/v1/api-keys/:id', scope: 'WRITE', description: 'Revoke an API key permanently.',
        curl: 'curl -X DELETE https://api.polyforge.app/api/v1/api-keys/key_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
  {
    title: 'Paper Trading',
    endpoints: [
      { method: 'GET', path: '/api/v1/paper/summary', scope: 'READ', description: 'Get your paper trading account summary.',
        curl: 'curl -X GET https://api.polyforge.app/api/v1/paper/summary \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
      { method: 'POST', path: '/api/v1/paper/reset', scope: 'WRITE', description: 'Reset your paper trading account to default balance.',
        curl: 'curl -X POST https://api.polyforge.app/api/v1/paper/reset \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
    ],
  },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());

  function toggleEndpoint(key: string) {
    setOpenEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="animate-fade-in p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-pf-text mb-1">API Documentation</h1>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Use your API key to integrate with external tools, AI agents, and custom applications.
        </p>
      </div>

      {/* Authentication */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-pf-text">Authentication</h2>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Authenticate every request by including your API key in the{' '}
          <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono">Authorization</code> header:
        </p>
        <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-xs font-mono text-pf-text overflow-x-auto">
          Authorization: Bearer pf_your_key_here
        </pre>
        <p className="text-sm text-pf-text-secondary">
          Generate and manage your API keys in{' '}
          <Link to="/settings" className="text-pf-cyan-400 hover:underline">Settings &rarr; API Keys</Link>.
        </p>

        <h3 className="text-base font-semibold text-pf-text mt-4">Scopes</h3>
        <div className="space-y-2">
          {[
            { scope: 'READ', desc: 'View data: markets, portfolio, strategies, orders, alerts, backtests, profiles' },
            { scope: 'WRITE', desc: 'Modify strategies, settings, alerts, and start backtests' },
            { scope: 'TRADE', desc: 'Place and cancel orders, start/stop strategies, close positions, manage copy trading' },
          ].map(s => {
            const ss = SCOPE_STYLES[s.scope];
            return (
              <div key={s.scope} className="flex items-center gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`}>{s.scope}</span>
                <span className="text-xs text-pf-text-secondary">{s.desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Endpoints */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-pf-text">Endpoints</h2>
        {CATEGORIES && CATEGORIES.length > 0 ? (
          CATEGORIES.map((category, catIdx) => (
            <div key={category.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-pf-text">{category.title}</h3>
              {category.endpoints && category.endpoints.length > 0 ? (
                category.endpoints.map((ep, epIdx) => {
                  const key = `${catIdx}-${epIdx}`;
                  const isOpen = openEndpoints.has(key);
                  const ms = METHOD_STYLES[ep.method];
                  const ss = SCOPE_STYLES[ep.scope];
                  return ms && ss ? (
                    <div key={key}>
                      <button
                        onClick={() => toggleEndpoint(key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-pf-elevated border border-pf-border rounded-pf hover:border-pf-border-strong transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                        aria-expanded={isOpen}
                      >
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${ms.bg} ${ms.text}`}>{ep.method}</span>
                        <code className="flex-1 text-xs font-mono text-pf-text">{ep.path}</code>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`}>{ep.scope}</span>
                        {isOpen ? <ChevronUp className="size-3 text-pf-text-muted" /> : <ChevronDown className="size-3 text-pf-text-muted" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 border border-t-0 border-pf-border rounded-b-pf-lg -mt-px bg-pf-elevated">
                          <p className="text-xs text-pf-text-secondary mt-3 mb-2">{ep.description}</p>
                          {ep.queryParams && (
                            <p className="text-[11px] text-pf-text-muted mb-2">
                              Query params: <code className="font-mono">{ep.queryParams}</code>
                            </p>
                          )}
                          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
                            {ep.curl}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : null;
                })
              ) : null}
            </div>
          ))
        ) : null}
      </section>

      {/* Rate Limits */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-pf-text">Rate Limits</h2>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Each API key is limited to <strong className="text-pf-text">120 requests per minute</strong>.
          If you exceed the limit, the API responds with status{' '}
          <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono">429 Too Many Requests</code>.
        </p>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          The response includes a{' '}
          <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono">Retry-After</code>{' '}
          header indicating how many seconds to wait before retrying.
        </p>
      </section>

      {/* Error Codes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-pf-text">Error Codes</h2>
        <p className="text-sm text-pf-text-secondary leading-relaxed mb-3">All errors follow a standard shape:</p>
        <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-xs font-mono text-pf-text overflow-x-auto">
          {ERROR_SHAPE}
        </pre>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pf-border">
                <th className="text-left py-2 px-3 text-xs text-pf-text-secondary font-semibold">Code</th>
                <th className="text-left py-2 px-3 text-xs text-pf-text-secondary font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map(err => (
                <tr key={err.code} className="border-b border-pf-border-subtle">
                  <td className="py-2 px-3 font-mono text-pf-text">{err.code}</td>
                  <td className="py-2 px-3 text-pf-text-secondary">{err.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Code Examples */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-pf-text">Code Examples</h2>

        <div>
          <h3 className="text-sm font-semibold text-pf-text mb-2">1. Place a direct order</h3>
          <p className="text-[11px] text-pf-text-muted mb-1">curl</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap mb-3">
{`curl -X POST https://api.polyforge.app/api/v1/orders/place \\
  -H "Authorization: Bearer pf_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{"tokenId":"tok_yes_abc","side":"BUY","outcome":"YES","size":10,"price":0.65}'`}
          </pre>
          <p className="text-[11px] text-pf-text-muted mb-1">TypeScript (@polyforge/sdk)</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap mb-3">
{`import { PolyforgeClient } from '@polyforge/sdk';

const pf = new PolyforgeClient({ apiKey: 'pf_live_abc123...' });
const order = await pf.placeOrder({
  tokenId: 'tok_yes_abc',
  side: 'BUY',
  outcome: 'YES',
  size: 10,
  price: 0.65,
});
console.log('Order placed:', order.orderId);`}
          </pre>
          <p className="text-[11px] text-pf-text-muted mb-1">Python (polyforge)</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
{`from polyforge import PolyforgeClient

pf = PolyforgeClient(api_key="pf_live_abc123...")
order = pf.place_order(
    token_id="tok_yes_abc",
    side="BUY",
    outcome="YES",
    size=10,
    price=0.65,
)
print(f"Order placed: {order.order_id}")`}
          </pre>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-pf-text mb-2">2. List markets and browse</h3>
          <p className="text-[11px] text-pf-text-muted mb-1">TypeScript</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
{`const markets = await pf.listMarkets({ search: 'election', limit: 5 });
for (const m of markets.data) {
  console.log(m.title, m.tokens[0]?.price);
}`}
          </pre>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-pf-text mb-2">3. Start a strategy in paper mode</h3>
          <p className="text-[11px] text-pf-text-muted mb-1">curl</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
{`curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\
  -H "Authorization: Bearer pf_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"paper"}'`}
          </pre>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-pf-text mb-2">4. Get portfolio P&L</h3>
          <p className="text-[11px] text-pf-text-muted mb-1">Python</p>
          <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
{`portfolio = pf.get_portfolio()
for pos in portfolio.positions:
    print(f"{pos.outcome}: {pos.size} shares @ {pos.avg_price}")`}
          </pre>
        </div>
      </section>

      {/* SDKs */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-pf-text">Official SDKs</h2>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Use our typed SDKs for a better developer experience:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { lang: 'TypeScript', pkg: 'npm install @polyforge/sdk', color: 'text-pf-info' },
            { lang: 'Python', pkg: 'pip install polyforge', color: 'text-pf-gold-500' },
            { lang: 'Rust', pkg: 'cargo add polyforge', color: 'text-pf-warning' },
          ].map(sdk => (
            <div key={sdk.lang} className="bg-pf-elevated border border-pf-border rounded-pf p-3">
              <p className={`text-sm font-semibold ${sdk.color} mb-1`}>{sdk.lang}</p>
              <code className="text-[11px] font-mono text-pf-text-secondary">{sdk.pkg}</code>
            </div>
          ))}
        </div>
      </section>

      {/* MCP */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-pf-text">AI Integration (MCP)</h2>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Connect AI assistants like Claude to Polyforge using the{' '}
          <span className="text-pf-text font-medium">Model Context Protocol</span> server:
        </p>
        <pre className="bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap">
{`npx @polyforge/mcp-server`}
        </pre>
        <p className="text-xs text-pf-text-muted">
          22 tools available: browse markets, place orders, manage strategies, view portfolio, and more.
        </p>
      </section>
    </div>
  );
}
