/* eslint-disable */
/* Roadmap page — Now / Next / Later kanban with upvotes */

(() => {
  const { useState, useEffect } = React;

  const ITEMS = {
    now: [
      { id: 'conditional-orders', title: 'Conditional orders', body: 'Fire an order only if another strategy has matched in the last N minutes. Cross-strategy triggers.', tags: ['api', 'ui'], votes: 847 },
      { id: 'mobile-apps', title: 'iOS + Android apps', body: 'Read-only at first: portfolio, alerts, pause/resume. Full control by Q3. SwiftUI + Jetpack Compose.', tags: ['ui'], votes: 1402 },
      { id: 'multi-account', title: 'Multi-account switcher', body: 'Connect up to 5 wallets per venue (Polymarket + Kalshi) under one Polyforge login. Per-account isolation for sizing and limits.', tags: ['api', 'ui'], votes: 412 },
      { id: 'backtest-gpu', title: 'GPU-accelerated backtest', body: 'Run 10,000 parameter sweeps in the time it currently takes to run 100. Useful for grid search and genetic tuning.', tags: ['infra'], votes: 683 },
    ],
    next: [
      { id: 'options-markets', title: 'Options-style payoffs', body: 'Compose binary outcomes into multi-leg payoff diagrams. Price synthetic straddles, iron condors on event spreads.', tags: ['ui'], votes: 524 },
      { id: 'custom-indicators', title: 'Custom indicator blocks', body: 'Write a TypeScript function, publish it as a block. Runs in a sandbox with access to market feeds.', tags: ['api'], votes: 918 },
      { id: 'opinion-venue', title: 'Opinion.app integration', body: 'Third venue on the adapter layer after Polymarket + Kalshi. Cross-venue arb and unified order routing follow once it lands.', tags: ['api', 'infra'], votes: 1044 },
      { id: 'tradingview', title: 'TradingView chart integration', body: 'Embed TradingView charts with Polyforge signals overlaid. Draw on the chart, save as a strategy.', tags: ['ui'], votes: 276 },
      { id: 'sentiment-feed', title: 'Sentiment-driven blocks', body: 'Twitter / Polymarket comment sentiment as a first-class block input. Backfilled 12-month history for backtest.', tags: ['api', 'infra'], votes: 338 },
    ],
    later: [
      { id: 'manifold', title: 'Manifold adapter', body: 'Play-money markets as a free, infinite backtesting environment for new strategies before they touch real capital.', tags: ['api'], votes: 421 },
      { id: 'python-notebooks', title: 'Hosted Python notebooks', body: 'JupyterHub-backed, Polyforge SDK pre-installed. Your strategies and data in one place.', tags: ['infra'], votes: 204 },
      { id: 'team-workspaces', title: 'Team workspaces', body: 'Shared strategies, role-based access, audit log. For prop firms, family offices, trading groups.', tags: ['api', 'ui', 'infra'], votes: 156 },
      { id: 'onchain-settlement', title: 'On-chain settlement proofs', body: 'Cryptographic proofs of order execution posted to Polygon. For users who need verifiable audit trails.', tags: ['infra'], votes: 89 },
    ],
  };

  function useVotes() {
    const [voted, setVoted] = useState(() => {
      try { return new Set(JSON.parse(localStorage.getItem('pf_roadmap_votes') || '[]')); }
      catch { return new Set(); }
    });
    const toggle = (id) => {
      setVoted(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        try { localStorage.setItem('pf_roadmap_votes', JSON.stringify([...next])); } catch {}
        return next;
      });
    };
    return [voted, toggle];
  }

  function RoadmapCard({ item, voted, onVote }) {
    const isVoted = voted.has(item.id);
    const displayCount = item.votes + (isVoted ? 1 : 0);
    return (
      <div className="roadmap-card">
        <div>
          <div className="roadmap-card-title">{item.title}</div>
          <div className="roadmap-card-body">{item.body}</div>
          <div className="roadmap-card-tags">
            {item.tags.map(t => <span className={'roadmap-tag ' + t} key={t}>{t}</span>)}
          </div>
        </div>
        <button
          className={'roadmap-upvote' + (isVoted ? ' voted' : '')}
          onClick={() => onVote(item.id)}
          aria-label={isVoted ? `Remove upvote (${displayCount})` : `Upvote (${displayCount})`}
          aria-pressed={isVoted}
        >
          <Icon name="chevron-up" size={14} />
          <span className="roadmap-upvote-count">{displayCount.toLocaleString()}</span>
        </button>
      </div>
    );
  }

  function Column({ phase, title, items, voted, onVote }) {
    return (
      <div className="roadmap-column">
        <div className="roadmap-column-head">
          <div className={'roadmap-column-title ' + phase}>
            <span className="phase-dot" />
            {title}
          </div>
          <span className="roadmap-column-count">{items.length}</span>
        </div>
        {items.map(item => (
          <RoadmapCard key={item.id} item={item} voted={voted} onVote={onVote} />
        ))}
      </div>
    );
  }

  function App() {
    const [voted, toggle] = useVotes();

    return (
      <CompanyPage active="roadmap">
        <CompanyPageHeader
          eyebrow="Roadmap"
          title="What we’re building next."
          lede="Everything on our public roadmap is real, in-progress, or committed for a release window. Vote on items to influence prioritization — but know that infra and risk work sometimes jumps the queue."
          meta={[
            { label: 'Now', value: `${ITEMS.now.length} items in flight` },
            { label: 'Next', value: `${ITEMS.next.length} queued` },
            { label: 'Updated', value: 'Weekly · Mondays' },
          ]}
        />

        <CompanySection>
          <div className="roadmap-board">
            <Column phase="now"   title="Now"   items={ITEMS.now}   voted={voted} onVote={toggle} />
            <Column phase="next"  title="Next"  items={ITEMS.next}  voted={voted} onVote={toggle} />
            <Column phase="later" title="Later" items={ITEMS.later} voted={voted} onVote={toggle} />
          </div>

          <div style={{ marginTop: 48, padding: 24, border: '1px dashed var(--border-subtle)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--text-primary)' }}>
              <Icon name="chevron-up" size={16} />
            </div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>Your votes are saved locally.</div>
              <div>Upvotes stored in your browser (no account needed). Aggregated votes visible across Polyforge feed back into sprint planning — but we don’t build by popularity alone.</div>
            </div>
          </div>
        </CompanySection>

        <CompanySection title="Don’t see it?" subtitle="Request a feature, report a paper-cut, or propose a block for the marketplace.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-primary btn-sm" href="mailto:roadmap@polyforge.app">Request a feature</a>
            <a className="btn btn-secondary btn-sm" href="#">Join the Discord</a>
            <a className="btn btn-ghost btn-sm" href="Changelog.html">See what shipped</a>
          </div>
        </CompanySection>
      </CompanyPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
