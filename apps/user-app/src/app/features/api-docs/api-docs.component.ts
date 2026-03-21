import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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

@Component({
  selector: 'app-api-docs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="api-docs">

      <!-- ─── Header ─────────────────────────────────────────────── -->
      <div class="page-header" style="margin-bottom: 32px">
        <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 6px">API Documentation</h1>
        <p style="color: var(--pf-text-secondary); font-size: 15px; line-height: 1.6">
          Use your API key to integrate with external tools, AI agents, and custom applications.
        </p>
      </div>

      <!-- ─── Authentication ─────────────────────────────────────── -->
      <section class="api-section">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 14px">Authentication</h2>
        <p style="color: var(--pf-text-secondary); margin-bottom: 12px; line-height: 1.6">
          Authenticate every request by including your API key in the <code style="background: var(--pf-bg-overlay); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 13px">Authorization</code> header:
        </p>
        <div class="code-block" style="margin-bottom: 16px">Authorization: Bearer pf_your_key_here</div>

        <p style="color: var(--pf-text-secondary); margin-bottom: 12px; line-height: 1.6">Example request:</p>
        <div class="code-block" style="margin-bottom: 20px">curl -X GET https://api.polyforge.app/api/v1/markets \\
  -H "Authorization: Bearer pf_live_abc123..."</div>

        <p style="color: var(--pf-text-secondary); margin-bottom: 16px; line-height: 1.6">
          Generate and manage your API keys in
          <a routerLink="/settings" style="color: var(--pf-cyan-400); text-decoration: underline">Settings &rarr; API Keys</a>.
        </p>

        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px">Scopes</h3>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px">
          <div style="display: flex; align-items: center; gap: 10px">
            <span class="scope-badge" style="background: var(--pf-success-bg); color: var(--pf-success)">READ</span>
            <span style="color: var(--pf-text-secondary); font-size: 13px">View data: markets, portfolio, strategies, orders, alerts, backtests, profiles</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px">
            <span class="scope-badge" style="background: var(--pf-info-bg); color: var(--pf-info)">WRITE</span>
            <span style="color: var(--pf-text-secondary); font-size: 13px">Modify strategies, settings, alerts, and start backtests</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px">
            <span class="scope-badge" style="background: var(--pf-warning-bg); color: var(--pf-warning)">TRADE</span>
            <span style="color: var(--pf-text-secondary); font-size: 13px">Place orders, start/stop/pause/resume strategies, close positions</span>
          </div>
        </div>
      </section>

      <!-- ─── Endpoints ──────────────────────────────────────────── -->
      <section class="api-section">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 14px">Endpoints</h2>

        @for (category of categories; track category.title; let catIdx = $index) {
          <div style="margin-bottom: 24px">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 10px; color: var(--pf-text-primary)">
              {{ category.title }}
            </h3>
            @for (ep of category.endpoints; track ep.path + ep.method; let epIdx = $index) {
              <div>
                <div class="api-endpoint" (click)="toggleEndpoint(catIdx, epIdx)">
                  <span class="method-badge" [class]="'method-' + ep.method.toLowerCase()">{{ ep.method }}</span>
                  <code style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--pf-text-primary); flex: 1">{{ ep.path }}</code>
                  <span class="scope-badge" [style.background]="scopeBg(ep.scope)" [style.color]="scopeColor(ep.scope)">{{ ep.scope }}</span>
                  <i class="pi" [class.pi-chevron-down]="!isOpen(catIdx, epIdx)" [class.pi-chevron-up]="isOpen(catIdx, epIdx)"
                     style="font-size: 12px; color: var(--pf-text-muted)"></i>
                </div>
                @if (isOpen(catIdx, epIdx)) {
                  <div style="padding: 0 14px 14px 14px; border: 1px solid var(--pf-border-default); border-top: none; border-radius: 0 0 8px 8px; margin-top: -9px; margin-bottom: 8px">
                    <p style="color: var(--pf-text-secondary); font-size: 13px; margin: 12px 0 8px">{{ ep.description }}</p>
                    @if (ep.queryParams) {
                      <p style="color: var(--pf-text-muted); font-size: 12px; margin-bottom: 8px">Query params: <code style="font-family: 'JetBrains Mono', monospace; font-size: 12px">{{ ep.queryParams }}</code></p>
                    }
                    <div class="code-block" style="font-size: 12px">{{ ep.curl }}</div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>

      <!-- ─── Rate Limits ────────────────────────────────────────── -->
      <section class="api-section">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 14px">Rate Limits</h2>
        <p style="color: var(--pf-text-secondary); line-height: 1.6; margin-bottom: 8px">
          Each API key is limited to <strong style="color: var(--pf-text-primary)">120 requests per minute</strong>.
          If you exceed the limit, the API responds with status <code style="background: var(--pf-bg-overlay); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 13px">429 Too Many Requests</code>.
        </p>
        <p style="color: var(--pf-text-secondary); line-height: 1.6">
          The response includes a <code style="background: var(--pf-bg-overlay); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 13px">Retry-After</code> header indicating how many seconds to wait before retrying.
        </p>
      </section>

      <!-- ─── Error Codes ────────────────────────────────────────── -->
      <section class="api-section">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 14px">Error Codes</h2>
        <p style="color: var(--pf-text-secondary); line-height: 1.6; margin-bottom: 14px">
          All errors follow a standard shape:
        </p>
        <div class="code-block" style="margin-bottom: 16px">{{ errorShape }}</div>

        <div style="overflow-x: auto">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px">
            <thead>
              <tr style="border-bottom: 1px solid var(--pf-border-default)">
                <th style="text-align: left; padding: 8px 12px; color: var(--pf-text-muted); font-weight: 600; font-size: 12px">Code</th>
                <th style="text-align: left; padding: 8px 12px; color: var(--pf-text-muted); font-weight: 600; font-size: 12px">Meaning</th>
              </tr>
            </thead>
            <tbody>
              @for (err of errorCodes; track err.code) {
                <tr style="border-bottom: 1px solid var(--pf-border-default)">
                  <td style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; color: var(--pf-text-primary)">{{ err.code }}</td>
                  <td style="padding: 8px 12px; color: var(--pf-text-secondary)">{{ err.meaning }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- ─── Code Examples ──────────────────────────────────────── -->
      <section class="api-section">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 14px">Code Examples</h2>

        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 10px">1. List your strategies</h3>
        <p style="color: var(--pf-text-muted); font-size: 12px; margin-bottom: 6px">curl</p>
        <div class="code-block" style="margin-bottom: 12px">curl -X GET https://api.polyforge.app/api/v1/strategies \\
  -H "Authorization: Bearer pf_live_abc123..."</div>
        <p style="color: var(--pf-text-muted); font-size: 12px; margin-bottom: 6px">JavaScript (fetch)</p>
        <div class="code-block" style="margin-bottom: 24px">const res = await fetch('https://api.polyforge.app/api/v1/strategies', {{ '{' }}
  headers: {{ '{' }} 'Authorization': 'Bearer pf_live_abc123...' {{ '}' }}
{{ '}' }});
const strategies = await res.json();</div>

        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 10px">2. Start a strategy</h3>
        <p style="color: var(--pf-text-muted); font-size: 12px; margin-bottom: 6px">curl</p>
        <div class="code-block" style="margin-bottom: 24px">curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\
  -H "Authorization: Bearer pf_live_abc123..."</div>

        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 10px">3. Get portfolio P&amp;L</h3>
        <p style="color: var(--pf-text-muted); font-size: 12px; margin-bottom: 6px">curl</p>
        <div class="code-block" style="margin-bottom: 12px">curl -X GET https://api.polyforge.app/api/v1/portfolio/pnl \\
  -H "Authorization: Bearer pf_live_abc123..."</div>
      </section>

    </div>
  `,
})
export class ApiDocsComponent {
  openEndpoints = signal<Set<string>>(new Set());

  readonly errorShape = `{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired API key",
  "field": null,
  "requestId": "req_abc123"
}`;

  readonly errorCodes = [
    { code: 400, meaning: 'Bad Request — invalid parameters or malformed body' },
    { code: 401, meaning: 'Unauthorized — missing or invalid API key' },
    { code: 403, meaning: 'Forbidden — API key lacks the required scope' },
    { code: 404, meaning: 'Not Found — resource does not exist' },
    { code: 409, meaning: 'Conflict — action conflicts with current state (e.g. strategy already running)' },
    { code: 422, meaning: 'Unprocessable Entity — validation failed' },
    { code: 429, meaning: 'Too Many Requests — rate limit exceeded' },
    { code: 500, meaning: 'Internal Server Error — unexpected error on our end' },
  ];

  readonly categories: EndpointCategory[] = [
    {
      title: 'Markets',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/markets', scope: 'READ',
          description: 'List all available markets with optional filtering.',
          queryParams: 'search, sort, category',
          curl: 'curl -X GET "https://api.polyforge.app/api/v1/markets?search=election&sort=volume" \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'GET', path: '/api/v1/markets/:id', scope: 'READ',
          description: 'Get full details for a single market including description, rules, and current prices.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/mkt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'GET', path: '/api/v1/markets/:tokenId/price-history', scope: 'READ',
          description: 'Get OHLCV price history for a market token.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/price-history \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'GET', path: '/api/v1/markets/:tokenId/book', scope: 'READ',
          description: 'Get the current order book for a market token.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/book \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Strategies',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/strategies', scope: 'READ',
          description: 'List all your strategies.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/strategies', scope: 'WRITE',
          description: 'Create a new strategy.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "My Strategy", "blocks": [...]}\'',
        },
        {
          method: 'GET', path: '/api/v1/strategies/:id', scope: 'READ',
          description: 'Get full details for a strategy including blocks, settings, and status.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'PATCH', path: '/api/v1/strategies/:id', scope: 'WRITE',
          description: 'Update a strategy (name, blocks, settings).',
          curl: 'curl -X PATCH https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "Updated Name"}\'',
        },
        {
          method: 'DELETE', path: '/api/v1/strategies/:id', scope: 'WRITE',
          description: 'Delete a strategy. Must be stopped first.',
          curl: 'curl -X DELETE https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/strategies/:id/start', scope: 'TRADE',
          description: 'Start live execution of a strategy.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/strategies/:id/stop', scope: 'TRADE',
          description: 'Stop a running strategy. Open positions remain.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/stop \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/strategies/:id/pause', scope: 'TRADE',
          description: 'Pause a running strategy temporarily.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/pause \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/strategies/:id/resume', scope: 'TRADE',
          description: 'Resume a paused strategy.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/resume \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Orders',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/orders', scope: 'READ',
          description: 'List your orders with optional filtering.',
          queryParams: 'status, page, limit',
          curl: 'curl -X GET "https://api.polyforge.app/api/v1/orders?status=filled&limit=50" \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/orders/close-position', scope: 'TRADE',
          description: 'Close an open position by selling your shares at market.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/close-position \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"positionId": "pos_abc123"}\'',
        },
      ],
    },
    {
      title: 'Portfolio',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/portfolio', scope: 'READ',
          description: 'Get your current positions and aggregated P&L.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'GET', path: '/api/v1/portfolio/pnl', scope: 'READ',
          description: 'Get P&L time series data for charting.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio/pnl \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Alerts',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/alerts', scope: 'READ',
          description: 'List all your price alerts.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/alerts', scope: 'WRITE',
          description: 'Create a new price alert.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"marketId": "mkt_abc123", "condition": "above", "price": 0.75}\'',
        },
        {
          method: 'DELETE', path: '/api/v1/alerts/:id', scope: 'WRITE',
          description: 'Delete a price alert.',
          curl: 'curl -X DELETE https://api.polyforge.app/api/v1/alerts/alert_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Backtests',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/backtests', scope: 'READ',
          description: 'List your backtest runs.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/backtests', scope: 'WRITE',
          description: 'Start a new backtest run.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"strategyId": "strat_123", "from": "2025-01-01", "to": "2025-06-01"}\'',
        },
        {
          method: 'GET', path: '/api/v1/backtests/:id', scope: 'READ',
          description: 'Get results for a backtest run including equity curve and trade log.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests/bt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Profile',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/profile/:username', scope: 'READ',
          description: 'Get a user profile including public strategies and stats.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/profile/alphatrader \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
    {
      title: 'Paper Trading',
      endpoints: [
        {
          method: 'GET', path: '/api/v1/paper/summary', scope: 'READ',
          description: 'Get your paper trading account summary including balance and performance.',
          curl: 'curl -X GET https://api.polyforge.app/api/v1/paper/summary \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
        {
          method: 'POST', path: '/api/v1/paper/reset', scope: 'WRITE',
          description: 'Reset your paper trading account to default balance.',
          curl: 'curl -X POST https://api.polyforge.app/api/v1/paper/reset \\\n  -H "Authorization: Bearer pf_live_abc123..."',
        },
      ],
    },
  ];

  toggleEndpoint(catIdx: number, epIdx: number): void {
    const key = `${catIdx}-${epIdx}`;
    this.openEndpoints.update(set => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isOpen(catIdx: number, epIdx: number): boolean {
    return this.openEndpoints().has(`${catIdx}-${epIdx}`);
  }

  scopeBg(scope: string): string {
    switch (scope) {
      case 'READ': return 'var(--pf-success-bg)';
      case 'WRITE': return 'var(--pf-info-bg)';
      case 'TRADE': return 'var(--pf-warning-bg)';
      default: return 'var(--pf-bg-overlay)';
    }
  }

  scopeColor(scope: string): string {
    switch (scope) {
      case 'READ': return 'var(--pf-success)';
      case 'WRITE': return 'var(--pf-info)';
      case 'TRADE': return 'var(--pf-warning)';
      default: return 'var(--pf-text-primary)';
    }
  }
}
