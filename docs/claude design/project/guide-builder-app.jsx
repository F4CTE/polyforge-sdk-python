/* Guide — Strategy Builder */
const TOC = [
  { id: 'canvas', text: 'The canvas', level: 2 },
  { id: 'blocks', text: 'Blocks — the building bricks', level: 2 },
  { id: 'wiring', text: 'Wiring blocks together', level: 2 },
  { id: 'sizing', text: 'Position sizing', level: 2 },
  { id: 'testing', text: 'Testing as you build', level: 2 },
  { id: 'saving', text: 'Saving & sharing', level: 2 },
  { id: 'examples', text: 'Example: trend follower', level: 2 },
];

function BlockSvg({ label, inputs = 1, outputs = 1, color = 'indigo' }) {
  const fill = color === 'indigo' ? '#4f46e5' : color === 'green' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 220 80" width="220" height="80" style={{display:'block'}}>
      <rect x="10" y="10" width="200" height="60" rx="8" fill="var(--bg-surface)" stroke={fill} strokeWidth="1.5" />
      <text x="110" y="45" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontFamily="Geist, sans-serif" fontWeight="500">{label}</text>
      {Array.from({length: inputs}).map((_, i) => (
        <circle key={'i'+i} cx="10" cy={40 - (inputs-1)*8 + i*16} r="4" fill={fill} />
      ))}
      {Array.from({length: outputs}).map((_, i) => (
        <circle key={'o'+i} cx="210" cy={40 - (outputs-1)*8 + i*16} r="4" fill={fill} />
      ))}
    </svg>
  );
}

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="builder"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Using Polyforge' }, { label: 'Strategy builder' }]}
      prev={{ title: 'Quickstart', href: 'Guide-Quickstart.html' }}
      next={{ title: 'Whale dashboard', href: 'Guide-Whales.html' }}
    >
      <h1>The strategy builder</h1>
      <p className="docs-lede">The builder is where you design trading rules visually. Think Figma for trading logic: drag blocks onto a canvas, connect them with wires, hit run. No code, no YAML, no JSON.</p>

      <h2 id="canvas">The canvas</h2>
      <p>When you open a strategy, you land on the canvas — an infinite scrollable surface. The left panel is the <strong>block library</strong>. The right panel is <strong>inspector</strong>, which shows settings for whatever block you have selected. The bottom strip is the <strong>run console</strong>, which shows live logs whenever your strategy is running.</p>
      <p>You pan by holding space and dragging. You zoom with the mouse wheel. Right-click a block for quick actions. Standard stuff.</p>

      <h2 id="blocks">Blocks — the building bricks</h2>
      <p>A <strong>block</strong> is a single unit of logic. It takes inputs on the left, does one thing, and produces outputs on the right. Blocks come in four flavors:</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,margin:'24px 0'}}>
        <div><BlockSvg label="Market price" outputs={1} color="green" /><p style={{fontSize:13,color:'var(--text-secondary)',marginTop:6}}><strong>Sources</strong> produce data — prices, volumes, whale activity.</p></div>
        <div><BlockSvg label="EMA cross" inputs={1} outputs={1} color="indigo" /><p style={{fontSize:13,color:'var(--text-secondary)',marginTop:6}}><strong>Indicators</strong> transform data into signals.</p></div>
        <div><BlockSvg label="Price > 0.5?" inputs={1} outputs={1} color="amber" /><p style={{fontSize:13,color:'var(--text-secondary)',marginTop:6}}><strong>Filters</strong> decide when to act on a signal.</p></div>
        <div><BlockSvg label="Buy Kelly" inputs={1} outputs={0} color="red" /><p style={{fontSize:13,color:'var(--text-secondary)',marginTop:6}}><strong>Actions</strong> place, cancel, or resize orders.</p></div>
      </div>
      <p>Every strategy needs at least one source, zero or more indicators and filters, and at least one action. That's the whole mental model.</p>

      <h2 id="wiring">Wiring blocks together</h2>
      <p>Click an output dot (on the right side of a block) and drag to an input dot (left side of another block). Release to create a wire. Wires are typed — if you try to connect a number output to a boolean input, Polyforge refuses and shows a red flash.</p>
      <Callout type="tip" title="Name your wires">Double-click any wire to label it. Labels show up in logs, backtest reports, and alerts. Future-you will thank current-you.</Callout>

      <h2 id="sizing">Position sizing</h2>
      <p>The <strong>Buy</strong> and <strong>Sell</strong> action blocks need to know how big an order to place. You have four sizing modes:</p>
      <ul>
        <li><strong>Fixed $</strong> — always the same dollar amount. Great for testing.</li>
        <li><strong>% of bankroll</strong> — scales with your account size. Safer as you grow.</li>
        <li><strong>Kelly</strong> — math-optimal, based on your edge. Aggressive — cap it at half-Kelly for real money.</li>
        <li><strong>Match source</strong> — mirror the size of whatever triggered the signal (used in whale copy).</li>
      </ul>

      <h2 id="testing">Testing as you build</h2>
      <p>Hit <strong>▶ Preview</strong> at any time to replay the last 24 hours of data through your strategy. It runs in under a second and shows you exactly where signals would have fired — great for sanity-checking a change before committing to a full backtest.</p>

      <h2 id="saving">Saving & sharing</h2>
      <p>Strategies save automatically as you work. To share one, click the strategy name in the top bar and choose <strong>Export → Share link</strong>. Recipients can view or clone, but never edit your original.</p>
      <Callout type="warn" title="Public templates are public">If you publish a strategy to the marketplace, assume everyone can see the logic. Don't put secret sauce in a public template.</Callout>

      <h2 id="examples">Example: a simple trend follower</h2>
      <p>Five blocks, wired in a line:</p>
      <ol>
        <li><strong>Market price</strong> (source) → feeds the price of a specific market</li>
        <li><strong>EMA cross</strong> (indicator) → fires "up" when fast EMA crosses above slow EMA</li>
        <li><strong>Cooldown 30min</strong> (filter) → prevents whipsaws</li>
        <li><strong>Buy 2% of bankroll</strong> (action) → opens the position</li>
        <li><strong>Stop loss -5%</strong> (action) → attaches a protective order</li>
      </ol>
      <p>That's it. Clone the "EMA crossover" template to see it live.</p>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
