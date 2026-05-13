/* Endpoint definitions for the API docs page.
   Each entry drives an EndpointCard: accordion header + expanded request/response details.  */

export interface EndpointField {
  name: string; type: string; required?: boolean; description: string;
}
export interface EndpointDef {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  scope: 'READ' | 'WRITE' | 'TRADE' | 'None';
  summary: string;
  description?: string;
  queryParams?: EndpointField[];
  requestFields?: EndpointField[];
  responseNote?: string;
  response?: string;
  status?: 'stable' | 'beta' | 'deprecated';
  examples: { curl?: string; ts?: string; py?: string; rust?: string };
}

const BASE = 'https://api.polyforge.app';

/* ─── Markets ────────────────────────────────────────────────────────── */

export const MARKETS: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/markets', scope: 'READ',
    summary: 'List prediction markets',
    description: 'Returns a paginated list of active Polymarket markets with live token prices and 24 h volume. Supports free-text search and multiple sort orders.',
    queryParams: [
      { name: 'search',  type: 'string',  description: 'Full-text search on market title' },
      { name: 'sort',    type: 'string',  description: 'volume | liquidity | closing_soon | newest (default: volume)' },
      { name: 'series',  type: 'string',  description: 'Filter by series slug (e.g. us-elections-2026)' },
      { name: 'page',    type: 'int',     description: 'Page number (default: 1)' },
      { name: 'limit',   type: 'int',     description: 'Results per page, max 100 (default: 20)' },
    ],
    responseNote: 'Returns { data: Market[], total, page, limit, totalPages, hasNext }. Each Market includes tokens with tokenId, outcome, price, and liquidity.',
    response: `{\n  "data": [\n    { "id": "mkt_abc123", "title": "Will BTC hit $100k in 2026?", "tokens": [{ "tokenId": "tok_yes", "outcome": "YES", "price": 0.62 }] }\n  ],\n  "total": 142,\n  "page": 1,\n  "limit": 20,\n  "totalPages": 8,\n  "hasNext": true\n}`,
    examples: {
      curl: `curl "${BASE}/api/v1/markets?search=election&sort=volume" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const { data } = await client.listMarkets({ search: 'election', sort: 'volume', limit: 10 });\ndata.forEach(m => console.log(m.title, m.tokens[0]?.price));`,
      py: `markets = client.list_markets(search='election', sort='volume', limit=10)\nfor m in markets.items:\n    print(m.title, m.tokens[0].price)`,
      rust: `let markets = client.list_markets(&ListMarketsParams {\n    search: Some("election".into()),\n    limit: Some(10),\n    ..Default::default()\n}).await?;`,
    },
  },
  {
    method: 'GET', path: '/api/v1/markets/:id', scope: 'READ',
    summary: 'Get a single market',
    description: 'Returns full market details including all tokens, current prices, bid/ask spread, volume, and end date.',
    responseNote: 'Returns a single Market object. 404 if the market does not exist or is not synced yet.',
    response: `{\n  "id": "mkt_abc123",\n  "title": "Will BTC hit $100k in 2026?",\n  "endDate": "2026-12-31T23:59:59Z",\n  "volume24h": 845200,\n  "tokens": [\n    { "tokenId": "tok_yes", "outcome": "YES", "price": 0.62, "liquidity": 320000 },\n    { "tokenId": "tok_no",  "outcome": "NO",  "price": 0.38, "liquidity": 210000 }\n  ]\n}`,
    examples: {
      curl: `curl "${BASE}/api/v1/markets/mkt_abc123" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const market = await client.getMarket('mkt_abc123');`,
      py: `market = client.get_market('mkt_abc123')`,
    },
  },
  {
    method: 'GET', path: '/api/v1/markets/:tokenId/price-history', scope: 'READ',
    summary: 'OHLCV price history',
    description: 'Returns historical OHLCV candlestick data for a token. Useful for charting and backtesting signal research.',
    queryParams: [
      { name: 'resolution', type: 'string', description: '1m | 1h | 1d (default: 1h)' },
      { name: 'from',       type: 'ISO8601', description: 'Start of range (default: 7 days ago)' },
      { name: 'to',         type: 'ISO8601', description: 'End of range (default: now)' },
      { name: 'limit',      type: 'int',    description: 'Max candles (default: 200, max: 1000)' },
    ],
    responseNote: 'Returns { tokenId, resolution, data: [{time, open, high, low, close, volume}] }.',
    response: `{\n  "tokenId": "tok_yes_abc",\n  "resolution": "1h",\n  "data": [\n    { "time": "2026-03-01T00:00:00Z", "open": 0.58, "high": 0.63, "low": 0.57, "close": 0.62, "volume": 12400 }\n  ]\n}`,
    examples: {
      curl: `curl "${BASE}/api/v1/markets/tok_yes_abc/price-history?resolution=1h&from=2026-03-01" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
  {
    method: 'GET', path: '/api/v1/markets/:tokenId/book', scope: 'READ',
    summary: 'Order book (bid/ask)',
    description: 'Returns the current CLOB order book for a token — aggregated bids and asks, spread, and midpoint price.',
    responseNote: 'Returns { tokenId, bids, asks, spread, midpoint, timestamp }.',
    response: `{\n  "tokenId": "tok_yes_abc",\n  "bids": [{ "price": 0.61, "size": 500 }, { "price": 0.60, "size": 1200 }],\n  "asks": [{ "price": 0.62, "size": 400 }, { "price": 0.63, "size": 800 }],\n  "spread": 0.01,\n  "midpoint": 0.615,\n  "timestamp": 1743200000000\n}`,
    examples: {
      curl: `curl "${BASE}/api/v1/markets/tok_yes_abc/book" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Strategies ─────────────────────────────────────────────────────── */

export const STRATEGIES: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/strategies', scope: 'READ',
    summary: 'List your strategies',
    response: `{\n  "data": [\n    { "id": "strat_123", "name": "Momentum Bot", "status": "RUNNING", "mode": "live", "createdAt": "2026-01-15T12:00:00Z" }\n  ],\n  "total": 5,\n  "page": 1,\n  "limit": 20\n}`,
    queryParams: [
      { name: 'status', type: 'string', description: 'IDLE | RUNNING | PAUSED | PAPER | ARCHIVED' },
      { name: 'page',   type: 'int',    description: 'Page (default: 1)' },
      { name: 'limit',  type: 'int',    description: 'Per page (default: 20)' },
    ],
    examples: {
      curl: `curl "${BASE}/api/v1/strategies?status=RUNNING" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const { data } = await client.listStrategies({ status: 'RUNNING' });`,
      py: `strategies = client.list_strategies(status='RUNNING')`,
    },
  },
  {
    method: 'POST', path: '/api/v1/strategies', scope: 'WRITE',
    summary: 'Create a strategy',
    requestFields: [
      { name: 'name',        type: 'string',  required: true,  description: 'Display name (max 80 chars)' },
      { name: 'description', type: 'string',  required: false, description: 'Optional description' },
      { name: 'visibility',  type: 'string',  required: false, description: 'PRIVATE | PUBLIC | UNLISTED (default: PRIVATE)' },
      { name: 'execMode',    type: 'string',  required: false, description: 'TICK | EVENT (default: TICK)' },
      { name: 'tickMs',      type: 'int',     required: false, description: 'Evaluation interval in ms (default: 1000)' },
      { name: 'triggers',    type: 'Block[]', required: false, description: 'Trigger block definitions' },
      { name: 'conditions',  type: 'Block[]', required: false, description: 'Condition block definitions' },
      { name: 'actions',     type: 'Block[]', required: false, description: 'Action block definitions' },
      { name: 'safety',      type: 'Block[]', required: false, description: 'Safety block definitions' },
    ],
    responseNote: 'Returns the created Strategy object (201). 422 STRATEGY_LIMIT_REACHED if you have hit your strategy quota.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/strategies" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"My Strategy","description":"Momentum bot"}'`,
      ts: `const strategy = await client.createStrategy('My Strategy', 'Momentum bot');`,
      py: `strategy = client.create_strategy('My Strategy', 'Momentum bot')`,
    },
  },
  {
    method: 'POST', path: '/api/v1/strategies/from-description', scope: 'WRITE',
    status: 'beta',
    summary: 'AI-generate a strategy from text',
    description: 'Sends a natural language description to an LLM which assembles a block-based strategy and returns it ready to run. The strategy is saved to your account.',
    requestFields: [
      { name: 'description', type: 'string', required: true,  description: 'Natural language strategy description' },
      { name: 'marketId',    type: 'string', required: false, description: 'Target market to anchor the strategy to' },
    ],
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/strategies/from-description" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"description":"Buy YES when price drops below 0.30 and volume is above 10k"}'`,
      ts: `const s = await client.createStrategyFromDescription(\n  'Buy YES when price drops below 0.30 and volume is above 10k'\n);`,
    },
  },
  {
    method: 'POST', path: '/api/v1/strategies/:id/start', scope: 'TRADE',
    summary: 'Start a strategy',
    requestFields: [
      { name: 'mode', type: 'string', required: true, description: 'live | paper' },
    ],
    responseNote: 'Returns { status: "RUNNING", startedAt }. 422 NOT_CONNECTED if live mode is requested without Polymarket credentials linked.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/strategies/strat_123/start" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"mode":"paper"}'`,
      ts: `await client.startStrategy('strat_123', 'paper');`,
      py: `client.start_strategy('strat_123', mode='paper')`,
    },
  },
  {
    method: 'POST', path: '/api/v1/strategies/:id/stop', scope: 'TRADE',
    summary: 'Stop a running strategy',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/strategies/strat_123/stop" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `await client.stopStrategy('strat_123');`,
      py: `client.stop_strategy('strat_123')`,
    },
  },
  {
    method: 'GET', path: '/api/v1/strategies/:id/export', scope: 'READ',
    summary: 'Export strategy as .polyforge JSON',
    description: 'Returns the full strategy definition as a portable JSON object that can be imported into the visual builder or another account.',
    examples: {
      curl: `curl "${BASE}/api/v1/strategies/strat_123/export" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const json = await client.exportStrategy('strat_123');`,
    },
  },
  {
    method: 'GET', path: '/api/v1/strategies/templates', scope: 'READ',
    summary: 'List strategy templates',
    description: 'Returns the 5 platform-provided starter templates. Any template can be forked with POST /strategies/:id/fork.',
    examples: {
      curl: `curl "${BASE}/api/v1/strategies/templates" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const templates = await client.getStrategyTemplates();`,
    },
  },
];

/* ─── Execution Watching (SSE) ───────────────────────────────────────── */

export const LIVE_WATCHING: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/strategies/:id/events', scope: 'READ',
    summary: 'Stream live execution events (SSE)',
    description: `Opens a persistent Server-Sent Events connection for a running strategy.
Each frame is formatted as "data: <JSON>\\n\\n". A heartbeat comment (": heartbeat") is sent every 15 s to keep the connection alive through proxies.
The first event is always CONNECTED. The connection stays open until the client disconnects or the strategy terminates.`,
    responseNote: 'Content-Type: text/event-stream. See the SSE Events guide for full event type reference.',
    examples: {
      curl: `# -N disables buffering so events print as they arrive\ncurl -N "${BASE}/api/v1/strategies/strat_123/events" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Accept: text/event-stream"`,
      ts: `const ac = new AbortController();\nfor await (const event of client.watchStrategy('strat_123', ac.signal)) {\n  if (event.type === 'ORDER_FILLED') {\n    console.log('Filled at', event.data.price);\n  }\n  if (event.type === 'STRATEGY_STOPPED') break;\n}`,
      py: `for event in client.watch_strategy('strat_123'):\n    if event.type == 'ORDER_FILLED':\n        print('Filled at', event.data['price'])\n    if event.type == 'STRATEGY_STOPPED':\n        break`,
      rust: `let mut stream = client.watch_strategy("strat_123").await?;\nwhile let Some(event) = stream.next().await {\n    let e = event?;\n    match e.event_type.as_str() {\n        "ORDER_FILLED" => println!("Filled: {:?}", e.data),\n        "STRATEGY_STOPPED" | "BACKTEST_COMPLETED" => break,\n        _ => {}\n    }\n}`,
    },
  },
];

