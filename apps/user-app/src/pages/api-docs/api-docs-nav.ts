/* Navigation data shared between the sidebar and the main component. */

import type { EndpointDef } from './api-docs-endpoints';
import {
  MARKETS, STRATEGIES, LIVE_WATCHING, TRADING, ORDERS,
  CONDITIONAL_ORDERS, PORTFOLIO, BACKTESTS, COPY_TRADING,
  WHALE_FEED, NEWS_SIGNALS, ALERTS, WEBHOOKS, SCORES,
} from './api-docs-endpoints';

export const NAV_GROUPS: { group: string | null; items: { id: string; label: string }[] }[] = [
  {
    group: null,
    items: [
      { id: 'getting-started', label: 'Getting Started' },
      { id: 'authentication',  label: 'Authentication' },
      { id: 'sdks',            label: 'SDKs & Clients' },
      { id: 'changelog',       label: 'Changelog' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { id: 'markets',            label: 'Markets' },
      { id: 'strategies',         label: 'Strategies' },
      { id: 'live-watching',      label: 'Execution Watching' },
      { id: 'trading',            label: 'Direct Trading' },
      { id: 'orders',             label: 'Orders' },
      { id: 'conditional-orders', label: 'Conditional Orders' },
      { id: 'portfolio',          label: 'Portfolio' },
      { id: 'backtests',          label: 'Backtests' },
      { id: 'copy-trading',       label: 'Copy Trading' },
      { id: 'whale-feed',         label: 'Whale Feed' },
      { id: 'news-signals',       label: 'News & Signals' },
      { id: 'alerts',             label: 'Alerts' },
      { id: 'webhooks',           label: 'Webhooks' },
      { id: 'scores',             label: 'Scores' },
    ],
  },
  {
    group: 'Real-time',
    items: [
      { id: 'websocket',           label: 'WebSocket' },
      { id: 'sse',                 label: 'SSE Events' },
      { id: 'webhook-signatures',  label: 'Webhook Signatures' },
    ],
  },
  {
    group: 'Guides',
    items: [
      { id: 'rate-limits',    label: 'Rate Limits' },
      { id: 'error-handling', label: 'Error Handling' },
      { id: 'mcp-server',     label: 'MCP Server' },
    ],
  },
];

export const ENDPOINT_SECTIONS: { id: string; title: string; eps: EndpointDef[] }[] = [
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
