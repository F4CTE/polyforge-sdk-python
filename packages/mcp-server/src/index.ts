#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "polyforge", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ─── Tool definitions ──────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_markets",
    description: "Browse prediction markets on Polymarket",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Search query" },
        category: { type: "string", enum: ["Sports", "Crypto", "Politics", "Science", "Culture"], description: "Filter by category" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "list_strategies",
    description: "List your trading strategies",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["IDLE", "RUNNING", "PAUSED", "PAPER"], description: "Filter by status" },
      },
    },
  },
  {
    name: "get_strategy",
    description: "Get details of a specific strategy",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Strategy UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_strategy",
    description: "Create a new trading strategy",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Strategy name" },
        description: { type: "string", description: "Strategy description" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_strategy_from_description",
    description: "Create a strategy from a natural language description using AI",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "Natural language description of what the strategy should do" },
        marketId: { type: "string", description: "Optional market ID to bind the strategy to" },
      },
      required: ["description"],
    },
  },
  {
    name: "start_strategy",
    description: "Start a strategy in live or paper mode",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Strategy UUID" },
        mode: { type: "string", enum: ["live", "paper"], description: "Trading mode (default: paper)" },
      },
      required: ["id"],
    },
  },
  {
    name: "stop_strategy",
    description: "Stop a running strategy",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Strategy UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_portfolio",
    description: "Get your portfolio positions and P&L",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_orders",
    description: "List your recent orders",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
        status: { type: "string", description: "Filter by order status" },
      },
    },
  },
  {
    name: "get_whale_feed",
    description: "Get recent whale trades",
    inputSchema: {
      type: "object" as const,
      properties: {
        minSize: { type: "number", description: "Minimum trade size in USDC (default 10000)" },
      },
    },
  },
  {
    name: "get_news_signals",
    description: "Get AI-generated trading signals from news",
    inputSchema: {
      type: "object" as const,
      properties: {
        minConfidence: { type: "number", description: "Minimum confidence 1-100 (default 70)" },
      },
    },
  },
  {
    name: "get_score",
    description: "Get your trader score and badges",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_alerts",
    description: "List your price alerts",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_copy_configs",
    description: "List your copy trading configurations",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_webhooks",
    description: "List your registered webhooks",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "create_webhook",
    description: "Register a webhook for event notifications",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "HTTPS URL to receive events" },
        events: {
          type: "array",
          items: { type: "string" },
          description: "Event types: ORDER_FILLED, STRATEGY_ERROR, WHALE_TRADE, NEWS_SIGNAL, BACKTEST_COMPLETE, DAILY_LOSS_LIMIT, MARKET_RESOLVED, PRICE_ALERT",
        },
      },
      required: ["url", "events"],
    },
  },
  {
    name: "ai_query",
    description: "Ask a natural language question about your account, strategies, portfolio, etc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_strategy_templates",
    description: "List available strategy templates",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_market",
    description: "Get details of a specific market",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Market condition ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "export_strategy",
    description: "Export a strategy as a .polyforge JSON file",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Strategy UUID" },
      },
      required: ["id"],
    },
  },
];

// ─── Route mapping ─────────────────────────────────────────────────

interface RouteConfig {
  method: "GET" | "POST" | "DELETE";
  path: string | ((args: Record<string, any>) => string);
  query?: (args: Record<string, any>) => Record<string, string>;
  body?: (args: Record<string, any>) => Record<string, any>;
}

const ROUTES: Record<string, RouteConfig> = {
  list_markets: { method: "GET", path: "/api/v1/markets", query: (a) => pickDefined(a, ["search", "category", "limit"]) },
  list_strategies: { method: "GET", path: "/api/v1/strategies", query: (a) => pickDefined(a, ["status"]) },
  get_strategy: { method: "GET", path: (a) => `/api/v1/strategies/${a.id}` },
  create_strategy: { method: "POST", path: "/api/v1/strategies", body: (a) => a },
  create_strategy_from_description: { method: "POST", path: "/api/v1/strategies/from-description", body: (a) => a },
  start_strategy: { method: "POST", path: (a) => `/api/v1/strategies/${a.id}/start`, body: (a) => ({ mode: a.mode ?? "paper" }) },
  stop_strategy: { method: "POST", path: (a) => `/api/v1/strategies/${a.id}/stop` },
  get_portfolio: { method: "GET", path: "/api/v1/portfolio" },
  get_orders: { method: "GET", path: "/api/v1/orders", query: (a) => pickDefined(a, ["limit", "status"]) },
  get_whale_feed: { method: "GET", path: "/api/v1/whales/feed", query: (a) => pickDefined(a, ["minSize"]) },
  get_news_signals: { method: "GET", path: "/api/v1/news/signals", query: (a) => pickDefined(a, ["minConfidence"]) },
  get_score: { method: "GET", path: "/api/v1/scores/me" },
  list_alerts: { method: "GET", path: "/api/v1/alerts" },
  list_copy_configs: { method: "GET", path: "/api/v1/copy" },
  list_webhooks: { method: "GET", path: "/api/v1/webhooks" },
  create_webhook: { method: "POST", path: "/api/v1/webhooks", body: (a) => a },
  ai_query: { method: "POST", path: "/api/v1/ai/query", body: (a) => a },
  get_strategy_templates: { method: "GET", path: "/api/v1/strategies/templates" },
  get_market: { method: "GET", path: (a) => `/api/v1/markets/${a.id}` },
  export_strategy: { method: "GET", path: (a) => `/api/v1/strategies/${a.id}/export` },
};

function pickDefined(obj: Record<string, any>, keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      result[k] = String(obj[k]);
    }
  }
  return result;
}

// ─── Handlers ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const apiUrl = process.env.POLYFORGE_API_URL || "http://localhost:3001";
  const apiKey = process.env.POLYFORGE_API_KEY;

  if (!apiKey) {
    return {
      content: [{ type: "text", text: "Error: POLYFORGE_API_KEY environment variable is not set." }],
      isError: true,
    };
  }

  const route = ROUTES[name];
  if (!route) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await callApi(apiUrl, apiKey, route, args as Record<string, any>);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `API error: ${err.message}` }],
      isError: true,
    };
  }
});

async function callApi(
  baseUrl: string,
  apiKey: string,
  route: RouteConfig,
  args: Record<string, any>,
): Promise<unknown> {
  const path = typeof route.path === "function" ? route.path(args) : route.path;
  const url = new URL(path, baseUrl);

  if (route.query) {
    const params = route.query(args);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: route.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: route.body ? JSON.stringify(route.body(args)) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

// ─── Start ─────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport);