/* ─── Direct Trading ─────────────────────────────────────────────────── */

export const TRADING: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/orders/place', scope: 'TRADE',
    summary: 'Place a direct order',
    description: 'Place a limit (GTC) or market (FOK) buy/sell order on a Polymarket market. Requires Polymarket credentials linked to your account.',
    requestFields: [
      { name: 'tokenId',   type: 'string', required: true,  description: 'The token ID to trade (from GET /markets/:id)' },
      { name: 'side',      type: 'string', required: true,  description: 'BUY | SELL' },
      { name: 'outcome',   type: 'string', required: true,  description: 'YES | NO' },
      { name: 'size',      type: 'number', required: true,  description: 'Order size in USDC (min 1)' },
      { name: 'price',     type: 'number', required: false, description: 'Limit price 0.001–0.999 (omit for FOK market orders)' },
      { name: 'orderType', type: 'string', required: false, description: 'GTC (default) | FOK | GTD' },
    ],
    responseNote: 'Returns { orderId, intentId, status: "PENDING" }. The order is submitted async; subscribe to WebSocket or SSE for the final fill/cancel event.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/orders/place" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: place-order-uuid" \\\n  -d '{"tokenId":"tok_yes_abc","side":"BUY","outcome":"YES","size":25,"price":0.65}'`,
      ts: `const order = await client.placeOrder({\n  tokenId: 'tok_yes_abc',\n  side: 'BUY',\n  outcome: 'YES',\n  size: 25,\n  price: 0.65,\n});\nconsole.log('Order ID:', order.orderId);`,
      py: `order = client.place_order(\n    token_id='tok_yes_abc',\n    side='BUY',\n    outcome='YES',\n    size=25,\n    price=0.65,\n)\nprint('Order ID:', order.order_id)`,
      rust: `let order = client.place_order(PlaceOrderParams {\n    token_id: "tok_yes_abc".into(),\n    side: "BUY".into(),\n    outcome: "YES".into(),\n    size: 25.0,\n    price: Some(0.65),\n    ..Default::default()\n}).await?;`,
    },
  },
  {
    method: 'DELETE', path: '/api/v1/orders/:id', scope: 'TRADE',
    summary: 'Cancel an order',
    description: 'Cancel a PENDING or LIVE order. Orders that have already been fully filled cannot be cancelled.',
    examples: {
      curl: `curl -X DELETE "${BASE}/api/v1/orders/ord_abc123" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `await client.cancelOrder('ord_abc123');`,
      py: `client.cancel_order('ord_abc123')`,
      rust: `client.cancel_order("ord_abc123").await?;`,
    },
  },
  {
    method: 'POST', path: '/api/v1/orders/close-position', scope: 'TRADE',
    summary: 'Close an open position',
    description: 'Submits a market sell order to close your entire position for a given token at the best available price.',
    requestFields: [
      { name: 'tokenId', type: 'string', required: true, description: 'The token whose position to close' },
    ],
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/orders/close-position" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: close-position-uuid" \\\n  -d '{"tokenId":"tok_yes_abc"}'`,
    },
  },
];

