/* MCP Server section — extracted to keep api-docs-content.tsx under 500 lines. */

import { Badge, Code, InlineCode, Sub, PageTitle } from './api-docs-primitives';

export function McpSection() {
  const cfgSnippet = `{\n  "mcpServers": {\n    "polyforge": {\n      "command": "npx",\n      "args": ["@polyforge/mcp-server"],\n      "env": {\n        "POLYFORGE_API_KEY": "pf_live_your_key"\n      }\n    }\n  }\n}`;

  return (
    <div className="space-y-6">
      <PageTitle
        title="MCP Server"
        subtitle="The Polyforge MCP server implements the open Model Context Protocol standard — compatible with Claude, Cursor, Windsurf, Zed, and any MCP-compliant AI client."
      />

      {/* Protocol info */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-pf-text-muted uppercase tracking-wider mb-0.5">Transport</p>
          <code className="text-sm font-mono text-pf-cyan-400">stdio (MCP 1.0)</code>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Claude Desktop','Claude Code','Cursor','Windsurf','Zed','Continue'].map(c => (
            <span key={c} className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-pf-full bg-pf-overlay text-pf-text-secondary">{c}</span>
          ))}
        </div>
      </div>

      <Sub title="Claude Desktop">
        <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>claude_desktop_config.json</InlineCode> (macOS: <InlineCode>~/Library/Application Support/Claude/</InlineCode>, Windows: <InlineCode>%APPDATA%\Claude\</InlineCode>):</p>
        <Code code={cfgSnippet} lang="ts" />
      </Sub>

      <Sub title="Claude Code (CLI)">
        <Code code={`claude mcp add polyforge -- npx @polyforge/mcp-server\nexport POLYFORGE_API_KEY=pf_live_your_key`} lang="curl" />
      </Sub>

      <Sub title="Cursor">
        <p className="text-xs text-pf-text-muted mb-2">Open <InlineCode>Cursor Settings → MCP → Add Server</InlineCode> or add to <InlineCode>~/.cursor/mcp.json</InlineCode>:</p>
        <Code code={cfgSnippet} lang="ts" />
      </Sub>

      <Sub title="Windsurf">
        <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>~/.codeium/windsurf/mcp_config.json</InlineCode>:</p>
        <Code code={cfgSnippet} lang="ts" />
      </Sub>

      <Sub title="Zed">
        <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>settings.json</InlineCode> under <InlineCode>context_servers</InlineCode>:</p>
        <Code code={`{\n  "context_servers": {\n    "polyforge": {\n      "command": {\n        "path": "npx",\n        "args": ["@polyforge/mcp-server"],\n        "env": {\n          "POLYFORGE_API_KEY": "pf_live_your_key"\n        }\n      }\n    }\n  }\n}`} lang="ts" />
      </Sub>

      <Sub title="Continue.dev">
        <p className="text-xs text-pf-text-muted mb-2">Add to <InlineCode>~/.continue/config.json</InlineCode> under <InlineCode>mcpServers</InlineCode>:</p>
        <Code code={`{\n  "mcpServers": [\n    {\n      "name": "polyforge",\n      "command": "npx",\n      "args": ["@polyforge/mcp-server"],\n      "env": {\n        "POLYFORGE_API_KEY": "pf_live_your_key"\n      }\n    }\n  ]\n}`} lang="ts" />
      </Sub>

      <Sub title="Custom integration (any MCP client)">
        <p className="text-xs text-pf-text-muted mb-2">Any host supporting MCP stdio can connect. Install globally then spawn:</p>
        <Code code={`npm install -g @polyforge/mcp-server\nPOLYFORGE_API_KEY=pf_live_your_key polyforge-mcp`} lang="curl" />
      </Sub>

      <Sub title="Available tools (23)">
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
}
