/* Docs — MCP Server guide */

const INSTALL_CLAUDE = {
  sh: `<span class="tok-c"># Claude Desktop — macOS</span>
<span class="tok-c"># Edit: ~/Library/Application Support/Claude/claude_desktop_config.json</span>

<span class="tok-p">{</span>
  <span class="tok-s">"mcpServers"</span><span class="tok-p">:</span> <span class="tok-p">{</span>
    <span class="tok-s">"polyforge"</span><span class="tok-p">:</span> <span class="tok-p">{</span>
      <span class="tok-s">"command"</span><span class="tok-p">:</span> <span class="tok-s">"npx"</span><span class="tok-p">,</span>
      <span class="tok-s">"args"</span><span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-s">"-y"</span><span class="tok-p">,</span> <span class="tok-s">"@polyforge/mcp"</span><span class="tok-p">],</span>
      <span class="tok-s">"env"</span><span class="tok-p">:</span> <span class="tok-p">{</span> <span class="tok-s">"POLYFORGE_KEY"</span><span class="tok-p">:</span> <span class="tok-s">"pk_live_..."</span> <span class="tok-p">}</span>
    <span class="tok-p">}</span>
  <span class="tok-p">}</span>
<span class="tok-p">}</span>`,
};

const INSTALL_CURSOR = {
  sh: `<span class="tok-c"># Cursor — Settings → MCP → Add Server</span>

<span class="tok-p">{</span>
  <span class="tok-s">"name"</span><span class="tok-p">:</span> <span class="tok-s">"polyforge"</span><span class="tok-p">,</span>
  <span class="tok-s">"command"</span><span class="tok-p">:</span> <span class="tok-s">"npx"</span><span class="tok-p">,</span>
  <span class="tok-s">"args"</span><span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-s">"-y"</span><span class="tok-p">,</span> <span class="tok-s">"@polyforge/mcp"</span><span class="tok-p">],</span>
  <span class="tok-s">"env"</span><span class="tok-p">:</span> <span class="tok-p">{</span> <span class="tok-s">"POLYFORGE_KEY"</span><span class="tok-p">:</span> <span class="tok-s">"pk_live_..."</span> <span class="tok-p">}</span>
<span class="tok-p">}</span>`,
};

const INSTALL_SSE = {
  sh: `<span class="tok-c"># Remote (SSE) — for hosted agents like OpenAI Responses, Zed, etc.</span>
<span class="tok-c"># Endpoint: https://mcp.polyforge.app/sse</span>
<span class="tok-c"># Auth:     Bearer $POLYFORGE_KEY</span>`,
};

const SCOPES_CODE = {
  sh: `<span class="tok-c"># Scope your key at key-creation time</span>
polyforge keys create <span class="tok-s">"claude-desktop"</span> \\
  --scope read \\
  --scope paper:write \\
  --expires 90d`,
};

const TRANSCRIPT_CODE = {
  sh: `<span class="tok-c">╭─ You ──────────────────────────────────────────────╮</span>
<span class="tok-c">│</span> What's my worst-performing strategy this week?
<span class="tok-c">╰────────────────────────────────────────────────────╯</span>

<span class="tok-c">╭─ Claude ───────────────────────────────────────────╮</span>
<span class="tok-c">│</span> <span class="tok-k">→ calling</span> polyforge.list_strategies
<span class="tok-c">│</span> <span class="tok-k">→ calling</span> polyforge.strategy_pnl(window=<span class="tok-s">"7d"</span>)
<span class="tok-c">│</span>
<span class="tok-c">│</span> <span class="tok-t">eth-5k-crossover</span> is down <span class="tok-m">-4.1%</span> on the week — the
<span class="tok-c">│</span> worst of your 6 active strategies. Two sharp
<span class="tok-c">│</span> reversals on <span class="tok-s">Apr 17</span> and <span class="tok-s">Apr 19</span> account for
<span class="tok-c">│</span> 80% of the drawdown. Want me to pause it, tighten
<span class="tok-c">│</span> the stop, or pull the recent fills for review?
<span class="tok-c">╰────────────────────────────────────────────────────╯</span>`,
};

const TOC = [
  { id: 'what-is-mcp', text: 'What is MCP?', level: 2 },
  { id: 'install', text: 'Install', level: 2 },
  { id: 'claude', text: 'Claude Desktop', level: 3 },
  { id: 'cursor', text: 'Cursor', level: 3 },
  { id: 'sse', text: 'Remote (SSE)', level: 3 },
  { id: 'scopes', text: 'Scoping your key', level: 2 },
  { id: 'tools', text: 'Tools', level: 2 },
  { id: 'resources', text: 'Resources', level: 2 },
  { id: 'prompts', text: 'Prompts', level: 2 },
  { id: 'example', text: 'Example session', level: 2 },
  { id: 'safety', text: 'Safety rails', level: 2 },
];