/* ─── Orders ─────────────────────────────────────────────────────────── */

export const ORDERS: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/orders', scope: 'READ',
    summary: 'List your orders',
    queryParams: [
      { name: 'status',     type: 'string', description: 'PENDING | LIVE | FILLED | CANCELLED | FAILED' },
      { name: 'strategyId', type: 'string', description: 'Filter to orders from a specific strategy' },
      { name: 'from',       type: 'ISO8601', description: 'Start date filter' },
      { name: 'to',         type: 'ISO8601', description: 'End date filter' },
      { name: 'page',       type: 'int',    description: 'Page (default: 1)' },
      { name: 'limit',      type: 'int',    description: 'Per page, max 100 (default: 20)' },
    ],
    responseNote: 'Returns PaginatedResponse<Order>. Each Order includes: id, marketId, tokenId, side, outcome, size, price, status, filledSize, avgFillPrice, strategyId, createdAt.',
    examples: {
      curl: `curl "${BASE}/api/v1/orders?status=FILLED&limit=50" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const { data } = await client.getOrders({ status: 'FILLED', limit: 50 });\ndata.forEach(o => console.log(o.side, o.outcome, o.avgFillPrice));`,
      py: `orders = client.get_orders(status='FILLED', limit=50)`,
    },
  },
];

