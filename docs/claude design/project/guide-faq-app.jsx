/* Guide — FAQ */
const { useState } = React;

const FAQ = [
  { cat: 'Getting started', qs: [
    ['Can I really use Polyforge without knowing how to code?', "Yes. The visual Strategy Builder covers everything most users need. Code is optional — for developers who want to do something the builder can't express."],
    ['How much does it cost to start?', "Nothing. The free tier gives you unlimited paper trading and one live strategy, forever. You only pay if you want more live strategies, whale feeds, or team features."],
    ['Do I need a Polymarket or Kalshi account already?', "You'll need at least one of them — that's where your trading capital lives. But you can sign up for Polyforge first, learn the tool in paper mode, and connect a venue when you're ready to go live."], Polymarket when you're ready to go live."],
    ['How long before I see results?', "Depends on the strategy. A high-frequency strategy will log hundreds of trades per day. A resolution-hunting strategy might place 2 trades a week. Paper-trade for 1–2 weeks minimum before drawing any conclusions."],
  ]},
  { cat: 'Money & risk', qs: [
    ["Where does my trading money actually sit?", "In your Polymarket wallet — never with Polyforge. We connect via Polymarket's official OAuth. Your USDC stays on Polygon under your control. We never take custody."],
    ["What's the minimum to start trading live?", "Polymarket requires a ~$20 minimum deposit. That's enough to test live mechanics with tiny position sizes. Realistically you want $500–$1000 before a strategy produces meaningful signal."],
    ["Can I lose more than I deposit?", "No. Prediction-market contracts are fully collateralized — the most you can lose on any trade is the amount you put in. No margin, no leverage, no liquidation."],
    ["What happens if Polyforge goes down?", "Your strategies stop placing new orders. Your existing orders on-venue remain live. Your positions are unaffected — they sit with Polymarket. When we come back up, strategies resume from their last known state."],
  ]},
  { cat: 'Strategies & whales', qs: [
    ["Which template should I start with?", "EMA Crossover is the easiest to reason about. Copy Whale is the most fun to watch. Resolution Hunter has the highest hit rate for beginners. Pick whichever matches your temperament."],
    ["How do I know if a strategy is working?", "Give it 5+ days in paper. Compare the paper P&L to what the backtest predicted. If they're within 20% of each other, you can trust the strategy. If paper is way worse, the backtest was fooling you."],
    ["Can I copy more than one whale at a time?", "Yes. Build a cohort (on Team plan) or just create one copy strategy per whale — they run independently and their fills are bundled in your dashboard."],
    ["What happens when a whale changes their style?", "Your copy strategy keeps copying. That's a risk. Check your whales' 30-day performance once a month; stop copying anyone whose recent edge has disappeared."],
  ]},
  { cat: 'Account', qs: [
    ["How do I cancel my plan?", "Settings → Billing → Cancel plan. Takes one click. Your Pro/Team features stay active until the end of the period, then you drop to the free tier. No retention flows, no guilt trips."],
    ["Can I get a refund?", "For accidental charges (cancelled but charged again), yes — same day. For 'I didn't trade this month', no. Plans are flat-rate; downgrade anytime."],
    ["What happens to my strategies if I cancel?", "They pause but stay in your account. If you reactivate within 90 days, they come back exactly as they were. After 90 days of inactivity we archive them (not deleted — archived, recoverable on request)."],
    ["Can I delete my account?", "Yes, from Settings → Account → Delete. We purge your personal data within 30 days per the Privacy Policy. Your trade history on Polymarket is public on-chain and outside our control."],
  ]},
  { cat: 'Technical', qs: [
    ["Why did my order get rejected?", "Most commonly: insufficient wallet balance, the market resolved before your order reached it, or the price moved outside your limit before it could fill. Every rejection has a reason code in the fills log."],
    ["Why is there a difference between paper and live fills?", "Paper estimates slippage from order book depth. Live actually executes. In thin markets, this can differ by 5–20%. It's the main reason paper doesn't fully predict live performance."],
    ["Does Polyforge work outside the US?", "Yes — Polyforge is available globally. Your access to Polymarket depends on Polymarket's own jurisdiction rules, which do exclude certain regions. Check with them."],
    ["Can I run Polyforge on my own infrastructure?", "Enterprise plan customers can self-host the execution engine. Contact sales for details."],
  ]},
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderBottom:'1px solid var(--border-subtle)'}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{width:'100%',textAlign:'left',background:'none',border:0,padding:'18px 0',color:'var(--text-primary)',fontSize:15,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,fontFamily:'inherit'}}
        aria-expanded={open}
      >
        <span>{q}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
      </button>
      {open && (
        <div style={{paddingBottom:18,color:'var(--text-secondary)',fontSize:14,lineHeight:1.65,maxWidth:720}}>{a}</div>
      )}
    </div>
  );
}

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="faq"
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Help' }, { label: 'FAQ' }]}
      prev={{ title: 'Glossary', href: 'Guide-Glossary.html' }}
      next={null}
    >
      <h1>Frequently asked questions</h1>
      <p className="docs-lede">Answers to the 20 questions we get most often. If yours isn't here, <a href="Contact.html">email us</a> — we read every one, and the good ones end up on this page.</p>
      {FAQ.map((group, gi) => (
        <section key={gi} style={{marginTop:40}}>
          <h2 style={{fontSize:20,marginBottom:4}}>{group.cat}</h2>
          <div>
            {group.qs.map(([q, a], qi) => <FAQItem key={qi} q={q} a={a} />)}
          </div>
        </section>
      ))}
      <Callout type="tip" title="Didn't find your answer?">
        Email <a href="mailto:support@polyforge.app">support@polyforge.app</a> or ping us in the in-app chat (bottom right). Response within one business day, usually same day.
      </Callout>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