function MCPPage() {
  return (
    <DocsLayout
      activeId="mcp"
      section="docs"
      toc={TOC}
      breadcrumbs={[{ label: 'Docs', href: 'Docs.html' }, { label: 'Reference' }, { label: 'MCP Server' }]}
      prev={{ title: 'REST API', href: 'Docs-API.html' }}
      next={null}
    >
      <h1>MCP Server</h1>
      <p className="docs-lede">
        Polyforge ships a Model Context Protocol server so your AI assistant — Claude Desktop, Cursor, Zed, any MCP-capable client — can inspect markets, query strategies, run backtests, and (if you let it) place orders. Everything you can do in the SDK, you can ask for in natural language.
      </p>

      <Callout type="tip" title="New to MCP?">
        MCP is the open protocol for giving LLMs typed, permissioned access to tools and data. Servers expose <strong>tools</strong> (actions), <strong>resources</strong> (read-only data), and <strong>prompts</strong> (reusable templates). The client handles transport, auth, and human-in-the-loop confirmation.
      </Callout>

      <h2 id="what-is-mcp">What is MCP, for trading?</h2>
      <p>The practical answer: you stop grepping logs and start asking questions. "Why did <code>eth-5k-crossover</code> pause yesterday?" "Show me every whale buy on crypto markets this morning over $50k." "Dry-run a 10% bankroll cut on my two worst strategies."</p>
      <p>Under the hood, the MCP server is a thin adapter over the REST API. Every tool call is a regular, audited API request — same rate limits, same logs, same webhook events. Nothing the assistant can do is invisible to you.</p>

      <h2 id="install">Install</h2>

      <h3 id="claude">Claude Desktop</h3>
      <CodeBlock snippets={INSTALL_CLAUDE} lang="json" />
      <p>Restart Claude. You'll see a new "polyforge" hammer icon in the composer; click it to see available tools.</p>

      <h3 id="cursor">Cursor</h3>
      <CodeBlock snippets={INSTALL_CURSOR} lang="json" />

      <h3 id="sse">Remote (SSE)</h3>
      <p>For clients that prefer a remote server over a local subprocess. The SSE endpoint is globally available and load-balanced across the same regions as the REST API.</p>
      <CodeBlock snippets={INSTALL_SSE} />

      <h2 id="scopes">Scoping your key</h2>
      <p>The MCP server inherits whatever scope the API key has. For agentic use, we strongly recommend a narrower key than your main one.</p>
      <CodeBlock snippets={SCOPES_CODE} />
      <p>A <strong>read</strong>-only key lets the assistant answer questions and draft plans but never place an order. <strong>paper:write</strong> adds paper-mode execution. <strong>live:write</strong> is available but requires a confirm step on every order by default — you can relax that per-session if you trust the agent.</p>

      <h2 id="tools">Tools</h2>
      <p>The server exposes 23 tools. The most-used:</p>
      <ParamsTable rows={[
        { name: 'list_strategies', type: 'read', desc: 'List all strategies with current status, mode, and bankroll.' },
        { name: 'strategy_pnl', type: 'read', desc: 'P&L over a time window. Accepts "24h" | "7d" | "30d" | "ytd" | "all".' },
        { name: 'get_market', type: 'read', desc: 'Fetch a single market with full order book and resolution metadata.' },
        { name: 'search_markets', type: 'read', desc: 'Natural-language market search. Ranks by liquidity and category match.' },
        { name: 'list_whales', type: 'read', desc: 'Top whale wallets with 7d/30d performance and recent activity.' },
        { name: 'recent_fills', type: 'read', desc: 'Your fills across all strategies, filterable by market, side, or size.' },
        { name: 'run_backtest', type: 'read', desc: 'Kick off a backtest. Returns a job ID you can poll for results.' },
        { name: 'pause_strategy', type: 'paper:write / live:write', desc: 'Pauses a strategy without cancelling its live orders.' },
        { name: 'resume_strategy', type: 'paper:write / live:write', desc: 'Resumes a paused strategy at the next candle boundary.' },
        { name: 'place_order', type: 'live:write', desc: 'Place a one-off order. Subject to the confirm-before-execute rail.' },
        { name: 'cancel_order', type: 'live:write', desc: 'Cancel an open order by ID.' },
      ]} />

      <h2 id="resources">Resources</h2>
      <p>Resources are read-only URIs the assistant can pull on demand — think of them as "files" the agent can open without a tool call. Good for grounding long-running analysis.</p>
      <ul>
        <li><code>polyforge://strategies/{"{id}"}</code> — full strategy config + source</li>
        <li><code>polyforge://markets/{"{venue}"}/{"{id}"}</code> — market snapshot</li>
        <li><code>polyforge://whales/{"{wallet}"}</code> — whale profile + recent trades</li>
        <li><code>polyforge://backtests/{"{id}"}</code> — completed backtest report</li>
      </ul>

      <h2 id="prompts">Prompts</h2>
      <p>Reusable prompt templates the client can surface as slash-commands or quick actions:</p>
      <ul>
        <li><code>/morning-review</code> — overnight P&L, open risk, any breach events</li>
        <li><code>/strategy-autopsy {"{id}"}</code> — deep dive on why a strategy is up or down</li>
        <li><code>/whale-follow {"{wallet}"}</code> — draft a strategy that mirrors a given wallet</li>
        <li><code>/pre-market</code> — calendar of markets resolving in the next 48h</li>
      </ul>

      <h2 id="example">Example session</h2>
      <CodeBlock snippets={TRANSCRIPT_CODE} lang="chat" />

      <h2 id="safety">Safety rails</h2>
      <p>A few things we do by default, because LLMs will confidently do wrong things:</p>
      <ul>
        <li><strong>Confirm-before-execute</strong> on every live tool call. The client shows the exact order before it hits the venue. Can be relaxed per-session.</li>
        <li><strong>Dry-run mode</strong> is the default for <code>place_order</code>. Pass <code>confirm: true</code> explicitly to execute.</li>
        <li><strong>Bankroll caps</strong> from the strategy config apply even to manual assistant-driven orders.</li>
        <li><strong>Audit trail:</strong> every MCP tool call is tagged <code>source: "mcp"</code> in your audit log with the client name and session ID.</li>
        <li><strong>Read-only defaults:</strong> fresh keys created from the dashboard start read-only. Opt into write scopes explicitly.</li>
      </ul>
      <Callout type="warn" title="Your assistant is not your trader">
        MCP is extraordinarily useful for analysis, investigation, and getting unstuck. Delegating autonomous trading decisions to a language model — even a very good one — is not something we endorse. Keep a human in the execution loop.
      </Callout>
    </DocsLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MCPPage />);