/* ─── Conditional Orders ─────────────────────────────────────────────── */

export const CONDITIONAL_ORDERS: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/orders/conditional', scope: 'TRADE',
    status: 'beta',
    summary: 'Create a conditional order',
    description: 'Conditional orders execute automatically when a price trigger fires. Types: TAKE_PROFIT, STOP_LOSS, TRAILING_STOP, LIMIT, PEGGED.',
    requestFields: [
      { name: 'tokenId',      type: 'string', required: true,  description: 'Token to watch and trade' },
      { name: 'type',         type: 'string', required: true,  description: 'TAKE_PROFIT | STOP_LOSS | TRAILING_STOP | LIMIT | PEGGED' },
      { name: 'side',         type: 'string', required: true,  description: 'BUY | SELL' },
      { name: 'outcome',      type: 'string', required: true,  description: 'YES | NO' },
      { name: 'size',         type: 'number', required: true,  description: 'Order size in USDC' },
      { name: 'triggerPrice', type: 'number', required: false, description: 'Price at which to fire (required for TAKE_PROFIT, STOP_LOSS, LIMIT)' },
      { name: 'trailAmount',  type: 'number', required: false, description: 'Trail distance (required for TRAILING_STOP)' },
    ],
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/orders/conditional" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: conditional-order-uuid" \\\n  -d '{"tokenId":"tok_yes_abc","type":"STOP_LOSS","side":"SELL","outcome":"YES","size":25,"triggerPrice":0.40}'`,
    },
  },
  {
    method: 'GET', path: '/api/v1/orders/conditional', scope: 'READ',
    status: 'beta',
    summary: 'List conditional orders',
    queryParams: [
      { name: 'status', type: 'string', description: 'ACTIVE | TRIGGERED | CANCELLED' },
      { name: 'type',   type: 'string', description: 'Filter by order type' },
    ],
    examples: {
      curl: `curl "${BASE}/api/v1/orders/conditional?status=ACTIVE" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
  {
    method: 'DELETE', path: '/api/v1/orders/conditional/:id', scope: 'TRADE',
    status: 'beta',
    summary: 'Cancel a conditional order',
    examples: {
      curl: `curl -X DELETE "${BASE}/api/v1/orders/conditional/co_abc123" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Portfolio ──────────────────────────────────────────────────────── */

export const PORTFOLIO: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/portfolio', scope: 'READ',
    summary: 'Portfolio summary',
    description: 'Returns your current open positions, USDC balance, total value, and aggregated P&L across all markets.',
    responseNote: 'Returns { balance, totalValue, totalPnl, positions: [{tokenId, outcome, size, avgPrice, currentPrice, unrealizedPnl}] }.',
    examples: {
      curl: `curl "${BASE}/api/v1/portfolio" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const portfolio = await client.getPortfolio();\nconsole.log('Total P&L:', portfolio.totalPnl);`,
      py: `portfolio = client.get_portfolio()\nprint(f'Total P&L: {portfolio.total_pnl}')`,
      rust: `let portfolio = client.get_portfolio().await?;`,
    },
  },
  {
    method: 'GET', path: '/api/v1/portfolio/pnl', scope: 'READ',
    summary: 'P&L time series',
    description: 'Returns a daily P&L series for charting. Useful for building equity curve visualizations.',
    queryParams: [
      { name: 'period', type: 'string', description: '7d | 30d | 90d | allTime (default: 30d)' },
    ],
    examples: {
      curl: `curl "${BASE}/api/v1/portfolio/pnl?period=30d" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Backtests ──────────────────────────────────────────────────────── */

export const BACKTESTS: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/backtests', scope: 'WRITE',
    summary: 'Run a backtest',
    description: 'Starts a historical replay of a strategy. Results stream back over WebSocket as BACKTEST_PROGRESS events.',
    requestFields: [
      { name: 'strategyId', type: 'string', required: false, description: 'Strategy to backtest (optional; if omitted, uses strategy blocks from the request)' },
      { name: 'from',       type: 'ISO8601', required: true,  description: 'Backtest start date' },
      { name: 'to',         type: 'ISO8601', required: false, description: 'Backtest end date (default: now)' },
    ],
    responseNote: 'Returns { runId, status: "RUNNING" }. Subscribe to WebSocket BACKTEST_PROGRESS / BACKTEST_COMPLETED events for results.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/backtests" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"strategyId":"strat_123","from":"2025-01-01","to":"2025-12-31"}'`,
    },
  },
  {
    method: 'GET', path: '/api/v1/backtests/:id', scope: 'READ',
    summary: 'Get backtest results',
    responseNote: 'Returns full BacktestRun including: pnl, winRate, sharpe, maxDrawdown, tradeCount, equityCurve, and per-trade log.',
    examples: {
      curl: `curl "${BASE}/api/v1/backtests/bt_abc123" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Copy Trading ───────────────────────────────────────────────────── */

export const COPY_TRADING: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/copy', scope: 'TRADE',
    summary: 'Follow a wallet',
    description: 'Start mirroring trades from a wallet address. Three scaling modes: percentage (copy X% of their position size), fixed (fixed USDC per trade), mirror (match their exact size).',
    requestFields: [
      { name: 'walletAddress', type: 'string', required: true,  description: 'Wallet address to copy' },
      { name: 'mode',          type: 'string', required: true,  description: 'PERCENTAGE | FIXED | MIRROR' },
      { name: 'scaling',       type: 'number', required: false, description: 'Multiplier for PERCENTAGE mode (e.g. 0.5 = copy 50%)' },
      { name: 'maxSize',       type: 'number', required: false, description: 'Max USDC per copied trade (risk control)' },
      { name: 'dailyLossLimit',type: 'number', required: false, description: 'Stop copying if daily loss exceeds this USDC value' },
    ],
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/copy" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"walletAddress":"0x8f3a...","mode":"PERCENTAGE","scaling":0.5,"maxSize":100}'`,
      ts: `await client.listCopyConfigs(); // list existing\n// Create via REST until SDK method lands`,
    },
  },
  {
    method: 'GET', path: '/api/v1/copy', scope: 'READ',
    summary: 'List copy configurations',
    examples: {
      curl: `curl "${BASE}/api/v1/copy" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const configs = await client.listCopyConfigs();`,
    },
  },
];

/* ─── Whale Feed ─────────────────────────────────────────────────────── */

export const WHALE_FEED: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/whales/feed', scope: 'READ',
    summary: 'Recent large trades',
    description: 'Returns large on-chain trades from tracked wallets. Useful for detecting smart money movements before they affect prices.',
    queryParams: [
      { name: 'minSize', type: 'number', description: 'Minimum USDC trade size (default: 10000)' },
      { name: 'limit',   type: 'int',   description: 'Results (default: 20, max: 100)' },
    ],
    responseNote: 'Returns [{ walletAddress, side, outcome, size, price, marketId, timestamp }].',
    examples: {
      curl: `curl "${BASE}/api/v1/whales/feed?minSize=50000" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const trades = await client.getWhaleFeed(50000);`,
      py: `trades = client.get_whale_feed(min_size=50000)`,
    },
  },
];

/* ─── News & Signals ─────────────────────────────────────────────────── */

export const NEWS_SIGNALS: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/news/signals', scope: 'READ',
    summary: 'AI news trading signals',
    description: 'Returns AI-generated trade signals from the real-time news pipeline. Each signal includes a confidence score, the matched market, and the suggested direction.',
    queryParams: [
      { name: 'minConfidence', type: 'int',    description: 'Min confidence 0–100 (default: 60)' },
      { name: 'limit',         type: 'int',    description: 'Results (default: 20)' },
    ],
    responseNote: 'Returns [{ headline, source, confidence, direction: BUY|SELL, marketId, tokenId, generatedAt }].',
    examples: {
      curl: `curl "${BASE}/api/v1/news/signals?minConfidence=80" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const signals = await client.getNewsSignals(80);\nsignals.forEach(s => console.log(s.confidence + '%', s.headline));`,
      py: `signals = client.get_news_signals(min_confidence=80)`,
    },
  },
];

/* ─── Alerts ─────────────────────────────────────────────────────────── */

export const ALERTS: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/alerts', scope: 'WRITE',
    summary: 'Create a price alert',
    requestFields: [
      { name: 'marketId',  type: 'string', required: true,  description: 'Market to watch' },
      { name: 'condition', type: 'string', required: true,  description: 'above | below | crosses' },
      { name: 'price',     type: 'number', required: true,  description: 'Trigger price 0.001–0.999' },
    ],
    responseNote: 'Alert fires a PRICE_ALERT WebSocket event and (if configured) an email/Telegram notification.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/alerts" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"marketId":"mkt_abc","condition":"above","price":0.75}'`,
      ts: `await client.listAlerts(); // list existing`,
    },
  },
  {
    method: 'GET', path: '/api/v1/alerts', scope: 'READ',
    summary: 'List your alerts',
    examples: {
      curl: `curl "${BASE}/api/v1/alerts" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const alerts = await client.listAlerts();`,
    },
  },
  {
    method: 'DELETE', path: '/api/v1/alerts/:id', scope: 'WRITE',
    summary: 'Delete an alert',
    examples: {
      curl: `curl -X DELETE "${BASE}/api/v1/alerts/alert_123" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Webhooks ───────────────────────────────────────────────────────── */

export const WEBHOOKS: EndpointDef[] = [
  {
    method: 'POST', path: '/api/v1/webhooks', scope: 'WRITE',
    summary: 'Register a webhook',
    description: 'Polyforge will POST JSON to your URL whenever the selected events occur. Payloads are signed with HMAC-SHA256 — see the Webhook Signatures guide.',
    requestFields: [
      { name: 'url',    type: 'string',   required: true,  description: 'HTTPS endpoint that receives events' },
      { name: 'events', type: 'string[]', required: true,  description: 'Array of event types to subscribe to' },
    ],
    responseNote: 'Returns { id, url, events, secret }. Store the secret — it is used to verify signatures and is shown only once.',
    examples: {
      curl: `curl -X POST "${BASE}/api/v1/webhooks" \\\n  -H "Authorization: Bearer pf_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://myapp.com/hook","events":["ORDER_FILLED","STRATEGY_ERROR"]}'`,
      ts: `const wh = await client.createWebhook('https://myapp.com/hook', ['ORDER_FILLED']);\nconsole.log('Secret:', wh.secret); // store this!`,
      py: `wh = client.create_webhook('https://myapp.com/hook', ['ORDER_FILLED'])\nprint('Secret:', wh.secret)`,
    },
  },
  {
    method: 'GET', path: '/api/v1/webhooks', scope: 'READ',
    summary: 'List your webhooks',
    examples: {
      curl: `curl "${BASE}/api/v1/webhooks" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const webhooks = await client.listWebhooks();`,
    },
  },
  {
    method: 'DELETE', path: '/api/v1/webhooks/:id', scope: 'WRITE',
    summary: 'Unregister a webhook',
    examples: {
      curl: `curl -X DELETE "${BASE}/api/v1/webhooks/wh_abc123" \\\n  -H "Authorization: Bearer pf_live_..."`,
    },
  },
];

/* ─── Scores ─────────────────────────────────────────────────────────── */

export const SCORES: EndpointDef[] = [
  {
    method: 'GET', path: '/api/v1/scores/me', scope: 'READ',
    summary: 'Your trader edge score',
    description: 'Returns your edge score (0–1000), rank, percentile, and earned badges. The score is updated after each completed backtest or live trade.',
    responseNote: 'Returns { score, rank, percentile, badges: [{name, earnedAt}] }.',
    examples: {
      curl: `curl "${BASE}/api/v1/scores/me" \\\n  -H "Authorization: Bearer pf_live_..."`,
      ts: `const score = await client.getScore();`,
      py: `score = client.get_score()`,
    },
  },
];
